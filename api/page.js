const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzfZDgIcM8TmzY9XgFE349EM4yMcE0U3TB70NpiXP_fF7RMUYxPxLIwKW_4Qg8m4XJc/exec';
const RAW_INDEX_URL = 'https://raw.githubusercontent.com/sadikachraf/Pump-lib/main/index.html';

export default async function handler(req, res) {
  try {
    const response = await fetch(RAW_INDEX_URL, { cache: 'no-store' });
    if (!response.ok) {
      return res.status(502).send('Unable to load landing page');
    }

    let html = await response.text();

    const telegramBridge = `
<script>
(function(){
  var SHEET_URL = '${SHEET_URL}';

  function sendToTelegram(payload, useBeacon){
    try{
      var body = JSON.stringify(payload || {});
      if(useBeacon && navigator.sendBeacon){
        var blob = new Blob([body], {type:'application/json;charset=UTF-8'});
        navigator.sendBeacon('/api/telegram-order', blob);
        return;
      }
      fetch('/api/telegram-order', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:body,
        keepalive:true
      }).catch(function(){});
    }catch(e){}
  }

  window.postOrder = function(payload, useBeacon){
    try{
      var sheetBody = JSON.stringify(payload || {});
      if(useBeacon && navigator.sendBeacon){
        var sheetBlob = new Blob([sheetBody], {type:'text/plain;charset=UTF-8'});
        navigator.sendBeacon(SHEET_URL, sheetBlob);
      }else{
        fetch(SHEET_URL, {
          method:'POST',
          mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=UTF-8'},
          body:sheetBody,
          keepalive:true
        }).catch(function(){});
      }
    }catch(e){}

    sendToTelegram(payload, !!useBeacon);
  };
})();
</script>`;

    html = html.replace('</body>', telegramBridge + '\n</body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Landing page error');
  }
}
