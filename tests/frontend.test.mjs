import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('installs one Google Ads tag and preserves all existing Meta pixels', () => {
  assert.equal((html.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
  assert.match(html, /gtag\('config', 'AW-17684707346'\)/);
  for (const pixel of ['778731385018899', '1298885441635850', '1000479556408931']) {
    assert.match(html, new RegExp(`fbq\\('init','${pixel}'\\)`));
  }
});

test('conversion uses the correct label and occurs only after awaited order success', () => {
  assert.equal((html.match(/gtag\('event','conversion'/g) || []).length, 1);
  assert.match(html, /AW-17684707346\/zU8ACJ-ZoZodEJLw3PBB/);
  assert.match(html, /currency:'LYD',transaction_id:orderId/);
  const finalizer = html.slice(html.indexOf('async function finalizeOrder'), html.indexOf('function acceptUpsell'));
  assert.ok(finalizer.indexOf('await postOrder(payload)') < finalizer.indexOf('fireGoogleAdsConversion(result.orderTotal,result.orderId)'));
  assert.doesNotMatch(html, /beforeunload/);
});

test('frontend prevents duplicate submits and duplicate conversion sends', () => {
  assert.match(html, /if\(orderSubmitting\|\|pendingOrder\)return/);
  assert.match(html, /if\(!pendingOrder\|\|orderSubmitting\|\|orderSent\)return/);
  assert.match(html, /sanad_google_ads_conversion_/);
  assert.match(html, /sessionStorage\.getItem\('sanad_order_idempotency_key'\)/);
});

test('mobile viewport and COD messaging remain present', () => {
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0"/);
  assert.match(html, /الدفع عند الاستلام/);
  assert.match(html, /سيتم الاتصال بك قريباً لتأكيد الطلب والعنوان/);
});
