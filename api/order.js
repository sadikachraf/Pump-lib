import { createHash } from 'node:crypto';

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzfZDgIcM8TmzY9XgFE349EM4yMcE0U3TB70NpiXP_fF7RMUYxPxLIwKW_4Qg8m4XJc/exec';
const UPSELL_PRICES = new Set([249, 254]);
const PACKAGES = {
  1: { sku: 'AS41600', offer: 'قطعة واحدة', price: 345, quantity: 1 },
  2: { sku: 'AS41600', offer: 'عرض قطعتين', price: 599, quantity: 2 },
  3: { sku: 'AS41600', offer: 'عرض 3 قطع', price: 849, quantity: 3 }
};
const ATTRIBUTION_KEYS = [
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'ScCid', 'scclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'placement', 'utm_placement', 'network'
];

function clean(value, maxLength = 250) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') return JSON.parse(body);
  return {};
}

export function createOrderId(idempotencyKey) {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 20).toUpperCase();
  return `PUMP-LY-${digest}`;
}

function isPaidMedium(value) {
  return /^(cpc|ppc|paid|paid_social|paid-social|display|video|demandgen|demand_gen)$/i.test(clean(value, 80));
}

function includesYouTubeShorts(value) {
  const normalized = clean(value, 250).toLowerCase().replace(/[\s_]+/g, '-');
  return normalized.includes('youtube-shorts') || normalized.includes('youtubeshorts') ||
    normalized.includes('yt-shorts') || (normalized.includes('youtube') && normalized.includes('shorts'));
}

export function summarizeAttribution(attribution) {
  const last = key => clean(attribution[`last_${key}`] || attribution[key], 250);
  const source = last('utm_source');
  const medium = last('utm_medium');
  const googleClickId = last('gclid') || last('gbraid') || last('wbraid');
  const metaClickId = last('fbclid');
  const snapchatClickId = last('ScCid') || last('scclid');
  let platform = 'Unknown';

  if (googleClickId || (/^(google|youtube)$/i.test(source) && isPaidMedium(medium))) platform = 'Google Ads';
  else if (metaClickId || (/^(facebook|instagram|meta|fb)$/i.test(source) && isPaidMedium(medium))) platform = 'Meta Ads';
  else if (snapchatClickId || (/^(snapchat|snap)$/i.test(source) && isPaidMedium(medium))) platform = 'Snapchat Ads';
  else if (!source && !medium && !last('utm_campaign') && !last('utm_content') && !googleClickId && !metaClickId && !snapchatClickId) platform = 'Direct';

  const placementEvidence = [last('placement'), last('utm_placement'), last('utm_content'), last('utm_campaign'), last('network')];
  const placement = placementEvidence.some(includesYouTubeShorts) ? 'YouTube Shorts' : '';
  return [
    `Platform=${platform}`,
    placement ? `Placement=${placement}` : '',
    source ? `utm_source=${source}` : '',
    medium ? `utm_medium=${medium}` : '',
    last('utm_campaign') ? `utm_campaign=${last('utm_campaign')}` : '',
    last('utm_content') ? `utm_content=${last('utm_content')}` : '',
    last('gclid') ? `gclid=${last('gclid')}` : '',
    last('gbraid') ? `gbraid=${last('gbraid')}` : '',
    last('wbraid') ? `wbraid=${last('wbraid')}` : '',
    metaClickId ? `fbclid=${metaClickId}` : '',
    snapchatClickId ? `snap_click_id=${snapchatClickId}` : ''
  ].filter(Boolean).join('; ');
}

export function prepareOrder(input, now = new Date()) {
  const packageId = Number(input.package_id);
  const selectedPackage = PACKAGES[packageId];
  const idempotencyKey = clean(input.idempotency_key, 128);
  const name = clean(input.name, 120);
  const phone = clean(input.phone, 30).replace(/\s/g, '');
  const city = clean(input.city, 80);
  const area = clean(input.area, 180);
  const includeUpsell = input.upsell === true;
  const upsellPrice = Number(input.upsell_price);

  if (!selectedPackage) throw new Error('INVALID_PACKAGE');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) throw new Error('INVALID_IDEMPOTENCY_KEY');
  if (!name || !city || !area) throw new Error('MISSING_REQUIRED_FIELDS');
  const normalizedPhone = phone.startsWith('+218') ? `0${phone.slice(4)}` : phone.startsWith('00218') ? `0${phone.slice(5)}` : phone;
  if (!/^09\d{8}$/.test(normalizedPhone)) throw new Error('INVALID_PHONE');
  if (includeUpsell && !UPSELL_PRICES.has(upsellPrice)) throw new Error('INVALID_UPSELL_PRICE');

  const orderId = createOrderId(idempotencyKey);
  const orderTotal = selectedPackage.price + (includeUpsell ? upsellPrice : 0);
  const quantity = selectedPackage.quantity + (includeUpsell ? 1 : 0);
  const timestamp = now.toISOString();
  const attribution = input.attribution && typeof input.attribution === 'object' ? input.attribution : {};
  const safeAttribution = {};
  ATTRIBUTION_KEYS.forEach(key => {
    const firstValue = clean(attribution[key], 250);
    const lastValue = clean(attribution[`last_${key}`], 250);
    if (firstValue) safeAttribution[key] = firstValue;
    if (lastValue) safeAttribution[`last_${key}`] = lastValue;
  });
  safeAttribution.landing_page = clean(attribution.landing_page || input.url, 1000);
  safeAttribution.captured_at = clean(attribution.captured_at, 40);

  const product = `مضخة نقل السوائل - ${selectedPackage.offer}${includeUpsell ? ' + مضخة ثانية بسعر خاص' : ''}`;
  const existingNotes = clean(input.notes, 1000);
  const orderNotes = `مدينة: ${city} | منطقة: ${area} | عرض: ${selectedPackage.offer} | Upsell: ${includeUpsell ? `نعم | مضخة ثانية ${upsellPrice} د.ل` : 'لا'}`;
  const attributionNotes = `Attribution: ${summarizeAttribution(safeAttribution)}`;
  const notes = [existingNotes, orderNotes, attributionNotes].filter(Boolean).join(' | ').slice(0, 4000);
  const sheetPayload = {
    order_date: timestamp,
    orderDate: timestamp,
    date: timestamp,
    order_id: orderId,
    orderId,
    idempotency_key: idempotencyKey,
    order_status: 'submitted_cod',
    payment_status: 'cash_on_delivery_pending',
    country: 'Libya',
    name,
    customer_name: name,
    phone: normalizedPhone,
    customer_phone: normalizedPhone,
    city,
    address: `${city} - ${area}`,
    customer_address: `${city} - ${area}`,
    url: clean(input.url, 1000),
    sku: selectedPackage.sku,
    product,
    quantity,
    total_price: orderTotal,
    totalPrice: orderTotal,
    price: orderTotal,
    currency: 'LYD',
    notes,
    attribution: safeAttribution,
    ...safeAttribution
  };

  return { orderId, orderTotal, quantity, sku: selectedPackage.sku, sheetPayload };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const input = parseBody(req.body);
    const prepared = prepareOrder(input);

    const upstream = await fetch(SHEET_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(prepared.sheetPayload),
      signal: AbortSignal.timeout(12000)
    });
    const upstreamBody = await upstream.text();
    let acknowledgment = null;
    try {
      acknowledgment = JSON.parse(upstreamBody);
    } catch (parseError) {}
    if (!upstream.ok || !acknowledgment || acknowledgment.contractVersion !== 'sanad-orders-v2' ||
        acknowledgment.ok !== true || acknowledgment.stored !== true) {
      throw new Error('ORDER_STORAGE_FAILED');
    }
    if (acknowledgment.orderId !== prepared.orderId ||
        Number(acknowledgment.orderTotal) !== prepared.orderTotal ||
        acknowledgment.currency !== 'LYD' ||
        String(acknowledgment.notes || '') !== prepared.sheetPayload.notes) {
      throw new Error('ORDER_STORAGE_MISMATCH');
    }

    const result = {
      ok: true,
      orderId: prepared.orderId,
      orderTotal: prepared.orderTotal,
      currency: 'LYD',
      quantity: prepared.quantity,
      sku: prepared.sku,
      orderStatus: 'submitted_cod',
      paymentStatus: 'cash_on_delivery_pending',
      duplicate: acknowledgment.duplicate === true,
      durableIdempotency: true
    };
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    const clientErrors = new Set(['INVALID_PACKAGE', 'INVALID_IDEMPOTENCY_KEY', 'MISSING_REQUIRED_FIELDS', 'INVALID_PHONE', 'INVALID_UPSELL_PRICE']);
    const message = error instanceof Error ? error.message : 'ORDER_SUBMISSION_FAILED';
    const status = clientErrors.has(message) || error instanceof SyntaxError ? 400 : 502;
    return res.status(status).json({ ok: false, error: status === 400 ? message : 'ORDER_SUBMISSION_FAILED' });
  }
}
