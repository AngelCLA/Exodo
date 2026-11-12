const ENDPOINT='https://met.sep.gob.mx/met-ws/services/';
const MAX_XML_BYTES=1024*1024;
const MAX_ZIP_BYTES=50*1024*1024;
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
let unlockedCredentials=null, vaultBusy=false, sending=false, historyBusy=false, cancelTarget=null, cancelTrigger=null;
let tab='carga', lastResponse='', lastFilename='respuesta.xml', lastPayload=null, selectedFile=null, batchFiles=null, currentResults=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const node=(k,v)=>`<${k}>${esc(v)}</${k}>`;
const field=(id,label,type='text',placeholder='')=>`<label>${label}<input id="${id}" type="${type}" placeholder="${placeholder}" autocomplete="off"></label>`;
const get=(id)=>$(id)?.value?.trim()??'';
const parseXML=x=>{const d=new DOMParser().parseFromString(x,'application/xml');if(d.querySelector('parsererror'))throw Error('La respuesta no es XML válido');return d};
function findValue(xml,names){try{const d=parseXML(xml);const n=[...d.getElementsByTagName('*')].find(e=>names.includes(e.localName));return n?.textContent?.trim()||''}catch{return ''}}
const CANCEL_NOTICE='<div class="danger-notice" role="note"><strong>Aviso:</strong> Operación irreversible. Al enviar se ejecuta una cancelación real en la SEP. Revisa el folio antes de continuar.</div>';
function setFormAlert(message,type='error'){const el=$('formAlert');el.replaceChildren();if(message){const prefix=document.createElement('strong');prefix.textContent=type==='info'?'Aviso: ':'Error: ';el.append(prefix,document.createTextNode(message))}el.dataset.type=type;el.hidden=!message}
function updateFileInfo(){const selected=!!selectedFile,batch=!!batchFiles?.length;
 $('drop')?.classList.toggle('selected',selected);
 const label=$('filelabel');if(label)label.textContent=selected?batch?'ZIP de títulos seleccionado':'Título electrónico seleccionado':'Arrastra aquí tu título electrónico';
 const state=$('filestate');if(state)state.textContent=selected?batch?`${batchFiles.length} XML encontrados; cada uno se enviará por separado a la SEP. El ZIP no se envía.`:'Archivo seleccionado; aún no validado ni enviado a SEP.':'Seleccionar un archivo no lo envía a SEP.';
 const el=$('fileinfo');if(el)el.textContent=selected?batch?`${selectedFile.name} · ${batchFiles.length} XML`:`${selectedFile.name} · ${selectedFile.size.toLocaleString()} bytes`:'Ningún archivo seleccionado';
}
async function selectFile(file){
 selectedFile=file||null;batchFiles=null;setFormAlert('');
 if(selectedFile&&/\.zip$/i.test(selectedFile.name)){
  try{batchFiles=await xmlFilesFromZip(selectedFile)}
  catch(e){selectedFile=null;batchFiles=null;setFormAlert(e.message)}
 }
 updateFileInfo();
}
function updateSubmitHint(){const el=$('submitHint');if(!el)return;el.hidden=tab==='historial'||tab==='informacion'||!!unlockedCredentials}
function setTab(next,{moveFocus=false}={}){tab=next;selectedFile=null;batchFiles=null;cancelTarget=null;cancelTrigger=null;setFormAlert('');closeCancelModal({restoreFocus:false});
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
  <input type="file" id="file" accept=".xml,.zip,text/xml,application/xml,application/zip" aria-describedby="filehelp fileinfo filestate">
  <label for="file" class="file-selector">Seleccionar archivo</label>
  <div class="hint" id="fileinfo" role="status">Ningún archivo seleccionado</div>
  <div class="hint" id="filehelp">XML generado por SATE o ZIP con varios XML · Máximo por XML: 1 MB · El ZIP no se envía</div>
  <div class="hint" id="filestate">Seleccionar un archivo no lo envía a SEP.</div>
 </div>`,
 consulta:field('numeroLote','Número de lote','number','Ej. 123456'),
 descarga:field('numeroLote','Número de lote','number','Ej. 123456'),
 cancela:CANCEL_NOTICE+field('folioControl','Folio de control')+field('motCancelacion','Motivo de cancelación'),
 institucion:CANCEL_NOTICE+field('folioControl','Folio de control')+field('cveInstitucion','Clave de institución')+field('motCancelacion','Motivo de cancelación'),
 historial:`<div class="history-toolbar"><span id="historyCount" class="hint"></span></div><div id="history"></div>`,
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
      <div><dt>Versión de la extensión</dt><dd>1.1.0</dd></div>
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
  input.addEventListener('change',e=>{selectFile(e.target.files?.[0]||null)});
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')}));
  ['dragleave','dragend'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')}));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');const f=e.dataTransfer?.files?.[0];if(!f)return;selectedFile=f;try{const dt=new DataTransfer();dt.items.add(f);input.files=dt.files}catch(err){}selectFile(f)});
  updateFileInfo();
 }
 if(tab==='historial')renderHistory()
 if(isInformacion){$('saveInstitution').addEventListener('click',saveInstitution);$('resetInstitution').addEventListener('click',resetInstitution);renderInstitutionSettings()}
 $('submit').disabled=!unlockedCredentials&&tab!=='historial';$('preview').disabled=!unlockedCredentials&&tab!=='historial';
 updateSubmitHint();
 document.title=(tab==='carga'?'Cargar título electrónico':OPS[tab].title)+' · Éxodo';
 if(moveFocus)$('title').focus();
}
async function fileBase64(file){const bytes=new Uint8Array(await file.arrayBuffer());let b='';// Use chunks to avoid maximum argument-size issues.
 for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(b)}
async function buildCargaRequest(file){
 if(!file)throw Error('Selecciona un XML generado por SATE.');
 if(!/\.xml$/i.test(file.name))throw Error('Este prototipo acepta archivos .xml.');
 if(file.size>MAX_XML_BYTES)throw Error('El XML supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió el archivo.');
 const content=await file.text();const doc=parseXML(content);const root=doc.documentElement;if(root.localName!=='TituloElectronico'||!root.getAttribute('folioControl'))throw Error('El XML no tiene el elemento TituloElectronico y su folioControl.');
 const folio=root.getAttribute('folioControl');
 return {parts:node('nombreArchivo',file.name)+node('archivoBase64',await fileBase64(file)),reference:{folio,filename:file.name}};
}
function soapEnvelope(tag,parts,usuario,password){
 parts+=`<autenticacion>${node('usuario',usuario)}${node('password',password)}</autenticacion>`;
 const xml=`<?xml version="1.0" encoding="UTF-8"?><Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body><${tag} xmlns="${NS}">${parts}</${tag}></Body></Envelope>`;
 // Don't expose password or Base64 in the interface's preview.
 const safe=xml.replace(/<password>[\s\S]*?<\/password>/,'<password>••••••••</password>').replace(/<archivoBase64>[\s\S]*?<\/archivoBase64>/,'<archivoBase64>[CONTENIDO BASE64 OCULTO]</archivoBase64>');
 return {xml,safe};
}
async function buildRequest(){const usuario=unlockedCredentials?.usuario, password=unlockedCredentials?.password;
 if(!usuario||!password)throw Error('Desbloquea las credenciales institucionales antes de continuar.');
 let parts='';let reference={};
 if(tab==='carga'){
  const file=batchFiles?.[0]||selectedFile;
  if(batchFiles&&!batchFiles.length)throw Error('El ZIP no contiene archivos .xml.');
  const carga=await buildCargaRequest(file);parts=carga.parts;reference=carga.reference;
 }else if(tab==='consulta'||tab==='descarga'){
  const lot=get('numeroLote');if(!/^\d+$/.test(lot))throw Error('El número de lote debe ser un entero positivo.');parts=node('numeroLote',lot);reference.lot=lot;
 }else if(tab==='cancela'||tab==='institucion'){
  const folio=get('folioControl'),reason=get('motCancelacion');if(!folio||!reason)throw Error('Captura folio y motivo de cancelación.');
  parts=node('folioControl',folio);
  if(tab==='institucion'){const school=get('cveInstitucion');if(!school)throw Error('Captura la clave de institución.');parts+=node('cveInstitucion',school);reference.school=school}
  parts+=node('motCancelacion',reason);reference.folio=folio;
 }else throw Error('Operación no disponible');
 const {xml,safe}=soapEnvelope(OPS[tab].tag,parts,usuario,password);
 return {xml,safe,reference};
}
function status(s){$('status').textContent=s}
function setSummary(message){const el=$('summary');el.textContent=message;el.hidden=!message}
function resultsPlaceholder(){const el=$('results');el.removeAttribute('aria-busy');el.replaceChildren();const p=document.createElement('div');p.className='results-empty';p.textContent='Aquí aparecerá la tabla de resultados del lote.';el.append(p)}
function showSkeletons(){
 const el=$('results');
 el.replaceChildren();
 el.setAttribute('aria-busy','true');
 const box=document.createElement('div');
 box.className='results-skeleton';
 box.setAttribute('aria-hidden','true');
 const rows=Array.from({length:4},()=>'<div class="skeleton-row"><span></span><span></span><span></span><span></span></div>').join('');
 box.innerHTML=`<div class="skeleton-line skeleton-title"></div><div class="skeleton-line skeleton-subtitle"></div>${rows}`;
 el.append(box);
}
function clearSkeletons(){if($('results').getAttribute('aria-busy')==='true')resultsPlaceholder()}
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
async function xmlFilesFromZip(file){
 if(file.size>MAX_ZIP_BYTES)throw Error('El ZIP supera el límite local de 50 MiB (52.428.800 bytes). No se leyó ni se envió.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const entries=zipEntries(bytes).filter(e=>/\.xml$/i.test(e.name)&&!/(^|\/)__MACOSX\//.test(e.name)&&!/(^|\/)\._/.test(e.name));
 if(!entries.length)throw Error('El ZIP no contiene archivos .xml.');
 const files=[];
 for(const entry of entries){
  const data=await unzipEntry(bytes,entry);
  if(data.length>MAX_XML_BYTES)throw Error(`El XML ${entry.name} supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió.`);
  files.push(new File([data],entry.name.split('/').pop(),{type:'application/xml'}));
 }
 return files.sort((a,b)=>a.name.localeCompare(b.name));
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
function excelResultRows(rows){
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
const OLE_SIGNATURE=[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];
function oleStreams(bytes){
 if(bytes.length<512||!OLE_SIGNATURE.every((b,i)=>bytes[i]===b))throw Error('El archivo .xls no es un libro de Excel reconocible.');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),sectorSize=1<<d.getUint16(30,true),miniSize=1<<d.getUint16(32,true);
 if(sectorSize<512||sectorSize>4096||miniSize<8||miniSize>sectorSize)throw Error('El archivo .xls tiene una cabecera OLE inválida.');
 const fatCount=d.getUint32(44,true),dirStart=d.getUint32(48,true),cutoff=d.getUint32(56,true),miniFatStart=d.getUint32(60,true),miniFatCount=d.getUint32(64,true),difatStart=d.getUint32(68,true),difatCount=d.getUint32(72,true);
 if(fatCount>65536||miniFatCount>65536||difatCount>65536)throw Error('El archivo .xls tiene una tabla de sectores inválida.');
 const sectorOffset=s=>{const o=(s+1)*sectorSize;if(o+sectorSize>bytes.length)throw Error('El archivo .xls está incompleto.');return o};
 const fatSectors=[];
 for(let i=0;i<109&&fatSectors.length<fatCount;i++){const s=d.getUint32(76+i*4,true);if(s<0xfffffffa)fatSectors.push(s)}
 let difat=difatStart;
 for(let guard=0;fatSectors.length<fatCount&&difat<0xfffffffa&&guard<=difatCount;guard++){
  const o=sectorOffset(difat),per=sectorSize/4-1;
  for(let i=0;i<per&&fatSectors.length<fatCount;i++){const s=d.getUint32(o+i*4,true);if(s<0xfffffffa)fatSectors.push(s)}
  difat=d.getUint32(o+per*4,true);
 }
 const fat=[];
 for(const s of fatSectors){const o=sectorOffset(s);for(let i=0;i<sectorSize/4;i++)fat.push(d.getUint32(o+i*4,true))}
 const chain=start=>{
  const list=[],seen=new Set();let s=start;
  while(s<0xfffffffa){if(seen.has(s)||s>=fat.length||list.length>65536)throw Error('El archivo .xls tiene una cadena de sectores inválida.');seen.add(s);list.push(s);s=fat[s]}
  return list;
 };
 const chainBytes=(start,size)=>{
  const list=chain(start),out=new Uint8Array(size===undefined?list.length*sectorSize:Math.min(size,list.length*sectorSize));
  let written=0;
  for(const s of list){if(written>=out.length)break;const o=sectorOffset(s),take=Math.min(sectorSize,out.length-written);out.set(bytes.subarray(o,o+take),written);written+=take}
  return out;
 };
 const dirBytes=chainBytes(dirStart),dv=new DataView(dirBytes.buffer,dirBytes.byteOffset,dirBytes.byteLength),entries=[];
 for(let o=0;o+128<=dirBytes.length;o+=128){
  const type=dirBytes[o+66];if(type!==2&&type!==5)continue;
  const length=dv.getUint16(o+64,true);if(length<2||length>64)continue;
  let name='';for(let i=0;i<length-2;i+=2)name+=String.fromCharCode(dirBytes[o+i]|(dirBytes[o+i+1]<<8));
  entries.push({name,type,start:dv.getUint32(o+116,true),size:dv.getUint32(o+120,true)});
 }
 const root=entries.find(e=>e.type===5);
 const miniFatBytes=miniFatCount?chainBytes(miniFatStart,miniFatCount*sectorSize):new Uint8Array(0);
 const miniFat=new DataView(miniFatBytes.buffer,miniFatBytes.byteOffset,miniFatBytes.byteLength);
 const miniStream=root?chainBytes(root.start,root.size):new Uint8Array(0);
 return entries.filter(e=>e.type===2).map(entry=>{
  if(!entry.size)return {name:entry.name,data:new Uint8Array(0)};
  if(entry.size<cutoff){
   const out=new Uint8Array(entry.size),seen=new Set();let s=entry.start,written=0;
   while(written<entry.size&&s<0xfffffffa){
    if(seen.has(s)||s*miniSize+miniSize>miniStream.length)throw Error('El archivo .xls tiene un flujo interno inválido.');
    seen.add(s);const take=Math.min(miniSize,entry.size-written);out.set(miniStream.subarray(s*miniSize,s*miniSize+take),written);written+=take;s=miniFat.getUint32(s*4,true);
   }
   if(written<entry.size)throw Error('El archivo .xls está incompleto.');
   return {name:entry.name,data:out};
  }
  return {name:entry.name,data:chainBytes(entry.start,entry.size)};
 });
}
function biffChars(bytes,p,limit){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(limit<3)return '';
 const cch=d.getUint16(p,true),flags=bytes[p+2];let o=p+3,out='';
 if(flags&1){for(let i=0;i<cch&&o+1<p+limit;i++,o+=2)out+=String.fromCharCode(bytes[o]|(bytes[o+1]<<8))}
 else{for(let i=0;i<cch&&o<p+limit;i++,o++)out+=String.fromCharCode(bytes[o])}
 return out;
}
function rkNumber(rk){
 if(rk&1)return ((rk&2)?(rk|0)>>2:rkFloat(rk))/100;
 return (rk&2)?(rk|0)>>2:rkFloat(rk);
}
function rkFloat(rk){const buffer=new ArrayBuffer(8),d=new DataView(buffer);d.setUint32(4,rk&0xfffffffc);return d.getFloat64(0)}
function sstStrings(chunks){
 let ci=0,pos=0;
 const next=()=>{ci++;pos=0;if(ci>=chunks.length)throw Error('El libro de Excel tiene textos compartidos incompletos.')};
 const u8=()=>{if(pos>=chunks[ci].length)next();return chunks[ci][pos++]};
 const u16=()=>u8()|(u8()<<8);
 const u32=()=>(u16()|(u16()<<16))>>>0;
 const chars=(cch,high)=>{
  let out='',left=cch;
  while(left>0){
   if(pos>=chunks[ci].length)next();
   const step=high?2:1,available=Math.floor((chunks[ci].length-pos)/step),chunk=chunks[ci];
   if(available<=0)throw Error('El libro de Excel tiene textos compartidos inválidos.');
   const take=Math.min(left,available);
   if(high){for(let i=0;i<take;i++){out+=String.fromCharCode(chunk[pos]|(chunk[pos+1]<<8));pos+=2}}
   else{for(let i=0;i<take;i++)out+=String.fromCharCode(chunk[pos++])}
   left-=take;
   if(left>0){next();high=(u8()&1)!==0}
  }
  return out;
 };
 const skip=n=>{let left=n;while(left>0){if(pos>=chunks[ci].length)next();const take=Math.min(left,chunks[ci].length-pos);pos+=take;left-=take}};
 u32();
 const unique=u32(),list=[];
 if(unique>100000)throw Error('El libro de Excel tiene demasiados textos compartidos.');
 for(let n=0;n<unique;n++){
  const cch=u16(),flags=u8(),runs=(flags&8)?u16():0,extra=(flags&4)?u32():0;
  list.push(chars(cch,(flags&1)!==0));
  skip(runs*4+extra);
 }
 return list;
}
function readLegacyExcelRows(bytes){
 const streams=oleStreams(bytes),book=streams.find(s=>/^workbook$/i.test(s.name))||streams.find(s=>/^book$/i.test(s.name));
 if(!book)throw Error('El archivo .xls no contiene un libro de Excel reconocible.');
 const data=book.data,d=new DataView(data.buffer,data.byteOffset,data.byteLength),records=[];let o=0;
 while(o+4<=data.length&&records.length<200000){const type=d.getUint16(o,true),length=d.getUint16(o+2,true);if(o+4+length>data.length)break;records.push({type,start:o+4,length});o+=4+length}
 if(!records.length||records[0].type!==0x0809||d.getUint16(records[0].start,true)<0x0600)throw Error('El archivo .xls no usa el formato Excel 97-2003 (BIFF8).');
 let shared=[],sstError=null,sheet=null;
 for(let i=0;i<records.length;i++){
  const rec=records[i];
  if(rec.type===0x0085&&!sheet){
   const offset=d.getUint32(rec.start,true),cch=data[rec.start+6],flags=data[rec.start+7];let name='',p=rec.start+8;
   if(flags&1){for(let k=0;k<cch;k++,p+=2)name+=String.fromCharCode(data[p]|(data[p+1]<<8))}
   else{for(let k=0;k<cch;k++,p++)name+=String.fromCharCode(data[p])}
   sheet={name,offset};
  }else if(rec.type===0x00fc){
   const chunks=[data.subarray(rec.start,rec.start+rec.length)];
   let j=i+1;for(;j<records.length&&records[j].type===0x003c;j++)chunks.push(data.subarray(records[j].start,records[j].start+records[j].length));
   try{shared=sstStrings(chunks)}catch(e){sstError=e}
   i=j-1;
  }else if(rec.type===0x002f)throw Error('El libro de Excel está protegido con contraseña.');
  else if(rec.type===0x000a)break;
 }
 if(sstError)throw sstError;
 if(!sheet)throw Error('El libro de Excel no contiene hojas.');
 const rows=new Map();
 let pendingString=null;
 o=sheet.offset;
 for(let guard=0;o+4<=data.length&&guard<500000;guard++){
  const type=d.getUint16(o,true),length=d.getUint16(o+2,true);
  if(o+4+length>data.length)break;
  const p=o+4;
  const set=(r,c,v)=>{if(r>65535||c>255)return;let row=rows.get(r);if(!row)rows.set(r,row=new Map());row.set(c,v)};
  if(type===0x00fd)set(d.getUint16(p,true),d.getUint16(p+2,true),shared[d.getUint32(p+6,true)]??'');
  else if(type===0x0204||type===0x00d6)set(d.getUint16(p,true),d.getUint16(p+2,true),biffChars(data,p+6,length-6));
  else if(type===0x0203)set(d.getUint16(p,true),d.getUint16(p+2,true),d.getFloat64(p+6,true));
  else if(type===0x027e)set(d.getUint16(p,true),d.getUint16(p+2,true),rkNumber(d.getUint32(p+6,true)));
  else if(type===0x00bd){
   const r=d.getUint16(p,true),first=d.getUint16(p+2,true),count=Math.max(0,Math.floor((length-6)/6));
   for(let k=0;k<count;k++)set(r,first+k,rkNumber(d.getUint32(p+6+k*6,true)));
  }else if(type===0x0205)set(d.getUint16(p,true),d.getUint16(p+2,true),data[p+7]?'#ERROR':data[p+6]?'VERDADERO':'FALSO');
  else if(type===0x0006){
   const r=d.getUint16(p,true),c=d.getUint16(p+2,true);
   if(d.getUint16(p+6,true)!==0xffff)set(r,c,d.getFloat64(p+6,true));
   else{const kind=data[p+8];if(kind===0)pendingString={r,c};else if(kind===1)set(r,c,data[p+9]?'VERDADERO':'FALSO');else set(r,c,'')}
  }else if(type===0x0207&&pendingString){set(pendingString.r,pendingString.c,biffChars(data,p,length));pendingString=null}
  o+=4+length;
  if(type===0x000a)break;
 }
 let last=-1;for(const key of rows.keys())if(key>last)last=key;
 return Array.from({length:last+1},(_,r)=>{
  const row=rows.get(r);if(!row)return [];
  let width=-1;for(const key of row.keys())if(key>width)width=key;
  return Array.from({length:width+1},(_,c)=>row.get(c)??'');
 });
}
async function readExcelFromZip(bytes){
 const entries=zipEntries(bytes),sheet=entries.find(e=>/^xl\/worksheets\/sheet[0-9]+\.xml$/.test(e.name));
 if(sheet){
  const sharedEntry=entries.find(e=>e.name==='xl/sharedStrings.xml');let shared=[];
  if(sharedEntry){const doc=parseXML(new TextDecoder().decode(await unzipEntry(bytes,sharedEntry)));
   shared=nsText(doc,'si').map(si=>nsText(si,'t').map(n=>n.textContent).join(''))}
  const xml=parseXML(new TextDecoder().decode(await unzipEntry(bytes,sheet)));
  return excelResultRows(spreadsheetRows(xml,shared).filter(r=>r.some(v=>String(v??'').trim())));
 }
 const legacy=entries.find(e=>/\.xlsx?$/i.test(e.name)&&!/(^|\/)__MACOSX\//.test(e.name)&&!/(^|\/)\._/.test(e.name));
 if(legacy)return excelResultRows(readLegacyExcelRows(await unzipEntry(bytes,legacy)));
 throw Error('El ZIP no contiene un libro Excel (.xls o .xlsx) reconocible.');
}
function showResults(results){
 const el=$('results');el.removeAttribute('aria-busy');el.replaceChildren();if(!results.length){el.textContent='El Excel no contiene registros.';return}
 const title=document.createElement('strong');title.textContent=`Resultados por título: ${results.length} · Correctos: ${results.filter(r=>r.estatus==='1').length} · Errores: ${results.filter(r=>r.estatus==='2').length}`;el.append(title);
 const table=document.createElement('table');table.className='results-table';const head=document.createElement('thead');const tr=document.createElement('tr');for(const name of ['Archivo','Estatus','Descripción','Folio control']){const th=document.createElement('th');th.textContent=name;tr.append(th)}head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const r of results.slice(0,2000)){const tr=document.createElement('tr');const cells=[r.archivo,r.estatus==='1'?'1 · Correcto':r.estatus==='2'?'2 · Error':r.estatus,r.descripcion,r.folio];cells.forEach((val,i)=>{const td=document.createElement('td');if(i===1){if(r.estatus==='1')td.className='cell-ok';else if(r.estatus==='2')td.className='cell-error'}td.textContent=String(val);tr.append(td)});body.append(tr)}table.append(body);el.append(table);
}
function showBatchResults(rows){
 const el=$('results');el.removeAttribute('aria-busy');el.replaceChildren();
 if(!rows.length){resultsPlaceholder();return}
 const sent=rows.filter(r=>r.sent&&r.ok).length,uncertain=rows.filter(r=>r.uncertain).length;
 const title=document.createElement('strong');title.textContent=`XML procesados: ${rows.length} · Enviados: ${sent} · Con error: ${rows.length-sent-uncertain}${uncertain?` · Inciertos: ${uncertain}`:''}`;el.append(title);
 const table=document.createElement('table');table.className='results-table';
 const head=document.createElement('thead');const headRow=document.createElement('tr');
 for(const name of ['Archivo','Lote','Resultado','Detalle']){const th=document.createElement('th');th.textContent=name;headRow.append(th)}
 head.append(headRow);table.append(head);
 const body=document.createElement('tbody');
 for(const r of rows){const tr=document.createElement('tr');
  const cells=[r.archivo,r.lote||'—',r.sent?(r.ok?'Enviado':'Respuesta con error'):r.uncertain?'Incierto':'No enviado',r.detalle||''];
  cells.forEach((val,i)=>{const td=document.createElement('td');if(i===2){if(r.sent&&r.ok)td.className='cell-ok';else if(!r.uncertain)td.className='cell-error'}td.textContent=String(val);tr.append(td)});
  body.append(tr)}
 table.append(body);el.append(table);
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
function credentialsOrThrow(){const {usuario,password}=unlockedCredentials||{};if(!usuario||!password)throw Error('Desbloquea las credenciales institucionales antes de continuar.');return {usuario,password}}
function describeResponse(response){
 const xml=response.xml||'';
 const lot=findValue(xml,['numeroLote','numeroLoteRespuesta']);
 const fault=findValue(xml,['faultstring','Text']);
 const code=findValue(xml,['estatusLote','codigo','codigoRespuesta','estatus']);
 const msg=findValue(xml,['mensaje','mensajeRespuesta','descripcion']);
 const lines=[response.ok?'Solicitud HTTP aceptada (no implica éxito del trámite).':`Error HTTP o SOAP: ${response.error||response.status||'desconocido'}`,lot?`Número de lote: ${lot}`:'',code?`Estado/código: ${code}`:'',msg?`Mensaje: ${msg}`:'',fault?`SOAP Fault: ${fault}`:'','Revisa siempre el XML completo para confirmar el resultado.'].filter(Boolean);
 return {lot,fault,code,msg,lines};
}
async function showServiceResponse(type,response){
 $('response').textContent=response.xml||response.error||'Sin respuesta';
 if(!response.xml)return null;
 lastResponse=response.xml;lastFilename=`sep_${type}_${Date.now()}.xml`;$('downloadResponse').disabled=false;
 if(type!=='consulta'&&type!=='descarga')return null;
 lastPayload=extractPayload(response.xml);$('downloadPayload').disabled=!lastPayload;
 if(!lastPayload)return null;
 try{return await readExcelFromZip(lastPayload.bytes)}
 catch(e){$('results').removeAttribute('aria-busy');$('results').textContent='ZIP detectado. '+e.message+' Puedes descargar el ZIP original.';return null}
}
async function dispatchSoap(xml){
 const response=await chrome.runtime.sendMessage({type:'SOAP',endpoint:ENDPOINT,xml});
 if(response?.uncertain)throw Error(response.error||'No se pudo confirmar el resultado del envío.');
 if(response&&typeof response==='object'&&response.ok===false&&response.error&&!('status' in response)&&!('xml' in response))throw Error(response.error);
 if(!validWorkerReply(response))throw Error('La respuesta del servicio no se pudo confirmar.');
 return response;
}
async function sendBatch(){
 sending=true;
 try{
  const files=batchFiles.slice(),total=files.length;
  if(!total)throw Error('El ZIP no contiene archivos .xml.');
  const creds=unlockedCredentials;
  if(!creds?.usuario||!creds?.password)throw Error('Desbloquea las credenciales institucionales antes de continuar.');
  if(!confirm(`Se enviarán ${total} XML a la SEP, uno por uno y en solicitudes independientes. Cada XML puede generar su propio lote.\n\nEl ZIP no se envía. ¿Continuar?`))return;
  setFormAlert('');
  $('submit').disabled=true;$('submit').classList.add('loading');$('preview').disabled=true;
  $('responseTitle').closest('.panel').setAttribute('aria-busy','true');
  resetDownloads();lastResponse='';lastFilename=`sep_carga_${Date.now()}.xml`;
  const rows=[];
  for(let i=0;i<total;i++){
   const file=files[i],row={archivo:file.name,folio:'',lote:'',sent:false,uncertain:false,detalle:''};
   rows.push(row);showBatchResults(rows);
   status(`Enviando ${i+1} de ${total}: ${file.name}`);
   setSummary(`Enviando ${i+1} de ${total}…`);
   let dispatched=false;
   try{
    const carga=await buildCargaRequest(file);row.folio=carga.reference.folio;
    const {xml,safe}=soapEnvelope(OPS.carga.tag,carga.parts,creds.usuario,creds.password);$('request').textContent=safe;
    dispatched=true;
    const response=await chrome.runtime.sendMessage({type:'SOAP',endpoint:ENDPOINT,xml});
    if(response?.uncertain)throw Error(response.error||'No se pudo confirmar el resultado del envío.');
    if(response&&typeof response==='object'&&response.ok===false&&response.error&&!('status' in response)&&!('xml' in response))throw Error(response.error);
    if(!validWorkerReply(response))throw Error('La respuesta del servicio no se pudo confirmar.');
    const responseXml=response.xml||'';lastResponse=responseXml;$('response').textContent=responseXml;
    const lot=findValue(responseXml,['numeroLote','numeroLoteRespuesta']);
    const fault=findValue(responseXml,['faultstring','Text']);
    const code=findValue(responseXml,['estatusLote','codigo','codigoRespuesta','estatus']);
    const msg=findValue(responseXml,['mensaje','mensajeRespuesta','descripcion']);
    row.sent=true;row.ok=response.ok!==false;row.lote=lot;row.detalle=[`HTTP ${response.status||'-'}`,code,msg,fault].filter(Boolean).join(' · ');
    try{await saveRecord({id:crypto.randomUUID(),timestamp:new Date().toISOString(),type:'carga',lot:lot||'',filename:file.name,folio:row.folio,httpStatus:response.status||null,code,msg:msg||fault||'',response:'',results:[],error:response.error||''})}
    catch(e){row.detalle+=` · No se pudo guardar el historial (${e.message})`}
   }catch(e){row.uncertain=dispatched;row.detalle=e.message||'Error inesperado'}
   showBatchResults(rows);
  }
  const sent=rows.filter(r=>r.sent&&r.ok).length,uncertain=rows.filter(r=>r.uncertain).length,lots=rows.filter(r=>r.lote).map(r=>r.lote);
  status('Proceso terminado');
  setSummary([`XML procesados: ${rows.length}`,`Enviados: ${sent}`,rows.length-sent-uncertain>0?`Con error: ${rows.length-sent-uncertain}`:'',uncertain?`Resultado incierto: ${uncertain}`:'',lots.length?`Lotes: ${lots.join(', ')}`:'','Cada XML se envió en una solicitud independiente; el ZIP no se envió. El XML y la descarga corresponden al último envío. Revisa siempre el XML completo para confirmar el resultado.'].filter(Boolean).join('\n'));
  if(lastResponse)$('downloadResponse').disabled=false;
  selectedFile=null;batchFiles=null;updateFileInfo();
 }catch(e){status('No se envió');setSummary(e.message);setFormAlert(e.message)}
 finally{sending=false;$('submit').classList.remove('loading');$('submit').disabled=!unlockedCredentials;$('preview').disabled=!unlockedCredentials;$('responseTitle').closest('.panel').removeAttribute('aria-busy');clearSkeletons()}
}
async function send(){if(tab==='historial'||vaultBusy||sending)return;
 if(tab==='carga'&&batchFiles)return sendBatch();
 sending=true;let dispatched=false,received=false;
 try{
  setFormAlert('');
  const req=await buildRequest();$('request').textContent=req.safe;
  if(['cancela','institucion'].includes(tab)&&!confirm(`Vas a ejecutar una CANCELACIÓN REAL en la SEP.\n\nFolio: ${req.reference.folio}\n\n¿Confirmas continuar?`))return;
  $('submit').disabled=true;$('submit').classList.add('loading');$('preview').disabled=true;$('responseTitle').closest('.panel').setAttribute('aria-busy','true');status('Enviando solicitud…');setSummary('');resetDownloads();showSkeletons();
  dispatched=true;
  const response=await chrome.runtime.sendMessage({type:'SOAP',endpoint:ENDPOINT,xml:req.xml});
  if(response?.uncertain)throw Error(response.error||'No se pudo confirmar el resultado del envío.');
  if(response&&typeof response==='object'&&response.ok===false&&response.error&&!('status' in response)&&!('xml' in response)){dispatched=false;throw Error(response.error)}
  if(!validWorkerReply(response))throw Error('La respuesta del servicio no se pudo confirmar.');
  received=true;
  const parsed=await showServiceResponse(tab,response);
  if(parsed){currentResults=parsed;showResults(parsed)}
  const {lot,code,msg,fault,lines}=describeResponse(response);
  status(response.status?`HTTP ${response.status} · ${response.ms} ms`:`Error de conexión · ${response.ms||0} ms`);
  const summary=lines.join('\n');
  setSummary(summary);
  const record={id:crypto.randomUUID(),timestamp:new Date().toISOString(),type:tab,lot:lot||req.reference.lot||'',filename:req.reference.filename||'',folio:req.reference.folio||'',httpStatus:response.status||null,code,msg:msg||fault||'',response:'',results:currentResults.map(r=>({archivo:r.archivo,estatus:r.estatus,descripcion:r.descripcion,folio:r.folio})),error:response.error||''};
  try{await saveRecord(record)}catch(e){setSummary(`${summary}\nAviso: no se pudo guardar el historial (${e.message}). La respuesta recibida se conserva en esta pantalla.`);setFormAlert('La respuesta se recibió, pero no se pudo guardar el historial.','info')}
 }catch(e){if(!dispatched){status('No se envió');setSummary(e.message);setFormAlert(e.message)}else if(!received){const message=`No se pudo confirmar el resultado del envío. Consulta la SEP antes de reintentar; no hay reintento automático. Detalle: ${e.message}`;status('Resultado incierto');setSummary(message);setFormAlert(message,'info')}else{status('Respuesta recibida');setSummary(e.message);setFormAlert(e.message,'info')}}
 finally{sending=false;$('submit').classList.remove('loading');$('submit').disabled=!unlockedCredentials;$('preview').disabled=!unlockedCredentials;$('responseTitle').closest('.panel').removeAttribute('aria-busy');clearSkeletons()}
}
function download(data,name,type='text/xml'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
const TYPE_LABEL={carga:'Carga',consulta:'Consulta',descarga:'Descarga',cancela:'Cancelación',institucion:'Cancelación por institución'};
function formatHistoryDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}
function lotGroups(history){
 const groups=new Map();
 for(const rec of history||[]){
  if(!rec||!rec.lot||!['carga','consulta','descarga'].includes(rec.type))continue;
  const key=String(rec.lot);
  const group=groups.get(key)||{lot:key,createdAt:'',consultedAt:'',downloadedAt:'',folios:[]};
  if(rec.type==='carga'){
   if(rec.timestamp&&(!group.createdAt||rec.timestamp<group.createdAt))group.createdAt=rec.timestamp;
   if(rec.folio&&!group.folios.includes(rec.folio))group.folios.push(rec.folio);
  }
  if(rec.type==='consulta'&&rec.timestamp&&(!group.consultedAt||rec.timestamp>group.consultedAt))group.consultedAt=rec.timestamp;
  if(rec.type==='descarga'&&rec.timestamp&&(!group.downloadedAt||rec.timestamp>group.downloadedAt))group.downloadedAt=rec.timestamp;
  groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>String(b.createdAt||b.consultedAt||b.downloadedAt||'').localeCompare(String(a.createdAt||a.consultedAt||a.downloadedAt||'')));
}
const HISTORY_ICONS={
 consulta:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
 descarga:'<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
 cancelar:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="m9.5 13.5 5 5"/><path d="m14.5 13.5-5 5"/>'
};
function historyActionButton(label,action,group){
 const btn=document.createElement('button');btn.type='button';btn.className='secondary history-action';btn.dataset.action=action;btn.dataset.lot=group.lot;
 btn.title=label;
 btn.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${HISTORY_ICONS[action]||''}</svg><span>${esc(label)}</span>`;
 btn.addEventListener('click',()=>action==='cancelar'?openCancel(group.lot,group.folios,btn):runLotOperation(action,group.lot));
 return btn;
}
function historyDateCell(value){
 const td=document.createElement('td');
 if(!value){td.textContent='—';return td}
 const d=new Date(value);
 if(Number.isNaN(d.getTime())){td.textContent=String(value);return td}
 const date=document.createElement('div');date.textContent=d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'});
 const time=document.createElement('div');time.className='small';time.textContent=d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false});
 td.append(date,time);return td;
}
function renderHistoryTable(groups){
 const wrap=document.createElement('div');wrap.className='history-table-wrap';
 const table=document.createElement('table');table.className='results-table history-table';
 const head=document.createElement('thead'),headRow=document.createElement('tr');
 for(const name of ['Lote','Creación','Consulta','Descarga','Acciones']){const th=document.createElement('th');th.textContent=name;headRow.append(th)}
 head.append(headRow);table.append(head);
 const body=document.createElement('tbody');
 for(const group of groups){
  const row=document.createElement('tr');
  const lot=document.createElement('td');lot.textContent=group.lot;row.append(lot);
  row.append(historyDateCell(group.createdAt),historyDateCell(group.consultedAt),historyDateCell(group.downloadedAt));
  const actions=document.createElement('td'),actionsGroup=document.createElement('div');actionsGroup.className='history-actions';
  actionsGroup.append(historyActionButton('Consultar','consulta',group),historyActionButton('Descargar','descarga',group),historyActionButton('Cancelar','cancelar',group));
  actions.append(actionsGroup);
  row.append(actions);body.append(row);
 }
 table.append(body);wrap.append(table);return wrap;
}
function renderOtherOperations(records){
 const wrap=document.createElement('div');wrap.className='history-other';
 const title=document.createElement('strong');title.textContent=`Otras operaciones (${records.length})`;wrap.append(title);
 for(const rec of records.slice(0,50)){
  const row=document.createElement('div');row.className='history-row';
  const head=document.createElement('strong');head.textContent=`${(TYPE_LABEL[rec.type]||String(rec.type||'Operación')).toUpperCase()} · ${rec.lot?'Lote '+rec.lot:rec.folio?'Folio '+rec.folio:'Sin identificador'}`;row.append(head);
  const meta=document.createElement('div');meta.className='small';meta.textContent=[formatHistoryDate(rec.timestamp),rec.httpStatus?`HTTP ${rec.httpStatus}`:'',rec.filename||''].filter(Boolean).join(' · ');row.append(meta);
  const detail=document.createElement('div');detail.textContent=[rec.code,rec.msg].filter(Boolean).join(' · ')||rec.error||'Sin detalle';row.append(detail);
  wrap.append(row);
 }
 return wrap;
}
function setBackgroundInert(on){for(const el of document.querySelectorAll('header, .shell'))try{el.inert=on}catch(e){}}
function openCancel(lot,folios,trigger){
 cancelTarget={lot:String(lot),folio:folios.length===1?folios[0]:'',folios:folios.slice()};
 cancelTrigger=trigger||null;
 $('cancelModalTitle').textContent=`Cancelar título · lote ${cancelTarget.lot}`;
 $('cancelModalHint').textContent=`Operación real e irreversible en la SEP. ${cancelTarget.folios.length>1?`Este lote tiene ${cancelTarget.folios.length} folios registrados: confirma el folio correcto.`:'Confirma el folio antes de continuar.'}`;
 $('historyFolio').value=cancelTarget.folio||'';
 $('historyMotivo').value='';
 $('historyCancelStatus').textContent='';
 $('cancelModal').hidden=false;
 setBackgroundInert(true);
 $('historyFolio').focus();
}
function closeCancelModal({restoreFocus=true}={}){
 const trigger=cancelTrigger;
 cancelTarget=null;cancelTrigger=null;
 $('cancelModal').hidden=true;
 setBackgroundInert(false);
 $('historyCancelStatus').textContent='';
 if(restoreFocus&&trigger)trigger.focus();
}
$('cancelModal').addEventListener('keydown',e=>{
 if(e.key!=='Tab'||$('cancelModal').hidden)return;
 const items=[...$('cancelModal').querySelectorAll('button, input')].filter(el=>!el.disabled&&!el.hidden);
 if(!items.length)return;
 const first=items[0],last=items[items.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
$('historyCancelSubmit').addEventListener('click',()=>{if(cancelTarget)submitCancel(cancelTarget)});
$('historyCancelClose').addEventListener('click',()=>closeCancelModal());
$('cancelModalDismiss').addEventListener('click',()=>closeCancelModal());
$('cancelModalBackdrop').addEventListener('click',()=>closeCancelModal());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('cancelModal').hidden)closeCancelModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('cancelModal').hidden&&!$('vaultPanel').hidden)setVaultExpanded(false)});
$('cancelModal').hidden=true;
async function runLotOperation(type,lot){
 if(historyBusy){status('Hay una operación en curso; espera a que termine.');return}
 if(type!=='consulta'&&type!=='descarga')return;
 const value=String(lot||'').trim();
 if(!/^\d+$/.test(value)){setSummary('El número de lote debe ser un entero positivo.');status('No se envió');return}
 historyBusy=true;let dispatched=false;
 try{
  cancelTarget=null;setFormAlert('');resetDownloads();showSkeletons();setSummary('');
  status(type==='consulta'?`Consultando el lote ${value}…`:`Descargando el lote ${value}…`);
  const {usuario,password}=credentialsOrThrow();
  const {xml,safe}=soapEnvelope(OPS[type].tag,node('numeroLote',value),usuario,password);
  $('request').textContent=safe;
  dispatched=true;
  const response=await dispatchSoap(xml);
  const parsed=await showServiceResponse(type,response);
  if(parsed){currentResults=parsed;showResults(parsed)}
  const {code,msg,fault,lines}=describeResponse(response);
  status(response.status?`HTTP ${response.status} · ${response.ms} ms`:`Error de conexión · ${response.ms||0} ms`);
  const summary=[`${type==='consulta'?'Consulta':'Descarga'} del lote ${value}:`,...lines].join('\n');
  setSummary(summary);
  const record={id:crypto.randomUUID(),timestamp:new Date().toISOString(),type,lot:value,filename:'',folio:'',httpStatus:response.status||null,code,msg:msg||fault||'',response:'',results:currentResults.map(r=>({archivo:r.archivo,estatus:r.estatus,descripcion:r.descripcion,folio:r.folio})),error:response.error||''};
  try{await saveRecord(record)}catch(e){setSummary(`${summary}\nAviso: no se pudo guardar el historial (${e.message}).`)}
  await renderHistory();
 }catch(e){
  const message=dispatched?`No se pudo confirmar el resultado del envío. Consulta la SEP antes de reintentar; no hay reintento automático. Detalle: ${e.message}`:e.message;
  status(dispatched?'Resultado incierto':'No se envió');setSummary(message);
 }
 finally{historyBusy=false;clearSkeletons()}
}
async function submitCancel(target){
 if(historyBusy){const busy=$('historyCancelStatus');if(busy)busy.textContent='Hay una operación en curso; espera a que termine.';return}
 const folio=$('historyFolio')?.value?.trim()||'',motivo=$('historyMotivo')?.value?.trim()||'',feedback=$('historyCancelStatus');
 if(!folio||!motivo){if(feedback)feedback.textContent='Captura folio y motivo de cancelación.';return}
 historyBusy=true;let dispatched=false;
 try{
  setFormAlert('');resetDownloads();showSkeletons();setSummary('');status(`Cancelando el folio ${folio}…`);
  const {usuario,password}=credentialsOrThrow();
  const {xml,safe}=soapEnvelope(OPS.cancela.tag,node('folioControl',folio)+node('motCancelacion',motivo),usuario,password);
  $('request').textContent=safe;
  dispatched=true;
  const response=await dispatchSoap(xml);
  await showServiceResponse('cancela',response);
  const {code,msg,fault,lines}=describeResponse(response);
  status(response.status?`HTTP ${response.status} · ${response.ms} ms`:`Error de conexión · ${response.ms||0} ms`);
  const summary=[`Cancelación · lote ${target.lot} · folio ${folio}:`,...lines].join('\n');
  setSummary(summary);
  const record={id:crypto.randomUUID(),timestamp:new Date().toISOString(),type:'cancela',lot:target.lot,filename:'',folio,httpStatus:response.status||null,code,msg:msg||fault||'',response:'',results:[],error:response.error||''};
  try{await saveRecord(record)}catch(e){setSummary(`${summary}\nAviso: no se pudo guardar el historial (${e.message}).`)}
  cancelTarget=null;closeCancelModal({restoreFocus:false});await renderHistory();
 }catch(e){
  const message=dispatched?`No se pudo confirmar el resultado del envío. Consulta la SEP antes de reintentar; no hay reintento automático. Detalle: ${e.message}`:e.message;
  status(dispatched?'Resultado incierto':'No se envió');setSummary(message);
 }
 finally{historyBusy=false;clearSkeletons()}
}
async function renderHistory(){
 const el=$('history');if(!el)return;
 const {history=[]}=await chrome.storage.local.get('history');
 el.replaceChildren();
 const groups=lotGroups(history);
 const others=history.filter(rec=>rec&&(!rec.lot||!['carga','consulta','descarga'].includes(rec.type)));
 const count=$('historyCount');
 if(count)count.textContent=groups.length?`${groups.length} lote${groups.length===1?'':'s'}`:history.length?'Sin lotes':'Sin movimientos';
 if(!history.length){const empty=document.createElement('div');empty.className='empty-state';const strong=document.createElement('strong');strong.textContent='Sin movimientos todavía.';const p=document.createElement('p');p.textContent='Las operaciones que ejecutes aparecerán aquí y se guardan solo en este navegador.';empty.append(strong,p);el.append(empty);return}
 if(groups.length)el.append(renderHistoryTable(groups));
 else{const note=document.createElement('p');note.className='hint';note.textContent='Todavía no hay lotes. Carga un título para crear el primero.';el.append(note)}
 if(others.length)el.append(renderOtherOperations(others));
}
$('submit').addEventListener('click',send);
$('preview').addEventListener('click',async()=>{try{setFormAlert('');const req=await buildRequest();$('request').textContent=req.safe;setSummary(batchFiles?`Solicitud de muestra del primer XML (1 de ${batchFiles.length}). Cada archivo se enviará en una solicitud SOAP independiente; el ZIP no se envía.`:'Solicitud construida localmente. Aún no se ha enviado.');status('Vista previa disponible')}catch(e){setSummary(e.message);setFormAlert(e.message)}});
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
document.querySelectorAll('.nav').forEach(b=>{const label=b.textContent.trim();b.setAttribute('aria-label',label);b.title=label;b.addEventListener('click',()=>{setTab(b.dataset.tab,{moveFocus:true});if(isNarrowSidebar())setSidebarCollapsed(true,{persist:false,focusToggle:true})})});
$('sidebarToggle').addEventListener('click',()=>setSidebarCollapsed(!$('sidebar').classList.contains('collapsed'),{persist:!isNarrowSidebar()}));
if(sidebarMedia?.addEventListener)sidebarMedia.addEventListener('change',event=>setSidebarCollapsed(event.matches?true:desktopSidebarCollapsed,{persist:false}));
setSidebarCollapsed(isNarrowSidebar()?true:desktopSidebarCollapsed,{persist:false});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target;if(!(t instanceof HTMLElement)||t.tagName==='BUTTON'||t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&t.type==='file')||t.id==='unlockMaster')return;if(t.closest('#vaultSetup')){e.preventDefault();if(!vaultBusy)$('saveVault').click();return}if(t.closest('#cancelModal')){e.preventDefault();if(!historyBusy)$('historyCancelSubmit').click();return}if(t.closest('#fields')&&unlockedCredentials&&tab!=='historial'){e.preventDefault();send()}});
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
 $('vaultScrim').hidden=!expanded;
 $('vaultToggle').setAttribute('aria-expanded',String(expanded));
}
$('vaultToggle').addEventListener('click',()=>setVaultExpanded($('vaultPanel').hidden));
$('vaultScrim').addEventListener('click',()=>setVaultExpanded(false));
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
 updateSubmitHint();
 return vault;
}
async function vaultOp(fn){if(vaultBusy)return;vaultBusy=true;vaultMessage('Procesando…');try{await fn()}catch(e){vaultMessage(e instanceof DOMException&&e.name==='OperationError'?'Contraseña maestra incorrecta o datos cifrados dañados.':e.message||'Error inesperado')}finally{vaultBusy=false;await vaultState()}}
$('saveVault').addEventListener('click',()=>vaultOp(async()=>{const usuario=$('setupUser').value.trim(),password=$('setupPassword').value,master=$('setupMaster').value,repeat=$('setupMasterRepeat').value;if(!usuario||!password)throw Error('Completa usuario y contraseña de SEP.');if(master.length<8)throw Error('La contraseña maestra debe tener al menos 8 caracteres.');if(master!==repeat)throw Error('Las contraseñas maestras no coinciden.');if((await chrome.storage.local.get(VAULT_KEY))[VAULT_KEY])throw Error('Ya existe una bóveda.');const encrypted=await encryptCredentials({usuario,password},master);await chrome.storage.local.set({[VAULT_KEY]:encrypted});unlockedCredentials={usuario,password};wipeCredentialFields();vaultMessage('Credenciales cifradas y guardadas. No olvides tu contraseña maestra: no se puede recuperar.')}));
$('unlockVault').addEventListener('click',()=>vaultOp(async()=>{const master=$('unlockMaster').value;if(!master)throw Error('Introduce tu contraseña maestra.');const vault=(await chrome.storage.local.get(VAULT_KEY))[VAULT_KEY];if(!vault)throw Error('No hay credenciales guardadas.');unlockedCredentials=await decryptCredentials(vault,master);wipeCredentialFields();vaultMessage('Credenciales desbloqueadas en esta pestaña.')}));
$('unlockMaster').addEventListener('keydown',e=>{if(e.key==='Enter')$('unlockVault').click()});
$('lockVault').addEventListener('click',async()=>{unlockedCredentials=null;wipeCredentialFields();vaultMessage('Sesión bloqueada.');await vaultState()});
$('changeVault').addEventListener('click',()=>vaultOp(async()=>{if(!unlockedCredentials)throw Error('Desbloquea la sesión primero.');if(!confirm('Para cambiar las credenciales tendrás que crear una nueva contraseña maestra. ¿Continuar?'))return;await chrome.storage.local.remove(VAULT_KEY);unlockedCredentials=null;wipeCredentialFields();vaultMessage('Configura nuevas credenciales.')}));
$('resetVault').addEventListener('click',()=>vaultOp(async()=>{if(!confirm('Esto borrará permanentemente las credenciales SEP guardadas en este navegador. No se borrará el historial. ¿Continuar?'))return;await chrome.storage.local.remove(VAULT_KEY);unlockedCredentials=null;wipeCredentialFields();vaultMessage('Credenciales borradas. Puedes volver a configurarlas.')}));
// Keep stored credential data inaccessible to content scripts if access-level API is available.
(async()=>{try{if(chrome.storage.local.setAccessLevel)await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});}catch(e){console.warn('No se pudo restringir storage.local',e)}await vaultState()})();
