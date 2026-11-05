const ENDPOINT='https://met.sep.gob.mx/met-ws/services/';
const MAX_XML_BYTES=1024*1024;
const NS='http://ws.web.mec.sep.mx/schemas';
const OPS={
 carga:{title:'Cargar título electrónico',subtitle:'Importa el XML generado en SATE.',tag:'cargaTituloElectronicoRequest',label:'Enviar título a SEP'},
 consulta:{title:'Consultar procesamiento',subtitle:'Consulta el estado de un lote enviado.',tag:'consultaProcesoTituloElectronicoRequest',label:'Consultar lote'},
 descarga:{title:'Descargar título electrónico',subtitle:'Solicita los resultados asociados al número de lote.',tag:'descargaTituloElectronicoRequest',label:'Solicitar descarga'},
 cancela:{title:'Cancelar título electrónico',subtitle:'Operación cancelaTituloElectronicoRequest.',tag:'cancelaTituloElectronicoRequest',label:'Cancelar título'},
 institucion:{title:'Cancelar por institución',subtitle:'Operación cancelarTituloInstitucionRequest.',tag:'cancelarTituloInstitucionRequest',label:'Cancelar por institución'},
 historial:{title:'Historial de lotes',subtitle:'Registro de operaciones almacenado solo en este navegador.',tag:null,label:''},
 informacion:{title:'Configuración',subtitle:'Configuración y alcance de esta extensión.',tag:null,label:''}
};
const INSTITUTION_KEY='institutionDisplayName';
const MAX_INSTITUTION_NAME_LENGTH=120;
let unlockedCredentials=null, vaultBusy=false, sending=false;
let tab='carga', lastResponse='', lastFilename='respuesta.xml', lastPayload=null, selectedFile=null, currentResults=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const node=(k,v)=>`<${k}>${esc(v)}</${k}>`;
const field=(id,label,type='text',placeholder='')=>`<label>${label}<input id="${id}" type="${type}" placeholder="${placeholder}" autocomplete="off"></label>`;
const get=(id)=>$(id)?.value?.trim()??'';
const parseXML=x=>{const d=new DOMParser().parseFromString(x,'application/xml');if(d.querySelector('parsererror'))throw Error('La respuesta no es XML válido');return d};
function findValue(xml,names){try{const d=parseXML(xml);const n=[...d.getElementsByTagName('*')].find(e=>names.includes(e.localName));return n?.textContent?.trim()||''}catch{return ''}}
const CANCEL_NOTICE='<div class="danger-notice" role="note"><strong>Aviso:</strong> Operación irreversible. Al enviar se ejecuta una cancelación real en la SEP. Revisa el folio antes de continuar.</div>';
function setFormAlert(message,type='error'){const el=$('formAlert');el.replaceChildren();if(message){const prefix=document.createElement('strong');prefix.textContent=type==='info'?'Aviso: ':'Error: ';el.append(prefix,document.createTextNode(message))}el.dataset.type=type;el.hidden=!message}
function updateFileInfo(){const selected=!!selectedFile;
 $('drop')?.classList.toggle('selected',selected);
 const label=$('filelabel');if(label)label.textContent=selected?'Título electrónico seleccionado':'Arrastra aquí tu título electrónico';
 const state=$('filestate');if(state)state.textContent=selected?'Archivo seleccionado; aún no validado ni enviado a SEP.':'Seleccionar un archivo no lo envía a SEP.';
 const el=$('fileinfo');if(el)el.textContent=selected?`${selectedFile.name} · ${selectedFile.size.toLocaleString()} bytes`:'Ningún archivo seleccionado';
}
function setTab(next){tab=next;selectedFile=null;setFormAlert('');
 const isInformacion=tab==='informacion';
 document.querySelectorAll('.nav').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 $('title').textContent=OPS[tab].title;$('submit').textContent=OPS[tab].label;
 $('preview').hidden=tab==='historial'||isInformacion;$('submit').hidden=tab==='historial'||isInformacion;const actionsEl=$('submit').closest('.actions');if(actionsEl)actionsEl.hidden=tab==='historial'||isInformacion;
 const responsePanel=$('responseTitle').closest('.panel');if(responsePanel)responsePanel.hidden=isInformacion;
 const columns=$('fields').closest('.columns');columns?.classList?.toggle('information-view',isInformacion);
 $('fields').innerHTML=({
 carga:`<div class="drop" id="drop">
  <svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></svg>
  <svg class="file-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 2H5v20h14V7l-5-5v5h5M8 14l3 3 5-6"/></svg>
  <div id="filelabel">Arrastra aquí tu título electrónico</div>
  <input type="file" id="file" accept=".xml,text/xml,application/xml" aria-describedby="filehelp fileinfo filestate">
  <label for="file" class="file-selector">Seleccionar archivo</label>
  <div class="hint" id="fileinfo" role="status">Ningún archivo seleccionado</div>
  <div class="hint" id="filehelp">XML generado por SATE · Usa el selector o arrastra un archivo .xml · Máximo local: 1 MB</div>
  <div class="hint" id="filestate">Seleccionar un archivo no lo envía a SEP.</div>
 </div>`,
 consulta:field('numeroLote','Número de lote','number','Ej. 123456'),
 descarga:field('numeroLote','Número de lote','number','Ej. 123456'),
 cancela:CANCEL_NOTICE+field('folioControl','Folio de control')+field('motCancelacion','Motivo de cancelación'),
 institucion:CANCEL_NOTICE+field('folioControl','Folio de control')+field('cveInstitucion','Clave de institución')+field('motCancelacion','Motivo de cancelación'),
 historial:`<div class="history-toolbar"><span id="historyCount" class="hint"></span><button id="clearHistory" class="secondary" type="button">Vaciar historial</button></div><div id="history"></div>`,
 informacion:`<div class="system-info">
  <section class="system-info-section" aria-labelledby="institutionSettingsTitle">
    <h2 id="institutionSettingsTitle">Identidad institucional</h2>
    <p>Personaliza el nombre que se muestra localmente en esta extensión. Se guarda solo en este navegador y no cambia las credenciales ni el historial.</p>
    <label for="institutionName">Nombre de la institución
      <input id="institutionName" type="text" maxlength="120" autocomplete="organization" placeholder="Ej. Universidad Autónoma de México">
    </label>
    <div class="config-actions">
      <button id="saveInstitution" class="primary" type="button">Guardar nombre</button>
      <button id="resetInstitution" class="secondary" type="button">Usar identidad genérica</button>
    </div>
    <p id="institutionStatus" class="hint" role="status" aria-live="polite"></p>
    <p>Identidad actual: <strong id="institutionDisplay">Éxodo</strong></p>
  </section>
  <section class="system-info-section" aria-labelledby="systemIdentityTitle">
    <h2 id="systemIdentityTitle">Proyecto</h2>
    <p>Éxodo · Gestión abierta de títulos electrónicos ante la SEP</p>
    <p>Herramienta gratuita y de código abierto para instituciones educativas de México.</p>
    <p>Éxodo busca reducir la dependencia de proveedores externos, permitiendo que las instituciones gestionen directamente sus operaciones ante los servicios oficiales de la SEP.</p>
  </section>
  <section class="system-info-section" aria-labelledby="systemVersionTitle">
    <h2 id="systemVersionTitle">Aplicación</h2>
    <dl>
      <div><dt>Nombre del proyecto</dt><dd>Éxodo</dd></div>
      <div><dt>Versión de la extensión</dt><dd>1.0</dd></div>
    </dl>
  </section>
  <section class="system-info-section" aria-labelledby="systemConnectionTitle">
    <h2 id="systemConnectionTitle">Conexión</h2>
    <dl>
      <div><dt>Servicio autorizado</dt><dd>met.sep.gob.mx</dd></div>
      <div><dt>Protocolo</dt><dd>SOAP sobre HTTPS</dd></div>
    </dl>
  </section>
  <section class="system-info-section" aria-labelledby="systemDataTitle">
    <h2 id="systemDataTitle">Datos locales</h2>
    <p>Las credenciales institucionales se cifran en reposo y solo se envían al servicio oficial de la SEP mediante HTTPS cuando ejecutas una operación autorizada. El historial de lotes se almacena únicamente de forma local.</p>
  </section>
  <section class="system-info-section" aria-labelledby="systemCreditsTitle">
    <h2 id="systemCreditsTitle">Autoría y derechos</h2>
    <dl>
      <div><dt>Desarrollado por</dt><dd>CLA Tech</dd></div>
      <div><dt>Licencia</dt><dd>MIT</dd></div>
      <div><dt>Alcance</dt><dd>Éxodo es una herramienta independiente, no afiliada ni certificada por la SEP. Requiere credenciales institucionales autorizadas.</dd></div>
    </dl>
  </section>
 </div>`})[tab];
 $('fields').classList.toggle('fields-grow',tab==='carga');
 if(tab==='carga'){const input=$('file'),drop=$('drop');
  input.addEventListener('change',e=>{selectedFile=e.target.files?.[0]||null;updateFileInfo()});
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')}));
  ['dragleave','dragend'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')}));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');const f=e.dataTransfer?.files?.[0];if(!f)return;selectedFile=f;try{const dt=new DataTransfer();dt.items.add(f);input.files=dt.files}catch(err){}updateFileInfo()});
  updateFileInfo();
 }
 if(tab==='historial'){$('clearHistory').addEventListener('click',clearHistory);renderHistory()}
 if(isInformacion){$('saveInstitution').addEventListener('click',saveInstitution);$('resetInstitution').addEventListener('click',resetInstitution);renderInstitutionSettings()}
 $('submit').disabled=!unlockedCredentials&&tab!=='historial';$('preview').disabled=!unlockedCredentials&&tab!=='historial';
}
async function fileBase64(file){const bytes=new Uint8Array(await file.arrayBuffer());let b='';// Use chunks to avoid maximum argument-size issues.
 for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(b)}
async function buildRequest(){const usuario=unlockedCredentials?.usuario, password=unlockedCredentials?.password;
 if(!usuario||!password)throw Error('Desbloquea las credenciales institucionales antes de continuar.');
 let parts='';let reference={};
 if(tab==='carga'){
  if(!selectedFile)throw Error('Selecciona un XML generado por SATE.');
  if(!/\.xml$/i.test(selectedFile.name))throw Error('Este prototipo acepta archivos .xml.');
  if(selectedFile.size>MAX_XML_BYTES)throw Error('El XML supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió el archivo.');
  const content=await selectedFile.text();const doc=parseXML(content);const root=doc.documentElement;if(root.localName!=='TituloElectronico'||!root.getAttribute('folioControl'))throw Error('El XML no tiene el elemento TituloElectronico y su folioControl.');reference.folio=root.getAttribute('folioControl');
  parts=node('nombreArchivo',selectedFile.name)+node('archivoBase64',await fileBase64(selectedFile));reference.filename=selectedFile.name;
 }else if(tab==='consulta'||tab==='descarga'){
  const lot=get('numeroLote');if(!/^\d+$/.test(lot))throw Error('El número de lote debe ser un entero positivo.');parts=node('numeroLote',lot);reference.lot=lot;
 }else if(tab==='cancela'||tab==='institucion'){
  const folio=get('folioControl'),reason=get('motCancelacion');if(!folio||!reason)throw Error('Captura folio y motivo de cancelación.');
  parts=node('folioControl',folio);
  if(tab==='institucion'){const school=get('cveInstitucion');if(!school)throw Error('Captura la clave de institución.');parts+=node('cveInstitucion',school);reference.school=school}
  parts+=node('motCancelacion',reason);reference.folio=folio;
 }else throw Error('Operación no disponible');
 parts+=`<autenticacion>${node('usuario',usuario)}${node('password',password)}</autenticacion>`;
 const xml=`<?xml version="1.0" encoding="UTF-8"?><Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body><${OPS[tab].tag} xmlns="${NS}">${parts}</${OPS[tab].tag}></Body></Envelope>`;
 // Don't expose password or Base64 in the interface's preview.
 const safe=xml.replace(/<password>[\s\S]*?<\/password>/,'<password>••••••••</password>').replace(/<archivoBase64>[\s\S]*?<\/archivoBase64>/,'<archivoBase64>[CONTENIDO BASE64 OCULTO]</archivoBase64>');
 return {xml,safe,reference};
}
function status(s){$('status').textContent=s}
function setSummary(message){const el=$('summary');el.textContent=message;el.hidden=!message}
function resultsPlaceholder(){const el=$('results');el.replaceChildren();const p=document.createElement('div');p.className='results-empty';p.textContent='Aquí aparecerá la tabla de resultados del lote.';el.append(p)}
function resetDownloads(){lastResponse='';lastPayload=null;currentResults=[];resultsPlaceholder();$('downloadResponse').disabled=true;$('downloadPayload').disabled=true;}
function extractPayload(xml){
 try {const d=parseXML(xml);for(const el of d.getElementsByTagName('*')){
  if(el.children.length)continue;const encoded=(el.textContent||'').replace(/\s/g,'');
  if(encoded.length<20||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))continue;
  // Avoid decoding unrelated long fields such as signatures unless they begin with ZIP magic.
  if(!encoded.startsWith('UEs'))continue;
  const bin=atob(encoded);const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  if(bytes[0]===0x50&&bytes[1]===0x4b)return {bytes,extension:'zip'};
 }return null}catch{return null}
}
const nsText=(parent,name)=>[...parent.getElementsByTagName('*')].filter(n=>n.localName===name);
function zipEntries(bytes){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(d.getUint32(i,true)===0x06054b50){end=i;break}}
 if(end<0)throw Error('Archivo ZIP sin directorio central válido.');
 const count=d.getUint16(end+10,true),start=d.getUint32(end+16,true),entries=[];let o=start;
 if(count>200||start>=bytes.length)throw Error('ZIP demasiado grande o inválido.');
 for(let i=0;i<count;i++){
  if(d.getUint32(o,true)!==0x02014b50)throw Error('Entrada ZIP inválida.');
  const method=d.getUint16(o+10,true),size=d.getUint32(o+20,true),nlen=d.getUint16(o+28,true),xlen=d.getUint16(o+30,true),clen=d.getUint16(o+32,true),local=d.getUint32(o+42,true);
  const name=new TextDecoder().decode(bytes.slice(o+46,o+46+nlen));
  if(!name.includes('..')&&!name.startsWith('/')&&size<=20*1024*1024)entries.push({name,method,size,local});
  o+=46+nlen+xlen+clen;
 }
 return entries;
}
async function unzipEntry(bytes,e){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),o=e.local;
 if(d.getUint32(o,true)!==0x04034b50)throw Error('Cabecera ZIP inválida.');
 const compressedSize=(()=>{ // Size must come from central directory, not local header with data descriptors.
   let p=bytes.length-22;for(;p>=Math.max(0,bytes.length-65557);p--)if(d.getUint32(p,true)===0x06054b50)break;
   let c=d.getUint32(p+16,true);while(c<p){if(d.getUint32(c,true)!==0x02014b50)break;const n=d.getUint16(c+28,true),x=d.getUint16(c+30,true),cm=d.getUint16(c+32,true);if(d.getUint32(c+42,true)===o)return d.getUint32(c+20,true);c+=46+n+x+cm}throw Error('Entrada no encontrada');
 })();
 const start=o+30+d.getUint16(o+26,true)+d.getUint16(o+28,true),raw=bytes.slice(start,start+compressedSize);
 if(e.method===0)return raw;
 if(e.method!==8)throw Error('Compresión ZIP no soportada.');
 const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const result=new Uint8Array(await new Response(stream).arrayBuffer());
 if(result.length>20*1024*1024)throw Error('Entrada demasiado grande.');return result;
}
function spreadsheetRows(sheet,shared){
 const rows=[];for(const row of nsText(sheet,'row')){
  const result=[];
  for(const c of [...row.children].filter(n=>n.localName==='c')){
   const ref=c.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/i)?.[0]||'A';let index=0;
   for(const letter of letters.toUpperCase())index=index*26+letter.charCodeAt(0)-64;index--;
   if(index<0||index>200)continue;
   const inline=nsText(c,'is')[0];const value=inline?[...nsText(inline,'t')].map(n=>n.textContent).join(''):(nsText(c,'v')[0]?.textContent||'');
   result[index]=c.getAttribute('t')==='s'?shared[Number(value)]||'':value;
  }rows.push(result);
 }return rows;
}
async function readExcelFromZip(bytes){
 const entries=zipEntries(bytes),sheet=entries.find(e=>/^xl\/worksheets\/sheet[0-9]+\.xml$/.test(e.name));
 if(!sheet)throw Error('El ZIP no contiene un libro Excel XLSX reconocible.');
 const sharedEntry=entries.find(e=>e.name==='xl/sharedStrings.xml');let shared=[];
 if(sharedEntry){const doc=parseXML(new TextDecoder().decode(await unzipEntry(bytes,sharedEntry)));
  shared=nsText(doc,'si').map(si=>nsText(si,'t').map(n=>n.textContent).join(''))}
 const xml=parseXML(new TextDecoder().decode(await unzipEntry(bytes,sheet)));
 const rows=spreadsheetRows(xml,shared).filter(r=>r.some(v=>String(v??'').trim()));
 const normalize=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 let h=-1,columns=[];
 for(let i=0;i<Math.min(rows.length,30);i++){
  const keys=rows[i].map(normalize);const find=(names)=>keys.findIndex(k=>names.includes(k));
  const col=[find(['archivo','nombrearchivo','nombrexml']),find(['estatus','estado']),find(['descripcion','mensaje']),find(['foliocontrol'])];
  if(col.every(n=>n>=0)){h=i;columns=col;break}
 }
 if(h<0)throw Error('Se encontró Excel, pero no las columnas Archivo, Estatus, Descripción y Folio control.');
 return rows.slice(h+1).filter(r=>r.some(v=>String(v??'').trim())).map(r=>({archivo:r[columns[0]]||'',estatus:String(r[columns[1]]||''),descripcion:r[columns[2]]||'',folio:r[columns[3]]||''}));
}
function showResults(results){
 const el=$('results');el.replaceChildren();if(!results.length){el.textContent='El Excel no contiene registros.';return}
 const title=document.createElement('strong');title.textContent=`Resultados por título: ${results.length} · Correctos: ${results.filter(r=>r.estatus==='1').length} · Errores: ${results.filter(r=>r.estatus==='2').length}`;el.append(title);
 const table=document.createElement('table');table.className='results-table';const head=document.createElement('thead');const tr=document.createElement('tr');for(const name of ['Archivo','Estatus','Descripción','Folio control']){const th=document.createElement('th');th.textContent=name;tr.append(th)}head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const r of results.slice(0,2000)){const tr=document.createElement('tr');const cells=[r.archivo,r.estatus==='1'?'1 · Correcto':r.estatus==='2'?'2 · Error':r.estatus,r.descripcion,r.folio];cells.forEach((val,i)=>{const td=document.createElement('td');if(i===1){if(r.estatus==='1')td.className='cell-ok';else if(r.estatus==='2')td.className='cell-error'}td.textContent=String(val);tr.append(td)});body.append(tr)}table.append(body);el.append(table);
}
async function saveRecord(record){const {history=[]}=await chrome.storage.local.get('history');history.unshift(record);await chrome.storage.local.set({history:history.slice(0,250)});}
function institutionName(value){const name=typeof value==='string'?value.trim():'';return name&&name.length<=MAX_INSTITUTION_NAME_LENGTH?name:''}
function setInstitutionStatus(message){const el=$('institutionStatus');if(el)el.textContent=message}
function renderInstitutionName(name){const value=name||'Éxodo';const display=$('institutionDisplay');if(display)display.textContent=value;const shell=$('institutionShell');if(shell)shell.textContent=value}
async function loadInstitutionDisplay(){try{const stored=(await chrome.storage.local.get(INSTITUTION_KEY))[INSTITUTION_KEY];renderInstitutionName(institutionName(stored))}catch(e){renderInstitutionName('')}}
async function renderInstitutionSettings(){
 const input=$('institutionName');if(!input)return;
 try{const stored=(await chrome.storage.local.get(INSTITUTION_KEY))[INSTITUTION_KEY];const name=institutionName(stored);input.value=name;renderInstitutionName(name);setInstitutionStatus('')}
 catch(e){input.value='';renderInstitutionName('');setInstitutionStatus('No se pudo cargar la configuración local.')}
}
async function saveInstitution(){
 const input=$('institutionName'),name=institutionName(input?.value);
 if(!name){setInstitutionStatus(`El nombre de la institución debe tener entre 1 y ${MAX_INSTITUTION_NAME_LENGTH} caracteres.`);return}
 try{await chrome.storage.local.set({[INSTITUTION_KEY]:name});renderInstitutionName(name);setInstitutionStatus('Nombre de institución guardado.')}
 catch(e){setInstitutionStatus('No se pudo guardar el nombre de la institución. No se modificó la configuración local.')}
}
async function resetInstitution(){
 try{await chrome.storage.local.remove(INSTITUTION_KEY);const input=$('institutionName');if(input)input.value='';renderInstitutionName('');setInstitutionStatus('Se restauró la identidad genérica de Éxodo.')}
 catch(e){setInstitutionStatus('No se pudo restaurar la identidad genérica. No se modificó la configuración local.')}
}
function validHttpStatus(value){return Number.isInteger(value)&&value>=100&&value<=599}
function validWorkerReply(value){return !!value&&typeof value==='object'&&typeof value.ok==='boolean'&&validHttpStatus(value.status)&&typeof value.xml==='string'}
async function send(){if(tab==='historial'||vaultBusy||sending)return;
 sending=true;let dispatched=false,received=false;
 try{
  setFormAlert('');
  const req=await buildRequest();$('request').textContent=req.safe;
  if(['cancela','institucion'].includes(tab)&&!confirm(`Vas a ejecutar una CANCELACIÓN REAL en la SEP.\n\nFolio: ${req.reference.folio}\n\n¿Confirmas continuar?`))return;
  $('submit').disabled=true;$('submit').classList.add('loading');$('preview').disabled=true;$('responseTitle').closest('.panel').setAttribute('aria-busy','true');status('Enviando solicitud…');setSummary('');resetDownloads();
  dispatched=true;
  const response=await chrome.runtime.sendMessage({type:'SOAP',endpoint:ENDPOINT,xml:req.xml});
  if(response?.uncertain)throw Error(response.error||'No se pudo confirmar el resultado del envío.');
  if(response&&typeof response==='object'&&response.ok===false&&response.error&&!('status' in response)&&!('xml' in response)){dispatched=false;throw Error(response.error)}
  if(!validWorkerReply(response))throw Error('La respuesta del servicio no se pudo confirmar.');
  received=true;
  $('response').textContent=response.xml||response.error||'Sin respuesta';
  if(response.xml){lastResponse=response.xml;lastFilename=`sep_${tab}_${Date.now()}.xml`;$('downloadResponse').disabled=false;if(tab==='descarga'||tab==='consulta'){lastPayload=extractPayload(response.xml);$('downloadPayload').disabled=!lastPayload;if(lastPayload){try{currentResults=await readExcelFromZip(lastPayload.bytes);showResults(currentResults)}catch(e){$('results').textContent='ZIP detectado. '+e.message+' Puedes descargar el ZIP original.'}}}}
  const lot=findValue(response.xml||'',['numeroLote','numeroLoteRespuesta']);
  const fault=findValue(response.xml||'',['faultstring','Text']);
  const code=findValue(response.xml||'',['estatusLote','codigo','codigoRespuesta','estatus']);
  const msg=findValue(response.xml||'',['mensaje','mensajeRespuesta','descripcion']);
  status(response.status?`HTTP ${response.status} · ${response.ms} ms`:`Error de conexión · ${response.ms||0} ms`);
  const summary=[response.ok?'Solicitud HTTP aceptada (no implica éxito del trámite).':`Error HTTP o SOAP: ${response.error||response.status||'desconocido'}`,lot?`Número de lote: ${lot}`:'',code?`Estado/código: ${code}`:'',msg?`Mensaje: ${msg}`:'',fault?`SOAP Fault: ${fault}`:'','Revisa siempre el XML completo para confirmar el resultado.'].filter(Boolean).join('\n');
  setSummary(summary);
  const record={id:crypto.randomUUID(),timestamp:new Date().toISOString(),type:tab,lot:lot||req.reference.lot||'',filename:req.reference.filename||'',folio:req.reference.folio||'',httpStatus:response.status||null,code,msg:msg||fault||'',response:'',results:currentResults.map(r=>({archivo:r.archivo,estatus:r.estatus,descripcion:r.descripcion,folio:r.folio})),error:response.error||''};
  try{await saveRecord(record)}catch(e){setSummary(`${summary}\nAviso: no se pudo guardar el historial (${e.message}). La respuesta recibida se conserva en esta pantalla.`);setFormAlert('La respuesta se recibió, pero no se pudo guardar el historial.','info')}
 }catch(e){if(!dispatched){status('No se envió');setSummary(e.message);setFormAlert(e.message)}else if(!received){const message=`No se pudo confirmar el resultado del envío. Consulta la SEP antes de reintentar; no hay reintento automático. Detalle: ${e.message}`;status('Resultado incierto');setSummary(message);setFormAlert(message,'info')}else{status('Respuesta recibida');setSummary(e.message);setFormAlert(e.message,'info')}}
 finally{sending=false;$('submit').classList.remove('loading');$('submit').disabled=!unlockedCredentials;$('preview').disabled=!unlockedCredentials;$('responseTitle').closest('.panel').removeAttribute('aria-busy')}
}
function download(data,name,type='text/xml'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
const TYPE_LABEL={carga:'Carga',consulta:'Consulta',descarga:'Descarga',cancela:'Cancelación',institucion:'Cancelación por institución'};
async function clearHistory(){if(!confirm('Esto borrará el historial de movimientos guardado en este navegador. Las credenciales no se modifican. ¿Continuar?'))return;await chrome.storage.local.remove('history');renderHistory()}
async function renderHistory(){const el=$('history');if(!el)return;const {history=[]}=await chrome.storage.local.get('history');el.replaceChildren();
 const count=$('historyCount'),clear=$('clearHistory');if(count)count.textContent=history.length?`${history.length} movimiento${history.length===1?'':'s'}`:'Sin movimientos';if(clear)clear.disabled=!history.length;
 if(!history.length){const empty=document.createElement('div');empty.className='empty-state';const strong=document.createElement('strong');strong.textContent='Sin movimientos todavía.';const p=document.createElement('p');p.textContent='Las operaciones que ejecutes aparecerán aquí y se guardan solo en este navegador.';empty.append(strong,p);el.append(empty);return}
 for(const rec of history){const row=document.createElement('div');row.className='history-row';const title=document.createElement('strong');title.textContent=`${TYPE_LABEL[rec.type]||rec.type.toUpperCase()} · ${rec.lot?'Lote '+rec.lot:rec.folio?'Folio '+rec.folio:'Sin identificador'}`;row.append(title);const meta=document.createElement('div');meta.className='small';meta.textContent=`${new Date(rec.timestamp).toLocaleString('es-MX')} · HTTP ${rec.httpStatus||'-'} · ${rec.filename||''}`;row.append(meta);const detail=document.createElement('div');detail.textContent=[rec.code,rec.msg].filter(Boolean).join(' · ')||rec.error||'Consultar respuesta XML';row.append(detail);
 if(rec.results?.length){const res=document.createElement('div');res.className='small';res.textContent=`${rec.results.length} resultado${rec.results.length===1?'':'s'} · ${rec.results.filter(r=>r.estatus==='1').length} correctos · ${rec.results.filter(r=>r.estatus==='2').length} con error`;row.append(res)}
 if(rec.lot){const btn=document.createElement('button');btn.className='secondary';btn.textContent='Consultar lote';btn.addEventListener('click',()=>{setTab('consulta');$('numeroLote').value=rec.lot});row.append(btn)}
 if(rec.response){const btn=document.createElement('button');btn.className='secondary';btn.textContent='Guardar respuesta';btn.addEventListener('click',()=>download(rec.response,`sep_${rec.type}_${rec.lot||rec.id}.xml`));row.append(btn)}el.append(row)}
}
$('submit').addEventListener('click',send);
$('preview').addEventListener('click',async()=>{try{setFormAlert('');const req=await buildRequest();$('request').textContent=req.safe;setSummary('Solicitud construida localmente. Aún no se ha enviado.');status('Vista previa disponible')}catch(e){setSummary(e.message);setFormAlert(e.message)}});
$('downloadResponse').addEventListener('click',()=>lastResponse&&download(lastResponse,lastFilename));
$('downloadPayload').addEventListener('click',()=>lastPayload&&download(lastPayload.bytes,`sep_descarga_${Date.now()}.${lastPayload.extension}`,'application/octet-stream'));
const SIDEBAR_KEY='sepSidebarCollapsed';
const sidebarMedia=typeof window!=='undefined'&&typeof window.matchMedia==='function'?window.matchMedia('(max-width: 820px)'):null;
let desktopSidebarCollapsed=false;try{desktopSidebarCollapsed=localStorage.getItem(SIDEBAR_KEY)==='1'}catch(e){}
function isNarrowSidebar(){return Boolean(sidebarMedia?.matches)}
function setSidebarCollapsed(collapsed,{persist=true,focusToggle=false}={}){
 const aside=$('sidebar'),btn=$('sidebarToggle');if(!aside||!btn)return;
 const narrow=isNarrowSidebar();
 aside.classList.toggle('collapsed',collapsed);document.documentElement?.classList.toggle('sidebar-collapsed',collapsed);
 document.querySelectorAll('.nav').forEach(nav=>{nav.hidden=narrow&&collapsed});
 btn.setAttribute('aria-expanded',String(!collapsed));const label=collapsed?'Expandir barra lateral':'Contraer barra lateral';btn.setAttribute('aria-label',label);btn.title=label;
 if(persist&&!narrow){desktopSidebarCollapsed=collapsed;try{localStorage.setItem(SIDEBAR_KEY,collapsed?'1':'0')}catch(e){}}
 if(focusToggle)btn.focus();
}
document.querySelectorAll('.nav').forEach(b=>{const label=b.textContent.trim();b.setAttribute('aria-label',label);b.title=label;b.addEventListener('click',()=>{setTab(b.dataset.tab);if(isNarrowSidebar())setSidebarCollapsed(true,{persist:false,focusToggle:true})})});
$('sidebarToggle').addEventListener('click',()=>setSidebarCollapsed(!$('sidebar').classList.contains('collapsed'),{persist:!isNarrowSidebar()}));
if(sidebarMedia?.addEventListener)sidebarMedia.addEventListener('change',event=>setSidebarCollapsed(event.matches?true:desktopSidebarCollapsed,{persist:false}));
setSidebarCollapsed(isNarrowSidebar()?true:desktopSidebarCollapsed,{persist:false});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target;if(!(t instanceof HTMLElement)||t.tagName==='BUTTON'||t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&t.type==='file')||t.id==='unlockMaster')return;if(t.closest('#vaultSetup')){e.preventDefault();if(!vaultBusy)$('saveVault').click();return}if(t.closest('#fields')&&unlockedCredentials&&tab!=='historial'){e.preventDefault();send()}});
setTab('carga');
loadInstitutionDisplay();
resultsPlaceholder();

// Credential vault: AES-GCM with PBKDF2-derived key. The master password is NEVER persisted.
const VAULT_KEY='sepCredentialVaultV1';
const utf8 = new TextEncoder();
function wipeCredentialFields(){for(const id of ['setupUser','setupPassword','setupMaster','setupMasterRepeat','unlockMaster'])if($(id))$(id).value=''}
function vaultMessage(msg){$('vaultFeedback').textContent=msg}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function fromB64(str){const raw=atob(str);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function deriveMasterKey(master,salt,iterations){const base=await crypto.subtle.importKey('raw',utf8.encode(master),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encryptCredentials(creds,master){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=310000;const key=await deriveMasterKey(master,salt,iterations);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,utf8.encode(JSON.stringify(creds)));return {version:1,kdf:'PBKDF2-SHA256',iterations,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))}}
async function decryptCredentials(vault,master){if(vault.version!==1||vault.kdf!=='PBKDF2-SHA256'||!Number.isSafeInteger(vault.iterations)||vault.iterations<100000||vault.iterations>2000000)throw Error('Formato de credenciales no compatible.');const key=await deriveMasterKey(master,fromB64(vault.salt),vault.iterations);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(vault.iv)},key,fromB64(vault.ciphertext));const creds=JSON.parse(new TextDecoder().decode(plain));if(typeof creds.usuario!=='string'||typeof creds.password!=='string'||!creds.usuario||!creds.password)throw Error('Credenciales inválidas.');return creds}
function setVaultExpanded(expanded){
 const panel=$('vaultPanel');
 if(!expanded&&panel.contains(document.activeElement))$('vaultToggle').focus();
 panel.hidden=!expanded;
 $('vaultToggle').setAttribute('aria-expanded',String(expanded));
}
$('vaultToggle').addEventListener('click',()=>setVaultExpanded($('vaultPanel').hidden));
async function vaultState(){
 const vault=(await chrome.storage.local.get(VAULT_KEY))[VAULT_KEY];
 const state=unlockedCredentials?'ready':vault?'locked':'setup';
 const changed=$('vaultToggle').dataset.state!==state;
 $('vaultSetup').hidden=!!vault;
 $('vaultUnlock').hidden=!vault||!!unlockedCredentials;
 $('vaultReady').hidden=!unlockedCredentials;
 $('resetVault').hidden=!vault;
 $('lockVault').hidden=!unlockedCredentials;
 $('sessionSeparator').hidden=!unlockedCredentials;
 $('vaultToggle').textContent=unlockedCredentials?.usuario||(vault?'Desbloquear':'Configurar acceso');
 $('vaultToggle').setAttribute('aria-label',unlockedCredentials?'Sesión de '+unlockedCredentials.usuario+'. Administrar credenciales':vault?'Desbloquear acceso institucional':'Configurar acceso institucional');
 $('vaultToggle').dataset.state=state;
 $('vaultToggle').disabled=false;
 if(changed){
  setVaultExpanded(state!=='ready');
  if(state==='locked')$('unlockMaster').focus();
  if(state==='setup')$('setupUser').focus();
 }
 $('submit').disabled=!unlockedCredentials&&tab!=='historial';
 $('preview').disabled=!unlockedCredentials&&tab!=='historial';
 return vault;
}
async function vaultOp(fn){if(vaultBusy)return;vaultBusy=true;vaultMessage('Procesando…');try{await fn()}catch(e){vaultMessage(e instanceof DOMException&&e.name==='OperationError'?'Contraseña maestra incorrecta o datos cifrados dañados.':e.message||'Error inesperado')}finally{vaultBusy=false;await vaultState()}}
$('saveVault').addEventListener('click',()=>vaultOp(async()=>{const usuario=$('setupUser').value.trim(),password=$('setupPassword').value,master=$('setupMaster').value,repeat=$('setupMasterRepeat').value;if(!usuario||!password)throw Error('Completa usuario y contraseña de SEP.');if(master.length<12)throw Error('La contraseña maestra debe tener al menos 12 caracteres.');if(master!==repeat)throw Error('Las contraseñas maestras no coinciden.');if((await chrome.storage.local.get(VAULT_KEY))[VAULT_KEY])throw Error('Ya existe una bóveda.');const encrypted=await encryptCredentials({usuario,password},master);await chrome.storage.local.set({[VAULT_KEY]:encrypted});unlockedCredentials={usuario,password};wipeCredentialFields();vaultMessage('Credenciales cifradas y guardadas. No olvides tu contraseña maestra: no se puede recuperar.')}));
$('unlockVault').addEventListener('click',()=>vaultOp(async()=>{const master=$('unlockMaster').value;if(!master)throw Error('Introduce tu contraseña maestra.');const vault=(await chrome.storage.local.get(VAULT_KEY))[VAULT_KEY];if(!vault)throw Error('No hay credenciales guardadas.');unlockedCredentials=await decryptCredentials(vault,master);wipeCredentialFields();vaultMessage('Credenciales desbloqueadas en esta pestaña.')}));
$('unlockMaster').addEventListener('keydown',e=>{if(e.key==='Enter')$('unlockVault').click()});
$('lockVault').addEventListener('click',async()=>{unlockedCredentials=null;wipeCredentialFields();vaultMessage('Sesión bloqueada.');await vaultState()});
$('changeVault').addEventListener('click',()=>vaultOp(async()=>{if(!unlockedCredentials)throw Error('Desbloquea la sesión primero.');if(!confirm('Para cambiar las credenciales tendrás que crear una nueva contraseña maestra. ¿Continuar?'))return;await chrome.storage.local.remove(VAULT_KEY);unlockedCredentials=null;wipeCredentialFields();vaultMessage('Configura nuevas credenciales.')}));
$('resetVault').addEventListener('click',()=>vaultOp(async()=>{if(!confirm('Esto borrará permanentemente las credenciales SEP guardadas en este navegador. No se borrará el historial. ¿Continuar?'))return;await chrome.storage.local.remove(VAULT_KEY);unlockedCredentials=null;wipeCredentialFields();vaultMessage('Credenciales borradas. Puedes volver a configurarlas.')}));
// Keep stored credential data inaccessible to content scripts if access-level API is available.
(async()=>{try{if(chrome.storage.local.setAccessLevel)await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});}catch(e){console.warn('No se pudo restringir storage.local',e)}await vaultState()})();
