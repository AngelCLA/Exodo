const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');

function page({response,sendError,storageSetError=false,confirm=true,deferred=false}={}){
 const elements=new Map(),data={};let sends=0,sets=0,failStorage=storageSetError,release;
 const responsePanel={attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},getAttribute(k){return this.attrs[k]}};
 function element(id=''){ 
  const listeners={},classes=new Set();
  return {id,hidden:false,disabled:false,value:'',textContent:'',dataset:{},tagName:'BUTTON',
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)on?classes.add(c):classes.delete(c)}},
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]},addEventListener(k,fn){listeners[k]=fn},
   async click(){if(!this.disabled)await listeners.click?.({target:this})},fire(k,extra={}){return listeners[k]?.({target:this,preventDefault(){},...extra})},
   closest(){return responsePanel},replaceChildren(){},append(){},focus(){},contains(){return false},
   set innerHTML(markup){this.markup=markup;for(const m of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))elements.set(m[1],element(m[1]))}
  };
 }
 const html=fs.readFileSync('index.html','utf8');
 for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element(m[1]));
 const navs=['carga','consulta','descarga','cancela','institucion','historial'].map(tab=>Object.assign(element(),{dataset:{tab}}));
 const node=(name,text)=>({localName:name,textContent:text,children:[]});
 const document={activeElement:null,getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:()=>element(),createTextNode:text=>({textContent:text})};
 const context={document,console,TextEncoder,TextDecoder,Uint8Array,btoa,atob,crypto:Object.assign(webcrypto,{randomUUID:()=> 'record-id'}),DOMException,
  confirm:()=>confirm,localStorage:{getItem(){return null},setItem(){}},
  DOMParser:class{constructor(){}parseFromString(xml){return {querySelector:()=>null,getElementsByTagName:()=>[...xml.matchAll(/<([\w:]+)[^>]*>([^<]*)<\/[\w:]+>/g)].map(m=>node(m[1].split(':').pop(),m[2]))}}},
  chrome:{storage:{local:{async get(key){return {[key]:data[key]}},async set(values){sets++;if(failStorage)throw Error('storage unavailable');Object.assign(data,values)},async remove(key){delete data[key]}}},runtime:{async sendMessage(){sends++;if(sendError)throw Error(sendError);if(deferred)return new Promise(resolve=>{release=()=>resolve(response)});return response}}}
 };
 vm.runInNewContext(source,context);
 return {el:id=>elements.get(id),nav:tab=>navs.find(n=>n.dataset.tab===tab),data,failStorage(on=true){failStorage=on},release(){release?.()},snapshot(){return JSON.stringify(data)},get sends(){return sends},get sets(){return sets}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function ready(p){await settle();for(const [id,value] of Object.entries({setupUser:'u',setupPassword:'p',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;await p.el('saveVault').click();await settle()}
async function sendIn(p,tab='consulta'){p.nav(tab).fire('click');await settle();if(tab==='consulta'||tab==='descarga')p.el('numeroLote').value='123';await p.el('submit').click();await settle()}
function assertReset(p){assert.equal(p.el('submit').disabled,false);assert.equal(p.el('preview').disabled,false);assert.equal(p.el('submit').classList.contains('loading'),false);assert.equal(p.el('responseTitle').closest().getAttribute('aria-busy'),undefined)}

for(const malformed of [undefined,null,{},'not-a-worker-reply'])test(`malformed worker reply ${String(malformed)}`,async()=>{
 const p=page({response:malformed});await ready(p);const before=p.snapshot();await sendIn(p);
 assert.equal(p.sends,1);assert.equal(p.snapshot(),before);assert.equal(p.el('response').textContent,'');assert.equal(p.el('status').textContent,'Resultado incierto');assert.match(p.el('summary').textContent,/Consulta la SEP antes de reintentar/);assertReset(p);
});

test('explicit worker rejection is treated as not dispatched',async()=>{
 const p=page({response:{ok:false,error:'Endpoint no permitido'}});await ready(p);const before=p.snapshot();await sendIn(p);
 assert.equal(p.sends,1);assert.equal(p.snapshot(),before);assert.equal(p.el('status').textContent,'No se envió');assert.match(p.el('summary').textContent,/Endpoint no permitido/);assertReset(p);
});

test('explicit uncertain worker response does not mutate history',async()=>{
 const p=page({response:{ok:false,uncertain:true,error:'transport uncertain'}});await ready(p);const before=p.snapshot();await sendIn(p);
 assert.equal(p.snapshot(),before);assert.equal(p.el('status').textContent,'Resultado incierto');assertReset(p);
});

test('in-flight send stays busy and suppresses duplicate dispatch',async()=>{
 const p=page({response:{ok:true,status:200,ms:1,xml:'<respuesta/>'},deferred:true});await ready(p);p.nav('consulta').fire('click');await settle();p.el('numeroLote').value='123';const first=p.el('submit').click();await settle();
 assert.equal(p.sends,1);assert.equal(p.el('submit').disabled,true);assert.equal(p.el('submit').classList.contains('loading'),true);assert.equal(p.el('responseTitle').closest().getAttribute('aria-busy'),'true');await p.el('submit').click();assert.equal(p.sends,1);
 p.release();await first;await settle();assertReset(p);
});

test('declined cancellation does not dispatch for either cancellation form',async()=>{
 for(const tab of ['cancela','institucion']){const p=page({confirm:false});await ready(p);p.nav(tab).fire('click');await settle();p.el('folioControl').value='folio';p.el('motCancelacion').value='motivo';if(tab==='institucion')p.el('cveInstitucion').value='institucion';const before=p.snapshot();await p.el('submit').click();await settle();assert.equal(p.sends,0);assert.equal(p.snapshot(),before);assert.equal(p.el('status').textContent,'');assertReset(p)}
});

test('successful send preserves response and records the returned lot',async()=>{
 const xml='<respuesta><numeroLote>123</numeroLote><codigo>1</codigo></respuesta>';const p=page({response:{ok:true,status:200,ms:4,xml}});await ready(p);await sendIn(p);
 assert.equal(p.el('response').textContent,xml);assert.match(p.el('summary').textContent,/HTTP aceptada/);assert.equal(p.data.history[0].lot,'123');assert.equal(p.sends,1);assertReset(p);
});

test('local validation rejects without dispatch or history write',async()=>{
 const p=page({response:{ok:true,status:200,xml:'<ok/>'}});await ready(p);p.nav('consulta').fire('click');await settle();p.el('numeroLote').value='no-es-lote';await p.el('submit').click();await settle();
 assert.equal(p.sends,0);assert.equal(p.data.history,undefined);assert.equal(p.el('status').textContent,'No se envió');assert.match(p.el('summary').textContent,/entero positivo/);assertReset(p);
});

test('HTTP failure keeps the received XML and records the known response',async()=>{
 const xml='<respuesta><mensaje>Error del servicio</mensaje></respuesta>';const p=page({response:{ok:false,status:500,ms:2,xml,error:'HTTP 500'}});await ready(p);await sendIn(p);
 assert.equal(p.el('response').textContent,xml);assert.match(p.el('summary').textContent,/Error HTTP o SOAP/);assert.equal(p.data.history[0].httpStatus,500);assertReset(p);
});

test('SOAP fault keeps the received response and fault message',async()=>{
 const xml='<Fault><faultstring>Solicitud inválida</faultstring></Fault>';const p=page({response:{ok:false,status:500,ms:2,xml}});await ready(p);await sendIn(p);
 assert.equal(p.el('response').textContent,xml);assert.match(p.el('summary').textContent,/SOAP Fault: Solicitud inválida/);assertReset(p);
});

test('timeout or message rejection reports an uncertain outcome without retry',async()=>{
 const p=page({sendError:'The message port closed before a response was received'});await ready(p);await sendIn(p);
 assert.equal(p.sends,1);assert.match(p.el('status').textContent,/resultado incierto/i);assert.match(p.el('summary').textContent,/consulta.*SEP|reintentar/i);assert.equal(p.data.history,undefined);assertReset(p);
});

test('history persistence failure preserves the response and warns without saying not sent',async()=>{
 const xml='<respuesta><numeroLote>456</numeroLote></respuesta>';const p=page({response:{ok:true,status:200,ms:3,xml}});await ready(p);p.failStorage();await sendIn(p);
 assert.equal(p.el('response').textContent,xml);assert.match(p.el('summary').textContent,/Número de lote: 456/);assert.match(p.el('summary').textContent,/historial/i);assert.equal(p.el('downloadResponse').disabled,false);assert.equal(p.el('downloadPayload').disabled,true);assert.doesNotMatch(p.el('status').textContent,/No se envió/);assertReset(p);
});
