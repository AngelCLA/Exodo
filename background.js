chrome.action.onClicked.addListener(() => chrome.tabs.create({url: chrome.runtime.getURL('index.html')}));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'SOAP') return;
  const allowed = 'https://met.sep.gob.mx/met-ws/services/';
  if (message.endpoint !== allowed) { sendResponse({ok:false,error:'Endpoint no permitido'}); return; }
  (async () => {
    const t0=Date.now();
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),45000);
    try {
      const headers={'Content-Type':'text/xml; charset=utf-8', 'SOAPAction':message.soapAction || '""'};
      const response=await fetch(allowed,{method:'POST',headers,body:message.xml,signal:controller.signal,cache:'no-store',credentials:'omit'});
      const xml=await response.text();
      sendResponse({ok:response.ok,status:response.status,xml,ms:Date.now()-t0});
    } catch (e) {sendResponse({ok:false,uncertain:true,error:e.name==='AbortError'?'Tiempo de espera agotado; el resultado del envío es incierto.':`No se pudo confirmar el resultado del envío: ${e.message}`,ms:Date.now()-t0});}
    finally {clearTimeout(timer);}
  })();
  return true;
});
