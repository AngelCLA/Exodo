const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');

function page({stored={},respond,confirm:confirmAnswer=true}={}){
 const elements=new Map(),data={...stored},created=[],questions=[];let confirmCalls=0,sends=0;
 const responsePanel={attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},getAttribute(k){return this.attrs[k]}};
 function element(id=''){
  const listeners={},classes=new Set(),children=[];
  return {id,hidden:false,disabled:false,dataset:{},value:'',textContent:'',className:'',tagName:'',type:'',children,
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]},addEventListener(k,fn){listeners[k]=fn},
   async click(){if(!this.disabled)await listeners.click?.({target:this})},fire(k,extra={}){return listeners[k]?.({target:this,preventDefault(){},...extra})},
   closest(){return responsePanel},append(...nodes){children.push(...nodes)},replaceChildren(){children.length=0},focus(){},contains(){return false},
   set innerHTML(markup){
    this.markup=markup;
    for(const m of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
     const el=element(m[1]),value=m[0].match(/\bvalue="([^"]*)"/);
     if(value)el.value=value[1];
     elements.set(m[1],el);
    }
   }
  };
 }
 const html=fs.readFileSync('index.html','utf8');
 for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element(m[1]));
 const navs=['carga','consulta','descarga','cancela','institucion','historial','informacion'].map(tab=>Object.assign(element(),{dataset:{tab},textContent:tab}));
 const document={activeElement:null,getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:tag=>{const el=element();el.tagName=String(tag).toUpperCase();created.push(el);return el},createTextNode:text=>({textContent:text})};
 const context={document,console,TextEncoder,TextDecoder,Uint8Array,btoa,atob,DOMException,
  crypto:Object.assign(webcrypto,{randomUUID:()=>`record-${sends}-${confirmCalls}-${Math.random()}`}),
  localStorage:{getItem(){return null},setItem(){}},
  confirm:question=>{confirmCalls++;questions.push(String(question));return confirmAnswer},
  DOMParser:class{parseFromString(value){return {querySelector:()=>null,getElementsByTagName:()=>[...value.matchAll(/<([\w:]+)[^>]*>([^<]*)<\/[\w:]+>/g)].map(m=>({localName:m[1].split(':').pop(),textContent:m[2],children:[]})),documentElement:{localName:'Respuesta',getAttribute:()=>null}}}},
  chrome:{storage:{local:{async get(key){return {[key]:data[key]}},async set(values){Object.assign(data,values)},async remove(key){delete data[key]}}},
   runtime:{async sendMessage(message){sends++;if(respond)return respond(message,sends);return {ok:true,status:200,ms:3,xml:'<respuesta><numeroLote>100</numeroLote><codigo>1</codigo></respuesta>'}}}}
 };
 vm.runInNewContext(source,context);
 return {el:id=>elements.get(id),nav:tab=>navs.find(n=>n.dataset.tab===tab),data,created,questions,
  get sends(){return sends},get confirmCalls(){return confirmCalls}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function ready(p){await settle();for(const [id,value] of Object.entries({setupUser:'u',setupPassword:'p',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;await p.el('saveVault').click();await settle()}
async function openHistory(p){p.nav('historial').fire('click');await settle();await settle()}
const dateParts=value=>({
 date:new Date(value).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}),
 time:new Date(value).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false})
});
const tableRows=p=>{
 const table=[...p.created].reverse().find(e=>e.tagName==='TABLE'&&String(e.className).includes('history-table'));
 if(!table)return [];
 return table.children.find(e=>e.tagName==='TBODY')?.children||[];
};
const actionButtons=(p,lot,action)=>[...p.created].reverse().filter(e=>e.tagName==='BUTTON'&&e.dataset.lot===lot&&e.dataset.action===action);
async function clickAction(p,lot,action){const btn=actionButtons(p,lot,action)[0];assert.ok(btn,`missing ${action} action for lot ${lot}`);await btn.click();await settle()}

const history=[
 {id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100',httpStatus:200},
 {id:'2',timestamp:'2026-11-10T11:00:00.000Z',type:'consulta',lot:'100',httpStatus:200},
 {id:'3',timestamp:'2026-11-10T12:00:00.000Z',type:'descarga',lot:'100',httpStatus:200},
 {id:'4',timestamp:'2026-11-10T13:00:00.000Z',type:'carga',lot:'200',folio:'F-200',httpStatus:200},
 {id:'5',timestamp:'2026-11-10T14:00:00.000Z',type:'cancela',lot:'200',folio:'F-200',httpStatus:200}
];

test('history groups records by lot with creation, query and download dates',async()=>{
 const p=page({stored:{history}});
 await ready(p);
 await openHistory(p);
 assert.equal(p.el('historyCount').textContent,'2 lotes');
 const rows=tableRows(p);
 assert.equal(rows.length,2);
 assert.equal(rows[0].children[0].textContent,'200');
 const created=dateParts('2026-11-10T13:00:00.000Z');
 assert.equal(rows[0].children[1].children[0].textContent,created.date);
 assert.equal(rows[0].children[1].children[1].textContent,created.time);
 assert.equal(rows[0].children[2].textContent,'—');
 assert.equal(rows[0].children[3].textContent,'—');
 const first=dateParts('2026-11-10T10:00:00.000Z'),queried=dateParts('2026-11-10T11:00:00.000Z'),downloaded=dateParts('2026-11-10T12:00:00.000Z');
 assert.equal(rows[1].children[0].textContent,'100');
 assert.equal(rows[1].children[1].children[0].textContent,first.date);
 assert.equal(rows[1].children[1].children[1].textContent,first.time);
 assert.equal(rows[1].children[2].children[0].textContent,queried.date);
 assert.equal(rows[1].children[3].children[0].textContent,downloaded.date);
 assert.equal(rows[1].children[3].children[1].textContent,downloaded.time);
 assert.equal(rows[1].children[4].children[0].children.map(b=>b.dataset.action).join(','),'consulta,descarga,cancelar');
 assert.ok(p.created.some(e=>/^Otras operaciones \(1\)$/.test(e.textContent)),'cancellations stay visible');
});

test('history offers no destructive clear action',async()=>{
 const p=page({stored:{history}});
 await ready(p);
 await openHistory(p);
 assert.equal(p.el('clearHistory'),undefined);
 assert.doesNotMatch(source,/clearHistory|Vaciar historial/);
 assert.equal(p.data.history.length,history.length);
});

test('inline query sends its own SOAP request and records the query date',async()=>{
 const p=page({stored:{history:[{id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100',httpStatus:200}]}});
 await ready(p);
 await openHistory(p);
 await clickAction(p,'100','consulta');
 assert.equal(p.sends,1);
 assert.match(p.el('request').textContent,/consultaProcesoTituloElectronicoRequest/);
 assert.equal(p.data.history[0].type,'consulta');
 assert.equal(p.data.history[0].lot,'100');
 assert.equal(p.data.history[0].httpStatus,200);
 assert.match(p.el('summary').textContent,/^Consulta del lote 100:/);
 assert.match(p.el('summary').textContent,/Número de lote: 100/);
 assert.equal(p.el('status').textContent,'HTTP 200 · 3 ms');
 assert.equal(p.el('response').textContent,'<respuesta><numeroLote>100</numeroLote><codigo>1</codigo></respuesta>');
 assert.ok(tableRows(p)[0].children[2].children.length>0,'consulta date is filled');
});

test('inline download records the download date and keeps the response downloadable',async()=>{
 const p=page({stored:{history:[{id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100',httpStatus:200}]}});
 await ready(p);
 await openHistory(p);
 await clickAction(p,'100','descarga');
 assert.equal(p.sends,1);
 assert.equal(p.data.history[0].type,'descarga');
 assert.match(p.el('summary').textContent,/^Descarga del lote 100:/);
 assert.equal(p.el('downloadResponse').disabled,false);
 assert.equal(p.el('downloadPayload').disabled,true);
 assert.ok(tableRows(p)[0].children[3].children.length>0,'descarga date is filled');
});

test('inline cancellation prefills the only folio and sends the real cancellation',async()=>{
 const p=page({stored:{history:[{id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100',httpStatus:200}]}});
 await ready(p);
 await openHistory(p);
 await clickAction(p,'100','cancelar');
 assert.equal(p.el('historyFolio').value,'F-100');
 p.el('historyMotivo').value='Duplicado';
 await p.el('historyCancelSubmit').fire('click');
 await settle();await settle();
 assert.equal(p.sends,1);
 assert.equal(p.data.history[0].type,'cancela');
 assert.equal(p.data.history[0].lot,'100');
 assert.equal(p.data.history[0].folio,'F-100');
 assert.match(p.el('summary').textContent,/^Cancelación · lote 100 · folio F-100:/);
});

test('cancellation opens a modal dialog instead of a block below the table',async()=>{
 const p=page({stored:{history:[{id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100'}]}});
 await ready(p);
 await openHistory(p);
 assert.equal(p.el('cancelModal').hidden,true);
 await clickAction(p,'100','cancelar');
 assert.equal(p.el('cancelModal').hidden,false);
 assert.match(p.el('cancelModalTitle').textContent,/lote 100/);
 assert.equal(p.el('historyFolio').value,'F-100');
 await p.el('cancelModalDismiss').click();
 assert.equal(p.el('cancelModal').hidden,true);
 await clickAction(p,'100','cancelar');
 p.el('historyMotivo').value='Motivo pendiente';
 await p.el('cancelModalBackdrop').click();
 assert.equal(p.el('cancelModal').hidden,true);
 await clickAction(p,'100','cancelar');
 assert.equal(p.el('historyMotivo').value,'','reopening starts clean');
});

test('a lot with several folios requires an explicit folio before cancelling',async()=>{
 const p=page({stored:{history:[
  {id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100'},
  {id:'2',timestamp:'2026-11-10T10:05:00.000Z',type:'carga',lot:'100',folio:'F-101'}
 ]}});
 await ready(p);
 await openHistory(p);
 await clickAction(p,'100','cancelar');
 assert.equal(p.el('historyFolio').value,'');
 assert.match(p.el('cancelModalHint').textContent,/2 folios/,'form explains the ambiguity');
 await p.el('historyCancelSubmit').fire('click');
 assert.equal(p.sends,0);
 assert.equal(p.el('historyCancelStatus').textContent,'Captura folio y motivo de cancelación.');
});

test('closing the cancellation modal instead of confirming dispatches nothing',async()=>{
 const p=page({stored:{history:[{id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100'}]}});
 await ready(p);
 await openHistory(p);
 await clickAction(p,'100','cancelar');
 p.el('historyMotivo').value='Duplicado';
 await p.el('cancelModalBackdrop').click();
 await settle();
 assert.equal(p.confirmCalls,0);
 assert.equal(p.sends,0);
 assert.equal(p.data.history.length,1);
});

test('inline actions require unlocked credentials',async()=>{
 const p=page({stored:{history:[{id:'1',timestamp:'2026-11-10T10:00:00.000Z',type:'carga',lot:'100',folio:'F-100'}]}});
 await settle();
 await openHistory(p);
 await clickAction(p,'100','consulta');
 assert.equal(p.sends,0);
 assert.equal(p.el('status').textContent,'No se envió');
 assert.equal(p.el('summary').textContent,'Desbloquea las credenciales institucionales antes de continuar.');
});
