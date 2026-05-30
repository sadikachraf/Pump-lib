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

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Landing page error');
  }
}
