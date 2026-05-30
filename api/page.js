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

    // Upsell improvement only: copy, visual styling, and displayed/charged upsell price.
    // This does not touch pixels, Google Sheets, Telegram, or order submission wiring.
    html = html
      .replace('const UPSELL_PRICE = 254;', 'const UPSELL_PRICE = 249;')
      .replace(/254 د\.ل/g, '249 د.ل')
      .replace(/توفر 91 دينار/g, 'توفر 96 دينار')
      .replace(/مضخة ثانية 254 د\.ل/g, 'مضخة ثانية 249 د.ل')
      .replace('🎁 عرض خاص يظهر مرة واحدة فقط بعد الطلب', '🎁 عرض خاص قبل تجهيز طلبك — يظهر مرة واحدة فقط')
      .replace('أضف مضخة ثانية بـ 249 دينار فقط', 'أضف مضخة ثانية بـ 249 دينار فقط')
      .replace('بما أنك طلبت الآن، تقدر تضيف مضخة ثانية لنفس الطلب ونفس التوصيل بسعر أقل من سعر القطعة العادي.', 'خلي وحدة في السيارة ووحدة في الحوش، عند المولد أو في الورشة. بدل ما تنقل نفس المضخة كل مرة، خلي كل مكان عنده وحدة جاهزة.')
      .replace('بدل 345 د.ل — توفر 96 دينار', 'بدل 345 د.ل لو طلبتها لاحقاً — وفر 96 د.ل الآن')
      .replace('نعم، أضف المضخة الثانية بـ 249 د.ل', 'نعم، أضف الثانية ووفّر 96 د.ل')
      .replace('لا شكراً، أرسل طلبي الأصلي فقط', 'لا، أريد قطعة واحدة فقط')
      .replace('إذا سكرت الصفحة، سيتم تسجيل طلبك الأصلي فقط.', 'نفس الطلب، نفس التوصيل، بدون أي اتصال إضافي.');

    const oldUpsellImage = '<img src="images/8.webp" alt="عرض مضخة ثانية"><h3>أضف مضخة ثانية بـ 249 دينار فقط</h3>';
    const newUpsellImage = '<img src="images/8.webp" alt="عرض مضخة ثانية"><div class="upsell-chip">🔥 ترقية الطلب الأكثر اختياراً</div><h3>لا تخلي المضخة في مكان واحد فقط</h3><div class="upsell-sub">أضف الثانية بـ <b>249 د.ل فقط</b></div>';
    html = html.replace(oldUpsellImage, newUpsellImage);

    const oldUpsellActions = '<div class="upsell-actions"><button class="upsell-accept" onclick="acceptUpsell()">نعم، أضف الثانية ووفّر 96 د.ل</button><button class="upsell-decline" onclick="declineUpsell()">لا، أريد قطعة واحدة فقط</button></div>';
    const newUpsellActions = '<ul class="upsell-benefits"><li>وحدة للطوارئ في السيارة</li><li>وحدة للمولد أو البيت</li><li>مناسبة للورشة أو المزرعة</li><li>نفس التوصيل ونفس الطلب</li></ul><div class="upsell-actions"><button class="upsell-accept" onclick="acceptUpsell()">نعم، أضف الثانية ووفّر 96 د.ل</button><button class="upsell-decline" onclick="declineUpsell()">لا، أريد قطعة واحدة فقط</button></div>';
    html = html.replace(oldUpsellActions, newUpsellActions);

    const upsellStyle = `
<style>
  .upsell-card{border:1px solid rgba(255,255,255,.18);box-shadow:0 34px 110px rgba(0,0,0,.42)!important}
  .upsell-top{background:linear-gradient(135deg,#111 0%,#2b1708 45%,var(--orange) 100%)!important;padding:17px 46px 17px 18px!important;font-size:15px;line-height:1.45}
  .upsell-body{padding:22px 18px 18px!important;background:linear-gradient(180deg,#fff 0%,#fff8f0 100%)}
  .upsell-body img{border:1px solid #f3dfca;box-shadow:0 14px 38px rgba(0,0,0,.10)}
  .upsell-chip{display:inline-flex;align-items:center;justify-content:center;background:#111;color:#fff;border-radius:999px;padding:7px 13px;margin:2px auto 10px;font-size:12px;font-weight:900;box-shadow:0 9px 24px rgba(0,0,0,.16)}
  .upsell-body h3{font-size:27px!important;line-height:1.2;margin-bottom:6px;color:#111}
  .upsell-sub{font-size:18px;font-weight:900;color:#7c2d12;margin-bottom:10px}.upsell-sub b{color:var(--orange2);font-size:24px}
  .upsell-benefits{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0 14px;text-align:right}
  .upsell-benefits li{background:#fff;border:1px solid #fed7aa;border-radius:13px;padding:9px 10px;font-size:12.5px;font-weight:900;color:#3b2a1d}
  .upsell-benefits li::before{content:'✓';color:var(--green);font-weight:900;margin-left:6px}
  .upsell-price{background:#111!important;color:#fff;border-color:#2f2f2f!important;box-shadow:0 16px 38px rgba(0,0,0,.13)}
  .upsell-price strong{color:#fff!important;font-size:38px!important}.upsell-price span{color:#ffd7b0!important}
  .upsell-accept{font-size:18px!important;padding:17px 18px!important;background:linear-gradient(135deg,var(--orange),#ff8a1c)!important}
  .upsell-decline{color:#8a8a8a!important;text-decoration:underline;text-underline-offset:3px}
  @media(max-width:560px){.upsell-benefits{grid-template-columns:1fr}.upsell-body h3{font-size:23px!important}.upsell-sub b{font-size:21px}}
</style>`;
    html = html.replace('</head>', upsellStyle + '\n</head>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Landing page error');
  }
}
