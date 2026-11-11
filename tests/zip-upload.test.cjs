const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const zlib=require('node:zlib');
const {File}=require('node:buffer');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');

// Minimal ZIP writer: stored (method 0) by default, deflate (method 8) on request.
function zip(files,{deflate=false}={}){
 const method=deflate?8:0,chunks=[],central=[];let offset=0;
 for(const {name,data} of files){
  const raw=Buffer.from(data,'utf8'),bytes=deflate?zlib.deflateRawSync(raw):raw,nameBuf=Buffer.from(name,'utf8');
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);
  local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(nameBuf.length,26);
  const entry=Buffer.concat([local,nameBuf,bytes]);
  const cd=Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(method,10);
  cd.writeUInt32LE(bytes.length,20);cd.writeUInt32LE(raw.length,24);cd.writeUInt16LE(nameBuf.length,28);
  cd.writeUInt32LE(offset,42);
  central.push(Buffer.concat([cd,nameBuf]));
  chunks.push(entry);offset+=entry.length;
 }
 const cdBuf=Buffer.concat(central),eocd=Buffer.alloc(22);
 eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(files.length,8);eocd.writeUInt16LE(files.length,10);
 eocd.writeUInt32LE(cdBuf.length,12);eocd.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,cdBuf,eocd]);
}
const xml=folio=>`<TituloElectronico folioControl="${folio}"/>`;

function page({confirm:confirmAnswer=true,respond}={}){
 const elements=new Map(),stored={},calls=[],questions=[];
 let confirmCalls=0,sends=0;
 const responsePanel={attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},getAttribute(k){return this.attrs[k]}};
 function element(id=''){
  const listeners={},classes=new Set();
  return {id,hidden:false,disabled:false,value:'',textContent:'',dataset:{},tagName:'BUTTON',
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]},addEventListener(k,fn){listeners[k]=fn},
   async click(){if(!this.disabled)await listeners.click?.({target:this})},fire(k,extra={}){return listeners[k]?.({target:this,preventDefault(){},...extra})},
   closest(){return responsePanel},replaceChildren(){},append(){},focus(){},contains(){return false},
   set innerHTML(markup){this.markup=markup;for(const m of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))elements.set(m[1],element(m[1]))}
  };
 }
 const html=fs.readFileSync('index.html','utf8');
 for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element(m[1]));
 const navs=['carga','consulta','descarga','historial','informacion'].map(tab=>Object.assign(element(),{dataset:{tab}}));
 const document={activeElement:null,getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:()=>element(),createTextNode:text=>({textContent:text})};
 const context={document,console,TextEncoder,TextDecoder,Uint8Array,File,Blob,Response,DecompressionStream,btoa,atob,DOMException,confirm:question=>{confirmCalls++;questions.push(String(question));return confirmAnswer},
  crypto:Object.assign(webcrypto,{randomUUID:()=>`record-${confirmCalls}-${Math.random()}`}),
  localStorage:{getItem(){return null},setItem(){}},
  DOMParser:class{parseFromString(value){return {querySelector:()=>null,getElementsByTagName:()=>[...value.matchAll(/<([\w:]+)[^>]*>([^<]*)<\/[\w:]+>/g)].map(m=>({localName:m[1].split(':').pop(),textContent:m[2],children:[]})),documentElement:value.includes('<TituloElectronico')?{localName:'TituloElectronico',getAttribute:()=>(value.match(/folioControl="([^"]+)"/)||[])[1]||null}:{localName:'Otro',getAttribute:()=>null}}}},
  chrome:{storage:{local:{async get(key){return {[key]:stored[key]}},async set(values){Object.assign(stored,values)},async remove(key){delete stored[key]}}},
   runtime:{async sendMessage(message){sends++;calls.push(message);return respond?respond(message,sends):{ok:true,status:200,ms:1,xml:'<respuesta/>'}}}}
 };
 vm.runInNewContext(source,context);
 return {el:id=>elements.get(id),data:stored,calls,questions,get sends(){return sends},get confirmCalls(){return confirmCalls}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function ready(p){await settle();for(const [id,value] of Object.entries({setupUser:'u',setupPassword:'p',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;await p.el('saveVault').click();await settle()}
async function select(p,file){p.el('file').files=[file];p.el('file').fire('change');for(let i=0;i<50&&p.el('fileinfo').textContent==='Ningún archivo seleccionado';i++)await settle()}

test('ZIP extracts XML entries, sends one SOAP request each and never the archive',async()=>{
 const entries=[
  {name:'b.xml',data:xml('folio-b')},
  {name:'a.xml',data:xml('folio-a')},
  {name:'carpeta/c.xml',data:xml('folio-c')},
  {name:'__MACOSX/._a.xml',data:'basura'},
  {name:'notas.txt',data:'texto'}
 ];
 const p=page({respond:(message,n)=>({ok:true,status:200,ms:1,xml:`<respuesta><numeroLote>${n}0</numeroLote><codigo>1</codigo></respuesta>`})});
 await ready(p);
 await select(p,new File([zip(entries)],'titulos.zip'));
 assert.equal(p.el('fileinfo').textContent,'titulos.zip · 3 XML');
 assert.match(p.el('filestate').textContent,/El ZIP no se envía/);
 await p.el('submit').click();await settle();
 assert.equal(p.sends,3);
 assert.deepEqual(p.calls.map(m=>m.xml.match(/<nombreArchivo>(.*?)<\/nombreArchivo>/)[1]),['a.xml','b.xml','c.xml']);
 for(const message of p.calls){assert.doesNotMatch(message.xml,/titulos\.zip/);assert.match(message.xml,/<cargaTituloElectronicoRequest xmlns="http:\/\/ws\.web\.mec\.sep\.mx\/schemas">/);assert.match(message.xml,/<archivoBase64>/)}
 assert.equal(p.data.history.length,3);
 assert.equal(p.data.history.map(r=>r.filename).sort().join(','),'a.xml,b.xml,c.xml');
 assert.equal(p.data.history.map(r=>r.lot).sort().join(','),'10,20,30');
 assert.match(p.el('summary').textContent,/XML procesados: 3/);
 assert.match(p.el('summary').textContent,/Lotes: /);
 assert.match(p.el('summary').textContent,/el ZIP no se envió/);
 assert.equal(p.el('fileinfo').textContent,'Ningún archivo seleccionado');
 assert.equal(p.el('submit').disabled,false);
});

test('invalid XML inside the ZIP is reported without blocking the remaining files',async()=>{
 const p=page({respond:(message,n)=>({ok:true,status:200,ms:1,xml:`<respuesta><numeroLote>${n}</numeroLote></respuesta>`})});
 await ready(p);
 await select(p,new File([zip([{name:'a.xml',data:xml('folio-a')},{name:'roto.xml',data:'<Otro/>'},{name:'b.xml',data:xml('folio-b')}])],'mixto.zip'));
 await p.el('submit').click();await settle();
 assert.equal(p.sends,2);
 assert.ok(p.calls.every(m=>!/roto\.xml/.test(m.xml)));
 assert.equal(p.data.history.length,2);
 assert.match(p.el('summary').textContent,/Enviados: 2/);
 assert.match(p.el('summary').textContent,/Con error: 1/);
});

test('ZIP without XML is rejected locally before any dispatch',async()=>{
 const p=page();
 await ready(p);
 await select(p,new File([zip([{name:'notas.txt',data:'texto'}])],'vacio.zip'));
 assert.equal(p.el('fileinfo').textContent,'Ningún archivo seleccionado');
 assert.equal(p.el('formAlert').hidden,false);
 assert.equal(p.el('formAlert').dataset.type,'error');
 await p.el('submit').click();await settle();
 assert.equal(p.sends,0);
 assert.equal(p.data.history,undefined);
 assert.equal(p.el('summary').textContent,'Selecciona un XML generado por SATE.');
});

test('declining the batch confirmation dispatches nothing',async()=>{
 const p=page({confirm:false});
 await ready(p);
 await select(p,new File([zip([{name:'a.xml',data:xml('folio-a')},{name:'b.xml',data:xml('folio-b')}])],'titulos.zip'));
 await p.el('submit').click();await settle();
 assert.equal(p.confirmCalls,1);
 assert.match(p.questions[0],/Se enviarán 2 XML a la SEP/);
 assert.equal(p.sends,0);
 assert.equal(p.data.history,undefined);
 assert.equal(p.el('status').textContent,'');
});

test('deflated ZIP entries are decompressed and sent individually',async()=>{
 const p=page({respond:()=>({ok:true,status:200,ms:1,xml:'<respuesta><numeroLote>5</numeroLote></respuesta>'})});
 await ready(p);
 await select(p,new File([zip([{name:'a.xml',data:xml('folio-a')},{name:'b.xml',data:xml('folio-b')}],{deflate:true})],'deflate.zip'));
 assert.equal(p.el('fileinfo').textContent,'deflate.zip · 2 XML');
 await p.el('submit').click();await settle();
 assert.equal(p.sends,2);
 assert.match(p.calls[0].xml,/<nombreArchivo>a.xml<\/nombreArchivo>/);
 assert.match(p.calls[1].xml,/<nombreArchivo>b.xml<\/nombreArchivo>/);
});

test('an HTTP error on one XML is reported without stopping the rest',async()=>{
 const p=page({respond:(message,n)=>n===1?{ok:false,status:500,ms:2,xml:'<respuesta><mensaje>Error del servicio</mensaje></respuesta>',error:'HTTP 500'}:{ok:true,status:200,ms:2,xml:'<respuesta><numeroLote>99</numeroLote></respuesta>'}});
 await ready(p);
 await select(p,new File([zip([{name:'a.xml',data:xml('folio-a')},{name:'b.xml',data:xml('folio-b')}])],'titulos.zip'));
 await p.el('submit').click();await settle();
 assert.equal(p.sends,2);
 assert.equal(p.data.history.length,2);
 assert.match(p.el('summary').textContent,/Enviados: 1/);
 assert.match(p.el('summary').textContent,/Con error: 1/);
 assert.match(p.el('summary').textContent,/Lotes: 99/);
});

test('single XML keeps the single request flow without a batch confirmation',async()=>{
 const p=page({respond:()=>({ok:true,status:200,ms:1,xml:'<respuesta><numeroLote>7</numeroLote></respuesta>'})});
 await ready(p);
 await select(p,new File([xml('folio-a')],'titulo.xml'));
 await p.el('submit').click();await settle();
 assert.equal(p.sends,1);
 assert.equal(p.confirmCalls,0);
 assert.equal(p.data.history.length,1);
 assert.equal(p.data.history[0].filename,'titulo.xml');
});
