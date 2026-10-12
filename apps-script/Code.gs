/**
 * SANAD COD receiver for the existing 13-column order sheet.
 * Attribution is included in Notes by the Vercel endpoint. The script keeps
 * lookup + append atomic across concurrent Apps Script executions.
 */
const SANAD_CONFIG = Object.freeze({
  contractVersion: 'sanad-orders-v2',
  spreadsheetId: '14UBAS9ZpFgL92PFrBHQswknnp9Lxt4VTLFSEbGFZAmc',
  sheetName: 'RETINOL YELLOW',
  lockTimeoutMs: 30000
});

const SANAD_HEADERS = Object.freeze([
  'Order Date', 'Order ID', 'Country', 'Name', 'Phone', 'Address', 'Url',
  'Sku', 'Product', 'Quantity', 'Total Price', 'Currency', 'Notes'
]);

function doGet() {
  try {
    const sheet = orderSheet_();
    verifyHeaders_(sheet);
    return jsonResponse_({
      ok: true,
      ready: true,
      contractVersion: SANAD_CONFIG.contractVersion,
      persistentIdempotency: 'script-lock+order-id',
      attributionStoredIn: 'Notes',
      sheetName: SANAD_CONFIG.sheetName
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      ready: false,
      contractVersion: SANAD_CONFIG.contractVersion,
      error: error && error.message ? error.message : 'CONFIGURATION_CHECK_FAILED'
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(SANAD_CONFIG.lockTimeoutMs);
    const payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    const orderId = requiredString_(payload.order_id, 'MISSING_ORDER_ID');
    const sheet = orderSheet_();
    verifyHeaders_(sheet);

    const existingRowNumber = findOrderRow_(sheet, orderId);
    if (existingRowNumber) {
      const existing = rowObject_(sheet.getRange(existingRowNumber, 1, 1, SANAD_HEADERS.length).getValues()[0]);
      if (Number(existing['Total Price']) !== Number(payload.total_price) ||
          String(existing.Name || '') !== String(payload.name || '') ||
          String(existing.Phone || '') !== String(payload.phone || '') ||
          String(existing.Address || '') !== String(payload.address || '') ||
          String(existing.Sku || '') !== String(payload.sku || '') ||
          Number(existing.Quantity) !== Number(payload.quantity) ||
          String(existing.Currency || '') !== String(payload.currency || '') ||
          String(existing.Notes || '') !== String(payload.notes || '')) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return jsonResponse_(successResponse_(existing, true));
    }

    const rowNumber = sheet.getLastRow() + 1;
    const row = payloadToRow_(payload);
    sheet.getRange(rowNumber, 2, 1, 8).setNumberFormat('@');
    sheet.getRange(rowNumber, 13).setNumberFormat('@');
    sheet.getRange(rowNumber, 1, 1, SANAD_HEADERS.length).setValues([row]);
    SpreadsheetApp.flush();

    const storedRowNumber = findOrderRow_(sheet, orderId);
    if (!storedRowNumber) throw new Error('ORDER_READBACK_FAILED');
    const stored = rowObject_(sheet.getRange(storedRowNumber, 1, 1, SANAD_HEADERS.length).getValues()[0]);
    if (String(stored['Order ID']) !== orderId || String(stored.Notes || '') !== String(payload.notes || '')) {
      throw new Error('ORDER_READBACK_MISMATCH');
    }

    // Notification failure must never reject an order already stored in Sheets.
    try {
      sendTelegramOrderNotification_(payload);
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError);
    }
    return jsonResponse_(successResponse_(stored, false));
  } catch (error) {
    return jsonResponse_({
      ok: false,
      stored: false,
      contractVersion: SANAD_CONFIG.contractVersion,
      error: error && error.message ? error.message : 'ORDER_STORAGE_FAILED'
    });
  } finally {
    try { lock.releaseLock(); } catch (releaseError) {}
  }
}

function orderSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SANAD_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SANAD_CONFIG.sheetName);
  if (!sheet) throw new Error('ORDER_SHEET_NOT_FOUND');
  return sheet;
}

function verifyHeaders_(sheet) {
  const headers = sheet.getRange(1, 1, 1, SANAD_HEADERS.length).getValues()[0];
  const valid = SANAD_HEADERS.every(function(header, index) {
    return String(headers[index] || '') === header;
  });
  if (!valid) throw new Error('UNEXPECTED_SHEET_SCHEMA');
}

function findOrderRow_(sheet, orderId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const match = sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(orderId)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : null;
}

function payloadToRow_(payload) {
  return [
    payload.order_date, payload.order_id, payload.country, payload.name,
    payload.phone, payload.address, payload.url, payload.sku, payload.product,
    payload.quantity, payload.total_price, payload.currency, payload.notes
  ];
}

function rowObject_(row) {
  const result = {};
  SANAD_HEADERS.forEach(function(header, index) {
    result[header] = row[index] === undefined ? '' : row[index];
  });
  return result;
}

function successResponse_(stored, duplicate) {
  return {
    ok: true,
    stored: true,
    contractVersion: SANAD_CONFIG.contractVersion,
    duplicate: duplicate,
    orderId: String(stored['Order ID']),
    orderTotal: Number(stored['Total Price']),
    currency: String(stored.Currency),
    notes: String(stored.Notes || ''),
    attributionStoredIn: 'Notes'
  };
}

function requiredString_(value, errorCode) {
  const cleaned = value === undefined || value === null ? '' : String(value).trim();
  if (!cleaned) throw new Error(errorCode);
  return cleaned;
}

function sendTelegramOrderNotification_(data) {
  const properties = PropertiesService.getScriptProperties();
  const botToken = properties.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = properties.getProperty('TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) throw new Error('Telegram Bot Token or Chat ID is missing');

  const value = function() {
    for (let index = 0; index < arguments.length; index += 1) {
      const item = arguments[index];
      if (item !== undefined && item !== null && String(item).trim() !== '') return String(item);
    }
    return '—';
  };
  const orderDate = value(data.order_date, data.date, new Date().toISOString());
  const message = [
    '🛒 New Order',
    `🆔 ORDER ID: ${value(data.order_id, data.orderId)}`,
    `👤 NAME: ${value(data.name, data.customer_name)}`,
    `📞 PHONE: ${value(data.phone, data.customer_phone)}`,
    `📍 ADDRESS: ${value(data.address, data.customer_address)}`,
    '',
    `📦 PRODUCT: ${value(data.product)}`,
    `🏷 SKU: ${value(data.sku)}`,
    `🔢 QTY: ${value(data.quantity)}`,
    `💰 TOTAL: ${value(data.total_price, data.price)} ${value(data.currency, 'LYD')}`,
    '',
    `🌍 COUNTRY: ${value(data.country, 'Libya')}`,
    `🕐 DATE: ${orderDate}`,
    `📝 NOTES: ${value(data.notes)}`,
    `🔗 WEBSITE: ${value(data.url)}`
  ].join('\n');

  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
  const responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(`Telegram returned ${responseCode}: ${response.getContentText()}`);
  }
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
