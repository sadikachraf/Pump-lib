import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const headers = [
  'Order Date', 'Order ID', 'Country', 'Name', 'Phone', 'Address', 'Url',
  'Sku', 'Product', 'Quantity', 'Total Price', 'Currency', 'Notes'
];

function createSharedStorage() {
  const rows = [headers.slice()];
  const lockStats = { waits: 0, releases: 0 };
  const lock = {
    waitLock(timeout) { assert.equal(timeout, 30000); lockStats.waits += 1; },
    releaseLock() { lockStats.releases += 1; }
  };
  function ensureCell(row, column) {
    while (rows.length < row) rows.push([]);
    while (rows[row - 1].length < column) rows[row - 1].push('');
  }
  const sheet = {
    getLastRow() { return rows.length; },
    getRange(startRow, startColumn, rowCount = 1, columnCount = 1) {
      return {
        getValues() {
          return Array.from({ length: rowCount }, (_, rowOffset) =>
            Array.from({ length: columnCount }, (_, columnOffset) => {
              ensureCell(startRow + rowOffset, startColumn + columnOffset);
              return rows[startRow + rowOffset - 1][startColumn + columnOffset - 1];
            })
          );
        },
        setValues(values) {
          values.forEach((row, rowOffset) => row.forEach((value, columnOffset) => {
            ensureCell(startRow + rowOffset, startColumn + columnOffset);
            rows[startRow + rowOffset - 1][startColumn + columnOffset - 1] = value;
          }));
          return this;
        },
        setNumberFormat() { return this; },
        createTextFinder(searchValue) {
          let exact = false;
          return {
            matchEntireCell(value) { exact = value; return this; },
            findNext() {
              for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
                const value = String(rows[startRow + rowOffset - 1]?.[startColumn - 1] ?? '');
                if (exact ? value === searchValue : value.includes(searchValue)) return { getRow: () => startRow + rowOffset };
              }
              return null;
            }
          };
        }
      };
    }
  };
  return { rows, lockStats, lock, sheet, telegramCalls: 0 };
}

function createExecution(storage) {
  const context = {
    JSON, Object, Number, String, Error,
    LockService: { getScriptLock: () => storage.lock },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: key => key === 'TELEGRAM_BOT_TOKEN' ? 'test-token' : 'test-chat' })
    },
    UrlFetchApp: {
      fetch() {
        storage.telegramCalls += 1;
        return { getResponseCode: () => 200, getContentText: () => 'ok' };
      }
    },
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, '14UBAS9ZpFgL92PFrBHQswknnp9Lxt4VTLFSEbGFZAmc');
        return { getSheetByName: name => name === 'RETINOL YELLOW' ? storage.sheet : null };
      },
      flush() {}
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content) { return { content, setMimeType() { return this; } }; }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    post: payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).content),
    get: () => JSON.parse(context.doGet().content)
  };
}

function validPayload() {
  return {
    order_date: '2026-10-12T10:00:00.000Z', order_id: 'PUMP-LY-DURABLE-TEST-001',
    country: 'Libya', name: 'Test Customer', phone: '0912345678',
    address: 'Tripoli - Test Area', url: 'https://example.com/?gclid=test-gclid',
    sku: 'AS41600', product: 'مضخة نقل السوائل - قطعة واحدة', quantity: 1,
    total_price: 345, currency: 'LYD',
    notes: 'Existing note | Attribution: Platform=Google Ads; utm_source=google; gclid=test-gclid'
  };
}

test('keeps the existing 13-column schema and persists attribution in Notes', () => {
  const storage = createSharedStorage();
  const app = createExecution(storage);
  assert.equal(app.get().ready, true);
  const response = app.post(validPayload());
  assert.equal(response.ok, true);
  assert.equal(response.attributionStoredIn, 'Notes');
  assert.equal(response.notes, validPayload().notes);
  assert.equal(storage.rows[0].length, 13);
  assert.equal(storage.rows[1].length, 13);
  assert.equal(storage.rows[1][12], validPayload().notes);
});

test('two independent executions sharing the sheet append the order only once', () => {
  const storage = createSharedStorage();
  const firstInstance = createExecution(storage);
  const secondInstance = createExecution(storage);
  assert.equal(firstInstance.post(validPayload()).duplicate, false);
  assert.equal(secondInstance.post(validPayload()).duplicate, true);
  assert.equal(storage.rows.length, 2);
  assert.equal(storage.lockStats.waits, 2);
  assert.equal(storage.lockStats.releases, 2);
  assert.equal(storage.telegramCalls, 1);
});

test('same order ID with conflicting order data is rejected', () => {
  const storage = createSharedStorage();
  const app = createExecution(storage);
  assert.equal(app.post(validPayload()).ok, true);
  const conflict = app.post({ ...validPayload(), phone: '0999999999' });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error, 'IDEMPOTENCY_CONFLICT');
  assert.equal(storage.rows.length, 2);
});

test('schema mismatch fails before an order is appended', () => {
  const storage = createSharedStorage();
  storage.rows[0][12] = 'Changed Notes Header';
  const app = createExecution(storage);
  assert.equal(app.get().ready, false);
  const result = app.post(validPayload());
  assert.equal(result.ok, false);
  assert.equal(result.error, 'UNEXPECTED_SHEET_SCHEMA');
  assert.equal(storage.rows.length, 1);
});
