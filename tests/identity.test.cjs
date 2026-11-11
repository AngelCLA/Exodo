const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('developer credit belongs to the sidebar footer instead of the topbar',()=>{
 const topbar=html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0]||'';
 const sidebar=html.match(/<aside\b[^>]*>[\s\S]*?<\/aside>/)?.[0]||'';
 const footer=sidebar.slice(sidebar.indexOf('<div class="aside-note">'));
 assert.doesNotMatch(topbar,/Éxodo by CLA Tech/);
 assert.match(footer,/id="brandIdentity">Éxodo by CLA Tech/);
 assert.equal((html.match(/id="brandIdentity"/g)||[]).length,1);
 assert.match(topbar,/id="title"/);
 assert.match(topbar,/id="subtitle">Gestión abierta de títulos electrónicos ante la SEP/);
 assert.match(topbar,/id="vaultToggle"/);
});

function page({stored={},setError=false,getError=false,removeError=false}={}){
 const elements=new Map(),data={...stored};let failSet=setError,failGet=getError,failRemove=removeError,sends=0;
 function element(id=''){
  const listeners={},classes=new Set();
  return {id,hidden:false,disabled:false,value:'',textContent:'',dataset:{},tagName:'BUTTON',
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},
   setAttribute(k,v){this[k]=String(v)},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]},
   addEventListener(k,fn){listeners[k]=fn},async click(){if(!this.disabled)return listeners.click?.({target:this})},
   fire(k){return listeners[k]?.({target:this,preventDefault(){}})},closest(){return {hidden:false,setAttribute(){},removeAttribute(){}}},
   replaceChildren(){},append(){},focus(){},contains(){return false},
   set innerHTML(markup){this.markup=markup;for(const match of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))elements.set(match[1],element(match[1]))}
  };
 }
 for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element(match[1]));
 const navs=['carga','consulta','descarga','cancela','institucion','historial','informacion'].map(tab=>Object.assign(element(),{dataset:{tab}}));
 const document={getElementById:id=>elements.get(id),querySelectorAll:()=>navs,addEventListener(){},createElement:()=>element(),createTextNode:text=>({textContent:text})};
 const context={document,console,TextEncoder,TextDecoder,Uint8Array,btoa,atob,crypto:webcrypto,DOMException,
  DOMParser:class{parseFromString(){return {querySelector:()=>null,documentElement:{localName:'TituloElectronico',getAttribute:()=> 'folio-test'},getElementsByTagName:()=>[]}}},
  localStorage:{getItem(){return null},setItem(){}},confirm:()=>true,
  chrome:{storage:{local:{async get(key){if(failGet)throw Error('storage unavailable');return {[key]:data[key]}},async set(values){if(failSet)throw Error('storage unavailable');Object.assign(data,values)},async remove(key){if(failRemove)throw Error('storage unavailable');delete data[key]}}},runtime:{async sendMessage(){sends++;return {ok:true,status:200,ms:1,xml:'<respuesta/>'}}}}
 }; 
 vm.runInNewContext(source,context);
 return {el:id=>elements.get(id),nav:tab=>navs.find(n=>n.dataset.tab===tab),data,failSet(value=true){failSet=value},failGet(value=true){failGet=value},failRemove(value=true){failRemove=value},get sends(){return sends}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('application reports the manifest release in Configuración',async()=>{
 const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
 assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
 const p=page();await settle();p.nav('informacion').fire('click');await settle();
 const version=manifest.version.replace(/\./g,'\\.');
 assert.match(p.el('fields').markup,new RegExp(`<dt>Versión de la extensión</dt><dd>${version}</dd>`));
 const readme=fs.readFileSync('README.md','utf8');
 assert.match(readme,new RegExp(`Versión del manifiesto: \`${version}\``));
 assert.ok(fs.existsSync('CHANGELOG.md'));
});

 test('Configuración defaults to generic identity and exposes fixed project information',async()=>{
  const p=page();await settle();p.nav('informacion').fire('click');await settle();
  assert.equal(p.el('title').textContent,'Configuración');
  assert.equal(p.el('institutionName').value,'');
  assert.match(p.el('fields').markup,/Éxodo/);
  assert.match(p.el('fields').markup,/Gestión abierta de títulos electrónicos ante la SEP/);
  assert.match(p.el('fields').markup,/CLA Tech/);
  assert.match(p.el('fields').markup,/no afiliada ni certificada por la SEP/);
  assert.match(p.el('fields').markup,/credenciales institucionales autorizadas/);
  assert.match(p.el('fields').markup,/reducir la dependencia de proveedores externos/);
  assert.match(p.el('fields').markup,/instituciones gestionen directamente sus operaciones ante los servicios oficiales de la SEP/);
  assert.doesNotMatch(p.el('fields').markup,/Universidad Politécnica del Mar y la Sierra/);
  assert.match(p.el('fields').markup,/Licencia/);assert.match(p.el('fields').markup,/MIT/);
  assert.equal(p.el('institutionShell').textContent,'Éxodo');
  assert.equal(p.data.institutionDisplayName,undefined);
 });

test('institution name saves, loads, resets, and renders as text',async()=>{
 const p=page({stored:{sepCredentialVaultV1:{ciphertext:'kept'},history:[{lot:'123'}]}});await settle();p.nav('informacion').fire('click');await settle();
 p.el('institutionName').value='<Universidad>';await p.el('saveInstitution').click();await settle();
 assert.equal(p.data.institutionDisplayName,'<Universidad>');assert.equal(p.el('institutionShell').textContent,'<Universidad>');assert.match(p.el('institutionStatus').textContent,/guardado/i);
 assert.deepEqual(p.data.sepCredentialVaultV1,{ciphertext:'kept'});assert.deepEqual(p.data.history,[{lot:'123'}]);
 p.nav('carga').fire('click');p.nav('informacion').fire('click');await settle();
 assert.equal(p.el('institutionName').value,'<Universidad>');assert.equal(p.el('institutionDisplay').textContent,'<Universidad>');
 await p.el('resetInstitution').click();await settle();
 assert.equal(p.data.institutionDisplayName,undefined);assert.equal(p.el('institutionName').value,'');assert.equal(p.el('institutionDisplay').textContent,'Éxodo');assert.equal(p.el('institutionShell').textContent,'Éxodo');
 assert.deepEqual(p.data.sepCredentialVaultV1,{ciphertext:'kept'});assert.deepEqual(p.data.history,[{lot:'123'}]);
});

test('invalid and oversized institution names preserve stored data with Spanish validation',async()=>{
 const p=page({stored:{institutionDisplayName:'Universidad base',sepCredentialVaultV1:{ciphertext:'kept'},history:[{lot:'123'}]}});await settle();p.nav('informacion').fire('click');await settle();
 for(const value of ['', 'x'.repeat(121)]){
  p.el('institutionName').value=value;await p.el('saveInstitution').click();await settle();
  assert.equal(p.data.institutionDisplayName,'Universidad base');assert.match(p.el('institutionStatus').textContent,/entre 1 y 120 caracteres/i);assert.deepEqual(p.data.sepCredentialVaultV1,{ciphertext:'kept'});assert.deepEqual(p.data.history,[{lot:'123'}]);
 }
 p.el('institutionName').value='x'.repeat(120);await p.el('saveInstitution').click();await settle();
 assert.equal(p.data.institutionDisplayName,'x'.repeat(120));assert.equal(p.el('institutionShell').textContent,'x'.repeat(120));assert.deepEqual(p.data.sepCredentialVaultV1,{ciphertext:'kept'});assert.deepEqual(p.data.history,[{lot:'123'}]);
});

test('load and reset storage failures report status without changing data',async()=>{
 const p=page({stored:{institutionDisplayName:'Universidad base'}});await settle();p.failGet(true);p.nav('informacion').fire('click');await settle();
 assert.match(p.el('institutionStatus').textContent,/no se pudo cargar/i);assert.equal(p.data.institutionDisplayName,'Universidad base');
 p.failGet(false);p.failRemove(true);await p.el('resetInstitution').click();await settle();
 assert.match(p.el('institutionStatus').textContent,/no se pudo restaurar/i);assert.equal(p.data.institutionDisplayName,'Universidad base');
});

test('storage failure is reported as failure and does not claim success',async()=>{
 const p=page({stored:{institutionDisplayName:'Universidad base'},setError:true});await settle();p.nav('informacion').fire('click');await settle();
 p.el('institutionName').value='Nueva universidad';await p.el('saveInstitution').click();await settle();
 assert.equal(p.data.institutionDisplayName,'Universidad base');assert.match(p.el('institutionStatus').textContent,/no se pudo guardar/i);assert.doesNotMatch(p.el('institutionStatus').textContent,/guardada correctamente/i);
});

test('startup reload renders stored institution in the shell without replacing fixed identity',async()=>{
 const p=page({stored:{institutionDisplayName:'Universidad persistente'}});await settle();
 assert.equal(p.el('institutionShell').textContent,'Universidad persistente');assert.match(html,/id="brandIdentity">Éxodo by CLA Tech/);assert.match(html,/id="subtitle">Gestión abierta de títulos electrónicos ante la SEP/);
});

test('institution name is never added to SOAP preview or send',async()=>{
 const p=page();await settle();
 for(const [id,value] of Object.entries({setupUser:'operador',setupPassword:'sep-test',setupMaster:'master-test-123',setupMasterRepeat:'master-test-123'}))p.el(id).value=value;
 await p.el('saveVault').click();await settle();p.nav('consulta').fire('click');await settle();p.el('numeroLote').value='123';
 p.nav('informacion').fire('click');await settle();p.el('institutionName').value='Universidad <Segura>';await p.el('saveInstitution').click();await settle();p.nav('consulta').fire('click');await settle();p.el('numeroLote').value='123';
 await p.el('preview').click();assert.doesNotMatch(p.el('request').textContent,/Universidad|Segura/);
 await p.el('submit').click();await settle();assert.equal(p.sends,1);assert.doesNotMatch(p.el('request').textContent,/Universidad|Segura/);assert.equal(p.data.institutionDisplayName,'Universidad <Segura>');
});

test('configuration navigation keeps operation controls and SOAP behavior untouched',async()=>{
 const p=page();await settle();p.nav('informacion').fire('click');await settle();
 assert.equal(p.el('submit').hidden,true);assert.equal(p.el('preview').hidden,true);
 p.nav('consulta').fire('click');assert.equal(p.el('title').textContent,'Consultar procesamiento');assert.equal(p.el('submit').hidden,false);
 assert.match(source,/sepCredentialVaultV1/);assert.match(source,/SOAP/);assert.match(source,/history/);
});

 test('fixed subtitle is present in the application shell',()=>{
  assert.match(html,/Gestión abierta de títulos electrónicos ante la SEP/);
 });
