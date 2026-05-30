const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzfZDgIcM8TmzY9XgFE349EM4yMcE0U3TB70NpiXP_fF7RMUYxPxLIwKW_4Qg8m4XJc/exec';
const RAW_INDEX_URL = 'https://raw.githubusercontent.com/sadikachraf/Pump-lib/main/index.html';

export default async function handler(req, res) {
  try {
    const response = await fetch(RAW_INDEX_URL, { cache: 'no-store' });
    if (!response.ok) {
      return res.status(502).send('Unable to load landing page');
    }

    let html = await response.text();

    const originalPostOrder = "function postOrder(payload,useBeacon=false){try{if(useBeacon&&navigator.sendBeacon){const blob=new Blob([JSON.stringify(payload)],{type:'text/plain;charset=UTF-8'});navigator.sendBeacon(SHEET_URL,blob);return}fetch(SHEET_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)}).catch(()=>{})}catch(e){}}";

    const telegramPostOrder = "function postOrder(payload,useBeacon=false){try{const telegramBody=JSON.stringify(payload||{});if(useBeacon&&navigator.sendBeacon){const telegramBlob=new Blob([telegramBody],{type:'application/json;charset=UTF-8'});navigator.sendBeacon('/api/telegram-order',telegramBlob)}else{fetch('/api/telegram-order',{method:'POST',headers:{'Content-Type':'application/json'},body:telegramBody,keepalive:true}).catch(()=>{})}}catch(e){}try{if(useBeacon&&navigator.sendBeacon){const blob=new Blob([JSON.stringify(payload)],{type:'text/plain;charset=UTF-8'});navigator.sendBeacon(SHEET_URL,blob);return}fetch(SHEET_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{})}catch(e){}}";

    html = html.replace(originalPostOrder, telegramPostOrder);

    // Keep the SKU fixed even when an upsell is accepted.
    html = html.replace("pendingOrder.sku+='+UPSELL-1';", "pendingOrder.sku='AS41600';");

    // Upsell improvement only: copy, visual styling, and displayed/charged upsell price.
    // This does not touch pixels, Google Sheets, Telegram, or order submission wiring.
    html = html
      .replace('const UPSELL_PRICE = 254;', 'const UPSELL_PRICE = 249;')
      .replace(/254 د\.ل/g, '249 د.ل')
      .replace(/254 دينار/g, '249 دينار')
      .replace(/توفر 91 دينار/g, 'توفر 96 دينار')
      .replace(/توفر 91 د\.ل/g, 'توفر 96 د.ل')
      .replace(/مضخة ثانية 254 د\.ل/g, 'مضخة ثانية 249 د.ل')
      .replace('🎁 عرض خاص يظهر مرة واحدة فقط بعد الطلب', '🎁 عرض خاص قبل تجهيز طلبك')
      .replace('بما أنك طلبت الآن، تقدر تضيف مضخة ثانية لنفس الطلب ونفس التوصيل بسعر أقل من سعر القطعة العادي.', 'خلي وحدة في السيارة ووحدة عند المولد أو في الحوش. بدل ما تنقل نفس المضخة كل مرة.')
      .replace('بدل 345 د.ل — توفر 96 دينار', 'بدل 345 د.ل — وفر 96 د.ل الآن')
      .replace('نعم، أضف المضخة الثانية بـ 249 د.ل', 'أضف الثانية بـ 249 د.ل')
      .replace('لا شكراً، أرسل طلبي الأصلي فقط', 'لا، قطعة واحدة فقط')
      .replace('إذا سكرت الصفحة، سيتم تسجيل طلبك الأصلي فقط.', 'نفس الطلب ونفس التوصيل.');

    const oldUpsellImage = '<img src="images/8.webp" alt="عرض مضخة ثانية"><h3>أضف مضخة ثانية بـ 249 دينار فقط</h3>';
    const newUpsellImage = '<img src="images/8.webp" alt="عرض مضخة ثانية"><div class="upsell-chip">🔥 عرض يظهر مرة واحدة</div><h3>أضف مضخة ثانية بـ 249 د.ل فقط</h3>';
    html = html.replace(oldUpsellImage, newUpsellImage);

    const oldUpsellActions = '<div class="upsell-actions"><button class="upsell-accept" onclick="acceptUpsell()">أضف الثانية بـ 249 د.ل</button><button class="upsell-decline" onclick="declineUpsell()">لا، قطعة واحدة فقط</button></div>';
    const newUpsellActions = '<ul class="upsell-benefits"><li>للسيارة</li><li>للمولد أو البيت</li><li>نفس التوصيل</li></ul><div class="upsell-actions"><button class="upsell-accept" onclick="acceptUpsell()">أضف الثانية بـ 249 د.ل</button><button class="upsell-decline" onclick="declineUpsell()">لا، قطعة واحدة فقط</button></div>';
    html = html.replace(oldUpsellActions, newUpsellActions);

    const upsellStyle = `
<style>
  .upsell-overlay{align-items:flex-start!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:10px 12px 22px!important}
  .upsell-card{max-height:none!important;margin:0 auto 18px!important;border:1px solid rgba(255,255,255,.18);box-shadow:0 24px 70px rgba(0,0,0,.36)!important}
  .upsell-top{background:linear-gradient(135deg,#111 0%,#2b1708 45%,var(--orange) 100%)!important;padding:12px 42px 12px 14px!important;font-size:13px;line-height:1.35}
  .upsell-body{padding:12px 14px 14px!important;background:linear-gradient(180deg,#fff 0%,#fff8f0 100%)}
  .upsell-body img{max-height:155px!important;object-fit:contain!important;border:1px solid #f3dfca;box-shadow:0 10px 24px rgba(0,0,0,.08);margin-bottom:8px!important}
  .upsell-chip{display:inline-flex;align-items:center;justify-content:center;background:#111;color:#fff;border-radius:999px;padding:5px 10px;margin:0 auto 7px;font-size:11px;font-weight:900;box-shadow:0 7px 18px rgba(0,0,0,.14)}
  .upsell-body h3{font-size:24px!important;line-height:1.18;margin:0 0 7px!important;color:#111}
  .upsell-body p{font-size:13px!important;line-height:1.65!important;margin-bottom:8px!important}
  .upsell-benefits{list-style:none;display:grid!important;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0 10px;text-align:center}
  .upsell-benefits li{background:#fff;border:1px solid #fed7aa;border-radius:11px;padding:7px 6px;font-size:11.5px;font-weight:900;color:#3b2a1d}
  .upsell-benefits li::before{content:'✓';color:var(--green);font-weight:900;margin-left:4px}
  .upsell-price{background:#111!important;color:#fff;border-color:#2f2f2f!important;box-shadow:0 12px 28px rgba(0,0,0,.12);padding:10px!important;margin:8px 0!important;border-radius:15px!important}
  .upsell-price strong{color:#fff!important;font-size:32px!important}.upsell-price span{color:#ffd7b0!important;font-size:12px!important}
  .upsell-actions{gap:7px!important;margin-top:8px!important}.upsell-accept{font-size:16px!important;padding:14px 15px!important;background:linear-gradient(135deg,var(--orange),#ff8a1c)!important}
  .upsell-decline{color:#8a8a8a!important;text-decoration:underline;text-underline-offset:3px;font-size:11px!important}
  .mini{font-size:10.5px!important;margin-top:4px!important}
  @media(max-width:560px){.upsell-overlay{padding-top:6px!important}.upsell-card{width:calc(100vw - 24px)!important;border-radius:18px!important}.upsell-body img{max-height:135px!important}.upsell-body h3{font-size:21px!important}.upsell-benefits{grid-template-columns:1fr 1fr 1fr!important}.upsell-price strong{font-size:29px!important}.upsell-top{font-size:12px!important}}
  @media(max-height:720px){.upsell-body img{max-height:110px!important}.upsell-body h3{font-size:19px!important}.upsell-body p{font-size:12px!important;line-height:1.45!important}.upsell-benefits li{padding:6px 4px;font-size:10.5px}.upsell-price strong{font-size:27px!important}.upsell-accept{padding:12px 14px!important;font-size:15px!important}}
</style>`;
    html = html.replace('</head>', upsellStyle + '\n</head>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Landing page error');
  }
}
