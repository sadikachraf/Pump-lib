import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { createOrderId, prepareOrder, summarizeAttribution } from '../api/order.js';

const validInput = {
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  package_id: 1,
  upsell: false,
  upsell_price: 249,
  name: 'Test Customer',
  phone: '0912345678',
  city: 'Tripoli',
  area: 'Test Area',
  url: 'https://example.com/?gclid=test-click',
  attribution: { gclid: 'test-click', utm_source: 'google', utm_campaign: 'demand-gen' }
};

function mockResponse() {
  const state = { statusCode: 200, headers: {}, body: null };
  return {
    state,
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.statusCode = code; return this; },
    json(body) { state.body = body; return this; }
  };
}

test('prepares a COD order with stable ID, authoritative value, and attribution in Notes', () => {
  const first = prepareOrder({ ...validInput, notes: 'Customer note' }, new Date('2026-10-12T10:00:00.000Z'));
  const second = prepareOrder(validInput, new Date('2026-10-13T10:00:00.000Z'));
  assert.equal(first.orderId, second.orderId);
  assert.equal(first.orderId, createOrderId(validInput.idempotency_key));
  assert.equal(first.orderTotal, 345);
  assert.match(first.sheetPayload.notes, /^Customer note \|/);
  assert.match(first.sheetPayload.notes, /Platform=Google Ads/);
  assert.match(first.sheetPayload.notes, /utm_campaign=demand-gen/);
  assert.match(first.sheetPayload.notes, /gclid=test-click/);
  assert.equal(first.sheetPayload.order_status, 'submitted_cod');
  assert.equal(first.sheetPayload.payment_status, 'cash_on_delivery_pending');
});

test('classifies Shorts only from explicit placement evidence', () => {
  assert.doesNotMatch(summarizeAttribution({ gclid: 'abc' }), /YouTube Shorts/);
  assert.match(summarizeAttribution({ gclid: 'abc', utm_content: 'youtube_shorts_creative_1' }), /Placement=YouTube Shorts/);
});

test('classifies Meta, Snapchat, Direct, and Unknown without disturbing click IDs', () => {
  assert.match(summarizeAttribution({ fbclid: 'meta-1' }), /Platform=Meta Ads/);
  assert.match(summarizeAttribution({ ScCid: 'snap-1' }), /Platform=Snapchat Ads/);
  assert.equal(summarizeAttribution({}), 'Platform=Direct');
  assert.match(summarizeAttribution({ utm_source: 'newsletter' }), /Platform=Unknown/);
});

test('adds the deployed upsell price to the authoritative order total', () => {
  const order = prepareOrder({ ...validInput, package_id: 2, upsell: true }, new Date());
  assert.equal(order.orderTotal, 848);
  assert.equal(order.quantity, 3);
});

test('rejects invalid form data before contacting storage', async () => {
  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { fetchCalls += 1; throw new Error('should not run'); };
  const res = mockResponse();
  await handler({ method: 'POST', body: { ...validInput, phone: '123' } }, res);
  global.fetch = originalFetch;
  assert.equal(res.state.statusCode, 400);
  assert.equal(res.state.body.ok, false);
  assert.equal(fetchCalls, 0);
});

test('accepts and verifies the durable Apps Script acknowledgment', async () => {
  const originalFetch = global.fetch;
  let storedPayload;
  global.fetch = async (_url, options) => {
    storedPayload = JSON.parse(options.body);
    return { ok: true, text: async () => JSON.stringify({
      ok: true, stored: true, contractVersion: 'sanad-orders-v2', duplicate: false,
      orderId: storedPayload.order_id, orderTotal: storedPayload.total_price,
      currency: 'LYD', notes: storedPayload.notes, attributionStoredIn: 'Notes'
    }) };
  };
  const res = mockResponse();
  await handler({ method: 'POST', body: { ...validInput, idempotency_key: 'success-key-1234567890' } }, res);
  global.fetch = originalFetch;
  assert.equal(res.state.statusCode, 201);
  assert.equal(res.state.body.orderId, storedPayload.order_id);
  assert.equal(res.state.body.paymentStatus, 'cash_on_delivery_pending');
  assert.equal(res.state.body.durableIdempotency, true);
});

test('rejects the legacy response because it cannot prove durable storage', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => 'Success' });
  const res = mockResponse();
  await handler({ method: 'POST', body: { ...validInput, idempotency_key: 'legacy-success-key-1234' } }, res);
  global.fetch = originalFetch;
  assert.equal(res.state.statusCode, 502);
  assert.equal(res.state.body.ok, false);
});

test('does not report conversion-ready success when storage fails', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, text: async () => 'upstream unavailable' });
  const res = mockResponse();
  await handler({ method: 'POST', body: { ...validInput, idempotency_key: 'failure-key-1234567890' } }, res);
  global.fetch = originalFetch;
  assert.equal(res.state.statusCode, 502);
  assert.deepEqual(res.state.body, { ok: false, error: 'ORDER_SUBMISSION_FAILED' });
});

test('fails closed when a durable acknowledgment does not match Notes', async () => {
  const originalFetch = global.fetch;
  const prepared = prepareOrder(validInput);
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({
    ok: true, stored: true, contractVersion: 'sanad-orders-v2', duplicate: false,
    orderId: prepared.orderId, orderTotal: prepared.orderTotal, currency: 'LYD', notes: 'wrong'
  }) });
  const res = mockResponse();
  await handler({ method: 'POST', body: validInput }, res);
  global.fetch = originalFetch;
  assert.equal(res.state.statusCode, 502);
});

test('accepts a durable duplicate acknowledgment', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    return { ok: true, text: async () => JSON.stringify({
      ok: true, stored: true, contractVersion: 'sanad-orders-v2', duplicate: true,
      orderId: payload.order_id, orderTotal: payload.total_price,
      currency: payload.currency, notes: payload.notes
    }) };
  };
  const res = mockResponse();
  await handler({ method: 'POST', body: { ...validInput, idempotency_key: 'durable-duplicate-key-123' } }, res);
  global.fetch = originalFetch;
  assert.equal(res.state.statusCode, 200);
  assert.equal(res.state.body.duplicate, true);
  assert.equal(res.state.body.durableIdempotency, true);
});
