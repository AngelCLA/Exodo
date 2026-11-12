const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync('app.js','utf8');

function page(){
 const elements=new Map();
 let document;
 function element(id=''){
  const listeners={};
  return {id,hidden:false,disabled:false,value:'',textContent:'',dataset:{},type:'text',tagName:'BUTTON',
   classList:{toggle(){},add(){},remove(){},contains(){return false}},
   setAttribute(k,v){this[k]=String(v)},removeAttribute(k){delete this[k]},
   addEventListener(k,fn){listeners[k]=fn},
   async click(){if(!this.disabled)await listeners.click?.({target:this})},
   focus(){document.activeElement=this},
   contains(el){return ['setupUser','setupPassword','setupMaster','setupMasterRepeat','unlockMaster','unlockVault','saveVault','changeVault','resetVault'].includes(el?.id)},
   closest(){return {hidden:false}},replaceChildren(){},append(){},
  };
 }
 for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element(match[1]));
 for(const id of ['file','drop','fileinfo'])elements.set(id,element(id));
 const navs=['carga','consulta','descarga','cancela','institucion','historial'].map(tab=>Object.assign(element(),{dataset:{tab}}));
 document={activeElement:null,getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:()=>element()};
 const data={};
 const context={document,console,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,DOMException,btoa,atob,
  localStorage:{getItem(){return null},setItem(){}},confirm:()=>true,
  chrome:{storage:{local:{async get(key){return {[key]:data[key]}},async set(v){Object.assign(data,v)},async remove(key){delete data[key]}}}}};
 vm.runInNewContext(source,context);
 return {el:id=>{assert.ok(elements.has(id),`Missing #${id}`);return elements.get(id)},data,navs};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function save(p){
 for(const [id,value] of Object.entries({setupUser:'operador',setupPassword:'sep-test',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;
 await p.el('saveVault').click();
}

test('credentials live in the header, not in an operation, with one encryption notice',()=>{
 const header=html.match(/<header\b[\s\S]*?<\/header>/)[0];
 assert.match(header,/id="vaultPanel"/);
 assert.match(header,/id="lockVault"/);
  assert.doesNotMatch(html.match(/<main\b[\s\S]*?<\/main>/)[0],/class="credentials"/);
 assert.equal((html.match(/cifrad[ao]s?/gi)||[]).length,1);
});

test('setup expands; saving collapses to user and lock; navigation keeps it collapsed',async()=>{
 const p=page();await settle();
 assert.equal(p.el('vaultPanel').hidden,false);
 assert.equal(p.el('vaultToggle')['aria-expanded'],'true');
 assert.equal(p.el('vaultSetup').hidden,false);
 assert.equal(p.el('submit').disabled,true);
 await save(p);
 assert.equal(p.el('vaultPanel').hidden,true);
 assert.equal(p.el('vaultToggle').textContent,'operador');
 assert.equal(p.el('lockVault').hidden,false);
 assert.equal(p.el('submit').disabled,false);
 assert.equal(p.el('setupPassword').value,'');
 assert.ok(p.data.sepCredentialVaultV1.ciphertext);
 for(const nav of p.navs.slice(0,5)){await nav.click();assert.equal(p.el('vaultPanel').hidden,true);assert.equal(p.el('submit').disabled,false)}
 await p.el('vaultToggle').click();
 assert.equal(p.el('vaultPanel').hidden,false);
 assert.equal(p.el('vaultReady').hidden,false);
 await p.el('vaultToggle').click();
 assert.equal(p.el('vaultPanel').hidden,true);
});

test('lock expands unlock; incorrect password stays expanded; unlock collapses without changing storage',async()=>{
 const p=page();await settle();await save(p);
 const stored=JSON.stringify(p.data);
 await p.el('lockVault').click();
 assert.equal(p.el('vaultPanel').hidden,false);
 assert.equal(p.el('vaultUnlock').hidden,false);
 assert.equal(p.el('lockVault').hidden,true);
 assert.equal(p.el('submit').disabled,true);
 p.el('unlockMaster').value='incorrect';await p.el('unlockVault').click();
 assert.equal(p.el('vaultPanel').hidden,false);
 assert.match(p.el('vaultFeedback').textContent,/Contraseña maestra incorrecta/);
 assert.equal(p.el('submit').disabled,true);
 assert.equal(JSON.stringify(p.data),stored);
 p.el('unlockMaster').value='master-test-123';await p.el('unlockVault').click();
 assert.equal(p.el('vaultPanel').hidden,true);
 assert.equal(p.el('submit').disabled,false);
 assert.equal(p.el('unlockMaster').value,'');
 assert.equal(JSON.stringify(p.data),stored);
});

test('secondary actions stay in the expanded panel and return to setup',async()=>{
 const panel=html.match(/id="vaultPanel"[\s\S]*?<\/header>/)?.[0]||'';
 assert.match(panel,/id="changeVault"/);assert.match(panel,/id="resetVault"/);
 for(const action of ['changeVault','resetVault']){
  const p=page();await settle();await save(p);
  p.data.history=[{lot:'123'}];
  await p.el('vaultToggle').click();await p.el(action).click();
  assert.equal(p.el('vaultPanel').hidden,false);
  assert.equal(p.el('vaultSetup').hidden,false);
  assert.equal(p.el('submit').disabled,true);
  assert.equal(p.data.sepCredentialVaultV1,undefined);
  assert.deepEqual(p.data.history,[{lot:'123'}]);
 }
});

test('master password requires at least 8 characters',async()=>{
 const p=page();await settle();
 for(const [id,value] of Object.entries({setupUser:'operador',setupPassword:'sep-test',setupMaster:'1234567',setupMasterRepeat:'1234567'}))p.el(id).value=value;
 await p.el('saveVault').click();
 assert.equal(p.data.sepCredentialVaultV1,undefined);
 assert.match(p.el('vaultFeedback').textContent,/al menos 8 caracteres/);
 assert.equal(p.el('vaultPanel').hidden,false);
 p.el('setupMaster').value='12345678';p.el('setupMasterRepeat').value='12345678';
 await p.el('saveVault').click();
 assert.ok(p.data.sepCredentialVaultV1.ciphertext);
 assert.equal(p.el('vaultPanel').hidden,true);
});
