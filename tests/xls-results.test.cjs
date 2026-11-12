const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
const xls=fs.readFileSync('tests/fixtures/resultados.xls');

// Minimal ZIP writer for stored entries, mirroring the extension's reader.
function zip(files){
 const chunks=[],central=[];let offset=0;
 for(const {name,data} of files){
  const raw=Buffer.isBuffer(data)?data:Buffer.from(String(data),'utf8'),nameBuf=Buffer.from(name,'utf8');
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt32LE(raw.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(nameBuf.length,26);
  const entry=Buffer.concat([local,nameBuf,raw]);
  const cd=Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);
  cd.writeUInt32LE(raw.length,20);cd.writeUInt32LE(raw.length,24);cd.writeUInt16LE(nameBuf.length,28);
  cd.writeUInt32LE(offset,42);
  central.push(Buffer.concat([cd,nameBuf]));
  chunks.push(entry);offset+=entry.length;
 }
 const cdBuf=Buffer.concat(central),eocd=Buffer.alloc(22);
 eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(files.length,8);eocd.writeUInt16LE(files.length,10);
 eocd.writeUInt32LE(cdBuf.length,12);eocd.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,cdBuf,eocd]);
}

function page({respond}={}){
 const elements=new Map(),stored={},created=[];let sends=0;
 const responsePanel={attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},getAttribute(k){return this.attrs[k]}};
 function element(id=''){
  const listeners={},classes=new Set(),children=[];
  return {id,hidden:false,disabled:false,dataset:{},value:'',textContent:'',className:'',tagName:'',children,
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]},addEventListener(k,fn){listeners[k]=fn},
   async click(){if(!this.disabled)return listeners.click?.({target:this})},fire(k,extra={}){return listeners[k]?.({target:this,preventDefault(){},...extra})},
   closest(){return responsePanel},append(...nodes){children.push(...nodes)},replaceChildren(){children.length=0},focus(){},contains(){return false},
   set innerHTML(markup){this.markup=markup;for(const m of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))elements.set(m[1],element(m[1]))}
  };
 }
 const html=fs.readFileSync('index.html','utf8');
 for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element(m[1]));
 const navs=['carga','consulta','descarga','cancela','institucion','historial','informacion'].map(tab=>Object.assign(element(),{dataset:{tab},textContent:tab}));
 const document={activeElement:null,getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:tag=>{const el=element();el.tagName=String(tag).toUpperCase();created.push(el);return el},createTextNode:text=>({textContent:text})};
 const sandbox={document,console,TextEncoder,TextDecoder,Uint8Array,Blob,Response,DecompressionStream,btoa,atob,DOMException,
  crypto:Object.assign(webcrypto,{randomUUID:()=>`record-${sends}-${Math.random()}`}),
  localStorage:{getItem(){return null},setItem(){}},
  DOMParser:class{parseFromString(value){return {
   querySelector:()=>null,
   getElementsByTagName:name=>[...value.matchAll(/<([\w:]+)[^>]*>([^<]*)<\/[\w:]+>/g)].filter(m=>name==='*'||m[1].split(':').pop()===name).map(m=>({localName:m[1].split(':').pop(),textContent:m[2],children:[]})),
   documentElement:{localName:'Respuesta',getAttribute:()=>null
   }}}},
  chrome:{storage:{local:{async get(key){return {[key]:stored[key]}},async set(values){Object.assign(stored,values)},async remove(key){delete stored[key]}}},
   runtime:{async sendMessage(message){sends++;return respond?respond(message,sends):{ok:true,status:200,ms:1,xml:'<respuesta/>'}}}}
 };
 vm.runInNewContext(source,sandbox);
 return {ctx:sandbox,el:id=>elements.get(id),nav:tab=>navs.find(n=>n.dataset.tab===tab),data:stored,created,get sends(){return sends}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function ready(p){await settle();for(const [id,value] of Object.entries({setupUser:'u',setupPassword:'p',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;await p.el('saveVault').click();await settle()}
const resultsTable=p=>[...p.created].reverse().find(e=>e.tagName==='TABLE'&&String(e.className).includes('results-table'));
const resultRows=p=>resultsTable(p)?.children.find(e=>e.tagName==='TBODY')?.children||[];

const plain=value=>JSON.parse(JSON.stringify(value));

test('legacy XLS workbook is decoded into rows locally',()=>{
 const p=page();
 const rows=p.ctx.readLegacyExcelRows(new Uint8Array(xls));
 assert.deepEqual(plain(rows.map(r=>r.map(String))),[
  ['ARCHIVO','ESTATUS','DESCRIPCION','FOLIO CONTROL'],
  ['titulo-uno.xml','1','Título registrado correctamente','ABC1234567890'],
  ['titulo-dos.xml','2','El folio ya existe en el sistema','DEF0987654321'],
  ['titulo-tres.xml','1','SIN PROBLEMA','GHI1122334455']
 ]);
});

test('legacy XLS inside the response ZIP maps to the result columns',async()=>{
 const p=page();
 const rows=await p.ctx.readExcelFromZip(new Uint8Array(zip([{name:'resultados.xls',data:xls}])));
 assert.equal(rows.length,3);
 assert.deepEqual(plain(rows[1]),{archivo:'titulo-dos.xml',estatus:'2',descripcion:'El folio ya existe en el sistema',folio:'DEF0987654321'});
});

test('header detection stays case and accent insensitive for both formats',()=>{
 const p=page();
 const rows=p.ctx.excelResultRows([['Notas'],['Archivo','Estatus','Descripción','Folio Control'],['a.xml','1','ok','F-1']]);
 assert.deepEqual(plain(rows),[{archivo:'a.xml',estatus:'1',descripcion:'ok',folio:'F-1'}]);
});

test('downloading a lot shows the XLS results on screen without saving the ZIP',async()=>{
 const payload=zip([{name:'resultados.xls',data:xls}]).toString('base64');
 const xml=`<respuesta><numeroLote>100</numeroLote><codigo>1</codigo><archivoResultados>${payload}</archivoResultados></respuesta>`;
 const p=page({respond:()=>({ok:true,status:200,ms:5,xml})});
 await ready(p);
 p.nav('descarga').fire('click');
 await settle();
 p.el('numeroLote').value='100';
 await p.el('submit').click();
 await settle();
 const title=[...p.created].reverse().find(e=>e.tagName==='STRONG'&&/Resultados por título/.test(e.textContent));
 assert.ok(title,'result table title is rendered');
 assert.match(title.textContent,/Resultados por título: 3/);
 assert.match(title.textContent,/Correctos: 2/);
 assert.match(title.textContent,/Errores: 1/);
 const rows=resultRows(p);
 assert.equal(rows.length,3);
 assert.deepEqual(rows[0].children.map(td=>td.textContent),['titulo-uno.xml','1 · Correcto','Título registrado correctamente','ABC1234567890']);
 assert.deepEqual(rows[1].children.map(td=>td.textContent),['titulo-dos.xml','2 · Error','El folio ya existe en el sistema','DEF0987654321']);
 assert.equal(p.el('downloadPayload').disabled,false);
 assert.equal(p.data.history[0].results.length,3);
});

test('an unreadable Excel still leaves the ZIP available for download',async()=>{
 const payload=zip([{name:'notas.txt',data:'texto'}]).toString('base64');
 const xml=`<respuesta><numeroLote>100</numeroLote><archivoResultados>${payload}</archivoResultados></respuesta>`;
 const p=page({respond:()=>({ok:true,status:200,ms:5,xml})});
 await ready(p);
 p.nav('descarga').fire('click');
 await settle();
 p.el('numeroLote').value='100';
 await p.el('submit').click();
 await settle();
 assert.match(p.el('results').textContent,/ZIP detectado\. El ZIP no contiene un libro Excel \(\.xls o \.xlsx\) reconocible\./);
 assert.equal(p.el('downloadPayload').disabled,false);
});
