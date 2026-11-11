const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {File}=require('node:buffer');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('style.css','utf8');

// Small DOM/event harness: parse the actual dynamic template, not a second copy.
function page(){
 const elements=new Map(),stored={};
 function element(id=''){
  const listeners={},classes=new Set();
  return {id,hidden:false,disabled:false,dataset:{},value:'',textContent:'',
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},
   addEventListener(k,fn){listeners[k]=fn},
   async click(){if(!this.disabled)return listeners.click?.({target:this})},
   fire(k,extra={}){return listeners[k]?.({target:this,preventDefault(){},...extra})},
   closest(){return {hidden:false,setAttribute(){},removeAttribute(){},getAttribute(){}}},replaceChildren(){},append(){},focus(){},contains(){return false},
   set innerHTML(markup){this.markup=markup;for(const match of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))elements.set(match[1],element(match[1]))},
  };
 }
 const html=fs.readFileSync('index.html','utf8');
 let sends=0;
 for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element(match[1]));
 const navs=['carga','consulta','descarga','informacion'].map(tab=>Object.assign(element(),{dataset:{tab}}));
 const document={getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:()=>element(),createTextNode:text=>({textContent:text})};
 vm.runInNewContext(source,{document,console,TextEncoder,TextDecoder,Uint8Array,btoa,atob,crypto:webcrypto,DOMException,
  DOMParser:class{parseFromString(){return {querySelector:()=>null,documentElement:{localName:'TituloElectronico',getAttribute:()=> 'folio-test'}}}},
  localStorage:{getItem(){return null},setItem(){}},
  chrome:{storage:{local:{async get(key){return {[key]:stored[key]}},async set(values){Object.assign(stored,values)}}},runtime:{async sendMessage(){sends++;return {ok:true,status:200,ms:1,xml:'<respuesta/>'}}}},
 });
 return {el:id=>elements.get(id),nav:tab=>navs.find(n=>n.dataset.tab===tab),snapshot:()=>JSON.stringify(stored),get sends(){return sends}};
}

function state(p,selected){
 assert.equal(p.el('drop').classList.contains('selected'),selected);
 assert.equal(p.el('filelabel').textContent,selected?'Título electrónico seleccionado':'Arrastra aquí tu título electrónico');
 assert.equal(p.el('filestate').textContent,selected?'Archivo seleccionado; aún no validado ni enviado a SEP.':'Seleccionar un archivo no lo envía a SEP.');
}

test('system information is available as a dedicated sidebar view',()=>{
 assert.match(fs.readFileSync('index.html','utf8'),/<button class="nav" data-tab="informacion" type="button">[\s\S]*?<span>Configuración<\/span>/);
 assert.match(source,/informacion:\{title:'Configuración'/);
 const p=page();
 p.nav('informacion').fire('click');
 assert.match(p.el('fields').markup,/Versión de la extensión/);
 assert.match(p.el('fields').markup,/1\.0/);
 assert.match(p.el('fields').markup,/Desarrollado por/);
 assert.match(p.el('fields').markup,/CLA Tech/);
 assert.match(p.el('fields').markup,/Licencia/);
 assert.match(p.el('fields').markup,/MIT/);
 assert.doesNotMatch(p.el('fields').markup,/Universidad Politécnica del Mar y la Sierra|Todos los derechos reservados/);
 assert.match(source,/information-view/);
 assert.match(css,/\.columns\.information-view\s*\{\s*grid-template-columns:\s*1fr;/);
 assert.equal(p.el('submit').hidden,true);
 assert.equal(p.el('preview').hidden,true);
});

test('upload template provides distinct inline icons and accessible native XML selection',()=>{
 const p=page(),markup=p.el('fields').markup;
 const upload=markup.match(/<svg\b[^>]*class="upload-icon"[^>]*>[\s\S]*?<\/svg>/)?.[0];
 const selected=markup.match(/<svg\b[^>]*class="file-icon"[^>]*>[\s\S]*?<\/svg>/)?.[0];
 assert.ok(upload,'empty state must supply an inline upload icon');
 assert.ok(selected,'selected state must supply an inline document/check icon');
 assert.notEqual(upload.match(/<path[^>]+>/)[0],selected.match(/<path[^>]+>/)[0]);
 for(const icon of [upload,selected])assert.match(icon,/aria-hidden="true"/);
 assert.match(markup,/<label[^>]*for="file"/);
 assert.match(markup,/<input[^>]*type="file"[^>]*accept="\.xml,\.zip,text\/xml,application\/xml,application\/zip"/);
 assert.match(markup,/id="fileinfo"[^>]*role="status"/);
 assert.match(css,/\.drop \.file-icon\s*\{\s*display: none;/);
 assert.match(css,/\.drop\.selected \.file-icon\s*\{\s*display: block;/);
 assert.match(css,/\.drop\.selected \.upload-icon\s*\{\s*display: none;/);
 state(p,false);
});

test('selector is above status, with a visually hidden keyboard-accessible file input',()=>{
 const p=page(),markup=p.el('fields').markup;
 assert.match(markup,/<input\b[^>]*id="file"[^>]*>\s*<label\b[^>]*for="file"[^>]*class="file-selector"[^>]*>Seleccionar archivo<\/label>\s*<div[^>]*id="fileinfo"[^>]*role="status"[^>]*>Ningún archivo seleccionado<\/div>/);
 const input=markup.match(/<input\b[^>]*id="file"[^>]*>/)[0];
 assert.doesNotMatch(input,/\b(?:hidden|disabled)\b|tabindex="-1"/);
 assert.match(css,/\.drop input\[type="file"\]\s*\{[^}]*position: absolute;[^}]*clip-path: inset\(50%\);/);
 assert.doesNotMatch(css.match(/\.drop input\[type="file"\]\s*\{[^}]*\}/)[0],/display: none|visibility: hidden/);
 assert.match(css,/\.drop input\[type="file"\]:focus-visible \+ \.file-selector\s*\{[^}]*outline: 2px solid var\(--accent\);/);
 assert.match(css,/\.drop \.file-selector\s*\{[^}]*align-self: center;/);
 assert.equal(p.el('fileinfo').textContent,'Ningún archivo seleccionado');
});

test('native selection, replacement, cancellation and navigation update the visible state',()=>{
 const p=page();
 for(const file of [new File(['xml'],'titulo.xml'),new File(['replacement'],'<otro>.xml')]){
  p.el('file').files=[file];p.el('file').fire('change');
  state(p,true);
  assert.equal(p.el('fileinfo').textContent,`${file.name} · ${file.size.toLocaleString()} bytes`);
 }
 p.el('file').files=[];p.el('file').fire('change');state(p,false);
 assert.equal(p.el('fileinfo').textContent,'Ningún archivo seleccionado');
 p.el('file').files=[new File(['xml'],'titulo.xml')];p.el('file').fire('change');
 p.nav('consulta').fire('click');p.nav('carga').fire('click');state(p,false);
});

test('oversized XML is rejected before reads for preview and send, preserving local storage',async()=>{
 const p=page();await new Promise(resolve=>setImmediate(resolve));
 for(const [id,value] of Object.entries({setupUser:'test-user',setupPassword:'test-password',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;
 await p.el('saveVault').click();const before=p.snapshot();
 const oversized=new File([new Uint8Array(1024*1024+1)],'grande.xml');let textReads=0,arrayReads=0;
 oversized.text=async()=>{textReads++;return '<TituloElectronico folioControl="folio-test"/>'};oversized.arrayBuffer=async()=>{arrayReads++;return new ArrayBuffer(0)};
 p.el('file').files=[oversized];p.el('file').fire('change');await p.el('preview').click();
 assert.equal(p.el('summary').textContent,'El XML supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió el archivo.');
 assert.equal(p.sends,0);assert.equal(textReads,0);assert.equal(arrayReads,0);assert.equal(p.snapshot(),before);
 await p.el('submit').click();
 assert.equal(p.sends,0);assert.equal(textReads,0);assert.equal(arrayReads,0);assert.equal(p.snapshot(),before);
 p.el('drop').fire('drop',{dataTransfer:{files:[oversized]}});await p.el('preview').click();
 assert.equal(p.el('summary').textContent,'El XML supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió el archivo.');
 assert.equal(p.sends,0);assert.equal(textReads,0);assert.equal(arrayReads,0);assert.equal(p.snapshot(),before);
});

test('XML at the inclusive limit remains valid for preview and send',async()=>{
 const p=page();await new Promise(resolve=>setImmediate(resolve));
 for(const [id,value] of Object.entries({setupUser:'test-user',setupPassword:'test-password',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;
 await p.el('saveVault').click();
 const header='<TituloElectronico folioControl="folio-test"/>';
 const content=header+' '.repeat(1024*1024-Buffer.byteLength(header));
 const file=new File([content],'limite.xml');assert.equal(file.size,1024*1024);p.el('file').files=[file];p.el('file').fire('change');
 await p.el('preview').click();assert.match(p.el('request').textContent,/<nombreArchivo>limite.xml<\/nombreArchivo>/);
 await p.el('submit').click();assert.equal(p.sends,1);
});

test('drag/drop keeps file feedback and preserves the actual File for request validation',async()=>{
 const p=page();
 p.el('drop').fire('dragover');assert.equal(p.el('drop').classList.contains('dragover'),true);
 const file=new File(['not xml'],'titulo.txt');
 p.el('drop').fire('drop',{dataTransfer:{files:[file]}});state(p,true);
 assert.equal(p.el('drop').classList.contains('dragover'),false);
 assert.equal(p.el('fileinfo').textContent,`${file.name} · ${file.size.toLocaleString()} bytes`);
 await new Promise(resolve=>setImmediate(resolve));
 for(const [id,value] of Object.entries({setupUser:'test-user',setupPassword:'test-password',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;
 await p.el('saveVault').fire('click');
 await p.el('preview').fire('click');
 assert.equal(p.el('summary').textContent,'Este prototipo acepta archivos .xml.');
 p.el('drop').fire('drop',{dataTransfer:{files:[]}});state(p,true);
 assert.equal(p.el('fileinfo').textContent,`${file.name} · ${file.size.toLocaleString()} bytes`);
 p.el('drop').fire('dragleave');assert.equal(p.el('drop').classList.contains('dragover'),false);
 const xml=new File(['<TituloElectronico folioControl="folio-test"/>'],'titulo.xml');
 let reads=0;
 const originalText=xml.text.bind(xml);
 xml.text=async()=>{reads++;return originalText()};
 p.el('drop').fire('drop',{dataTransfer:{files:[xml]}});
 await p.el('preview').fire('click');
 assert.equal(reads,1,'preview must read the actual dropped File, even without DataTransfer support');
 assert.match(p.el('request').textContent,/<nombreArchivo>titulo.xml<\/nombreArchivo>/);
 assert.match(p.el('request').textContent,/\[CONTENIDO BASE64 OCULTO\]/);
 state(p,true);
});
