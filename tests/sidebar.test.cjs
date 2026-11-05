const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

const source=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const html=fs.readFileSync('index.html','utf8');

function page(width=820,storedValue=null){
 const elements=new Map(),listeners={},stored={};
 let storageWrites=0,sends=0;
 const rootClasses=new Set();
 function element(id=''){
  const classes=new Set(),events={};
  return {id,hidden:false,disabled:false,dataset:{},value:'',textContent:'',tabIndex:0,
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]},
   addEventListener(k,fn){events[k]=fn},async click(){if(!this.disabled)return events.click?.({target:this})},
   fire(k,extra={}){return events[k]?.({target:this,preventDefault(){},...extra})},
   closest(){return {hidden:false,setAttribute(){},removeAttribute(){},getAttribute(){}}},replaceChildren(){},append(){},focus(){this.focused=true},contains(){return false},
   set innerHTML(markup){this.markup=markup;for(const match of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))elements.set(match[1],element(match[1]));},
  };
 }
 for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element(match[1]));
 const navs=['carga','consulta','descarga','cancela','institucion','historial','informacion'].map(tab=>Object.assign(element(),{dataset:{tab},textContent:tab}));
 const mediaListeners=[];
 const media={matches:width<=820,addEventListener(type,fn){if(type==='change')mediaListeners.push(fn)},fire(next){this.matches=next<=820;for(const fn of mediaListeners)fn({matches:this.matches})}};
 const document={documentElement:{classList:{toggle(c,on){if(on)rootClasses.add(c);else rootClasses.delete(c)},contains:c=>rootClasses.has(c)}},activeElement:null,getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:()=>element(),createTextNode:text=>({textContent:text})};
 const local={getItem(){return storedValue},setItem(key,value){storedValue=value}};
 vm.runInNewContext(source,{document,window:{matchMedia:()=>media},console,TextEncoder,TextDecoder,Uint8Array,btoa,atob,crypto:webcrypto,DOMException,
  DOMParser:class{parseFromString(){return {querySelector:()=>null,documentElement:{localName:'TituloElectronico',getAttribute:()=> 'folio-test'}}}},
  localStorage:local,chrome:{storage:{local:{async get(key){return {[key]:stored[key]}},async set(values){storageWrites++;Object.assign(stored,values)},async remove(){}},},runtime:{async sendMessage(){sends++;return {ok:true,status:200,ms:1,xml:'<respuesta/>'}}}},
 });
 return {el:id=>elements.get(id),nav:tab=>navs.find(n=>n.dataset.tab===tab),media,stored:()=>storedValue,sideEffects:()=>({storageWrites,sends,stored:{...stored}}),root:()=>rootClasses};
}

test('narrow navigation starts closed with only its header and keeps links hidden',()=>{
 const p=page(820);
 assert.equal(p.el('sidebar').classList.contains('collapsed'),true);
 assert.equal(p.el('sidebarToggle').getAttribute('aria-expanded'),'false');
 assert.equal(p.el('sidebar').hidden,false);
 for(const nav of ['carga','consulta','descarga','cancela','institucion','historial','informacion'])assert.equal(p.nav(nav).hidden,true);
 assert.match(css,/@media \(max-width: 820px\)[\s\S]*?aside\.collapsed nav\s*\{[\s\S]*?display:\s*none/);
});

test('narrow toggle opens and selection closes without changing desktop preference',async()=>{
 const p=page(820,'0');
 const before=p.sideEffects();
 await p.el('sidebarToggle').click();
 assert.equal(p.el('sidebar').classList.contains('collapsed'),false);
 assert.equal(p.el('sidebarToggle').getAttribute('aria-expanded'),'true');
 assert.equal(p.nav('carga').hidden,false);
 await p.nav('informacion').click();
 assert.equal(p.el('sidebar').classList.contains('collapsed'),true);
 assert.equal(p.el('sidebarToggle').getAttribute('aria-expanded'),'false');
 assert.equal(p.stored(),'0');
 assert.deepEqual(p.sideEffects(),before);
});

test('breakpoint change closes in narrow mode and restores stored desktop state',async()=>{
 const p=page(821,'1');
 assert.equal(p.el('sidebar').classList.contains('collapsed'),true);
 p.media.fire(820);
 assert.equal(p.el('sidebar').classList.contains('collapsed'),true);
 await p.el('sidebarToggle').click();
 assert.equal(p.el('sidebar').classList.contains('collapsed'),false);
 assert.equal(p.stored(),'1');
 p.media.fire(821);
 assert.equal(p.el('sidebar').classList.contains('collapsed'),true);
});

test('desktop keeps expanded default and persists explicit collapse',async()=>{
 const p=page(821);
 assert.equal(p.el('sidebar').classList.contains('collapsed'),false);
 await p.el('sidebarToggle').click();
 assert.equal(p.stored(),'1');
 assert.equal(p.el('sidebarToggle').getAttribute('aria-expanded'),'false');
 await p.nav('consulta').click();
 assert.equal(p.el('title').textContent,'Consultar procesamiento');
});
