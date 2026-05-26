/* ================================================
   GRABACIONES.JS — Módulo de Grabaciones Netcontact
   ================================================ */

const API_GRAB = 'http://127.0.0.1:3000/api';

const ESTADOS_GRAB = [
  { id:'pendiente', label:'PENDIENTE', cls:'bg-pendiente' },
  { id:'grabado',   label:'GRABADO',   cls:'bg-grabado'   },
  { id:'observado', label:'OBSERVADO', cls:'bg-observado' },
  { id:'revisado',  label:'REVISADO',  cls:'bg-revisado'  },
];

let ventas            = [];
let ventasFiltradas   = [];
let tabActiva         = 'hoy';
let paginaActual      = 1;
let porPagina         = 18;
let editandoId        = null;
let busquedaVal       = '';
let usuarioActual     = 'Grabaciones';
let archivoSeleccionado = null;

function fechaHoy(){ return new Date().toISOString().split('T')[0]; }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}); }
function formatF(f){ if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function estadoGrab(id){ return ESTADOS_GRAB.find(e=>e.id===id)||ESTADOS_GRAB[0]; }
function badgeGrab(id, vid){ const e=estadoGrab(id); return `<span class="badge-grab ${e.cls}" onclick="abrirModalEstado(${vid})" title="Cambiar estado">${e.label}</span>`; }
function toast(msg){ const el=document.getElementById('toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); }
function cerrarModal(id){ document.getElementById(id)?.classList.remove('open'); editandoId=null; archivoSeleccionado=null; }

async function cargarVentas(){
  try {
    const res  = await fetch(`${API_GRAB}/ventas`, { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data
        .filter(v => ['validado','instalado','programado'].includes(v.estado))
        .map(v => ({
          ...v,
          nombreApellidos:  v.nombre      || '',
          dni:              v.dni         || '',
          telefonoContacto: v.telefono1   || '',
          vendedor:         v.asesor_nombre || v.vendedor || '',
          obsBackOffice:    v.obs_backoffice || '',
          fechaIngreso:     v.created_at ? v.created_at.split(' ')[0] : '',
          _estadoGrab:      v._estadoGrab || 'pendiente',
          _grabAudio:       null,
          _grabNombre:      '',
          _grabObs:         '',
        }));
      return;
    }
  } catch(e) { console.error('Error cargando grabaciones:', e); }
  ventas = [];
}

async function actualizarVentaBackend(id, cambios){
  try {
    await fetch(`${API_GRAB}/ventas/${id}`, {
      method:  'PATCH',
      headers: ncHeaders(),
      body:    JSON.stringify(cambios),
    });
  } catch(e) { console.error('Error actualizando:', e); }
}

function getVentasHoy(){ const hoy=fechaHoy(); return ventas.filter(v=>v.fechaIngreso===hoy||v._fecha===hoy); }
function getVentasPendientes(){ const hoy=fechaHoy(); return ventas.filter(v=>{ const fecha=v.fechaIngreso||v._fecha||''; return fecha<hoy&&v._estadoGrab==='pendiente'; }); }
function getVentasTab(){ return tabActiva==='hoy'?getVentasHoy():getVentasPendientes(); }

function aplicarFiltros(){
  let base=getVentasTab();
  const fEstado   = document.getElementById('f_estado')?.value   || '';
  const fVendedor = document.getElementById('f_vendedor')?.value.toLowerCase() || '';
  const fDesde    = document.getElementById('f_desde')?.value    || '';
  const fHasta    = document.getElementById('f_hasta')?.value    || '';
  base=base.filter(v=>{
    if(fEstado   && v._estadoGrab!==fEstado) return false;
    if(fVendedor && !(v.vendedor||'').toLowerCase().includes(fVendedor)) return false;
    const fecha=v.fechaIngreso||v._fecha||'';
    if(fDesde&&fecha<fDesde) return false;
    if(fHasta&&fecha>fHasta) return false;
    if(busquedaVal){ const b=busquedaVal.toLowerCase(); const campos=[v.nombreApellidos,v.dni,v.telefonoContacto,v.vendedor].map(x=>(x||'').toLowerCase()); if(!campos.some(c=>c.includes(b))) return false; }
    return true;
  });
  ventasFiltradas=base; paginaActual=1; renderTabla(); actualizarKpis(); actualizarTabCounts();
}

function limpiarFiltros(){
  ['f_estado','f_vendedor','f_desde','f_hasta'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  busquedaVal=''; const bs=document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

function actualizarKpis(){
  const hoy=getVentasHoy(), pend=getVentasPendientes();
  const grabados=ventas.filter(v=>v._estadoGrab==='grabado').length;
  const obs=ventas.filter(v=>v._estadoGrab==='observado').length;
  document.getElementById('kpi-hoy').textContent       = hoy.length;
  document.getElementById('kpi-pendientes').textContent = pend.length;
  document.getElementById('kpi-grabados').textContent   = grabados;
  document.getElementById('kpi-observados').textContent = obs;
}

function actualizarTabCounts(){
  document.getElementById('countHoy').textContent  = getVentasHoy().length;
  document.getElementById('countPend').textContent = getVentasPendientes().length;
}

function cambiarTab(tab, btn){
  tabActiva=tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  busquedaVal=''; const bs=document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

function renderTabla(){
  const tbody=document.getElementById('tablaBody');
  const total=ventasFiltradas.length;
  const inicio=(paginaActual-1)*porPagina, fin=Math.min(inicio+porPagina,total);
  const pagina=ventasFiltradas.slice(inicio,fin);
  const hoy=fechaHoy();
  document.getElementById('tablaCount').textContent=`${total} registros`;
  document.getElementById('pagInfo').textContent=total?`Mostrando ${inicio+1}–${fin} de ${total}`:'';
  if(!pagina.length){ tbody.innerHTML=`<tr><td colspan="10" class="tabla-empty">${tabActiva==='hoy'?'No hay ventas validadas para hoy.':'No hay ventas pendientes.'}</td></tr>`; renderPaginacion(0); return; }
  tbody.innerHTML=pagina.map(v=>{
    const fecha=v.fechaIngreso||v._fecha||'';
    const esAnterior=fecha<hoy;
    const tieneAudio=!!v._grabAudio;
    const nombreSafe=(v.nombreApellidos||'').substring(0,30).replace(/'/g,"\\'");
    return `<tr class="${v._estadoGrab==='pendiente'&&esAnterior?'fila-pendiente':''}">
      <td><div class="acciones-cell">
        <button class="btn-acc btn-acc-audio" onclick="abrirModalAudio(${v.id})" title="Ver grabación">🎙️ ${tieneAudio?'Audio':'Sin audio'}</button>
        <button class="btn-acc btn-acc-subir" onclick="abrirModalSubir(${v.id})" title="Subir grabación">📎 Subir</button>
        <button class="btn-acc btn-acc-obs"   onclick="abrirModalObs(${v.id})"   title="Observación">💬</button>
        <button class="btn-acc" style="border-color:#c4b5fd;background:#faf5ff;" onclick="hAbrir(${v.id},{nombre:'${nombreSafe}',dni:'${v.dni||''}',n1:'${v.telefonoContacto||''}'})" title="Historial">📋</button>
      </div></td>
      <td>${badgeGrab(v._estadoGrab,v.id)}</td>
      <td><span style="color:#185FA5;font-weight:700;font-size:11px">${formatF(fecha)}</span>${esAnterior?'<span class="badge-anterior">ANTERIOR</span>':''}</td>
      <td style="font-weight:600">${v.nombreApellidos||'—'}</td>
      <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
      <td style="font-family:monospace;color:#185FA5;font-weight:700">${v.telefonoContacto||'—'}</td>
      <td style="font-weight:600;color:#7C3AED">${v.vendedor||'—'}</td>
      <td style="font-size:11px">${v.supervisor||'—'}</td>
      <td>${tieneAudio?`<span style="color:#16a34a;font-weight:600;font-size:11px">✅ ${v._grabNombre||'Archivo subido'}</span>`:`<span style="color:#9ca3af;font-size:11px;font-style:italic">Sin grabación</span>`}</td>
      <td style="font-size:10px;color:#6b7280">${v._grabObs?`💬 ${v._grabObs.split('\n').slice(-1)[0].substring(0,50)}...`:'—'}</td>
    </tr>`;
  }).join('');
  renderPaginacion(total);
}

function renderPaginacion(total){
  const totalPags=Math.max(1,Math.ceil(total/porPagina));
  const cont=document.getElementById('paginacionBtns');
  let html=`<button class="pag-btn" onclick="irPagina(${paginaActual-1})" ${paginaActual===1?'disabled':''}>‹</button>`;
  let ini=Math.max(1,paginaActual-3),fin=Math.min(totalPags,ini+6);
  if(fin-ini<6) ini=Math.max(1,fin-6);
  if(ini>1) html+=`<button class="pag-btn" onclick="irPagina(1)">1</button>${ini>2?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}`;
  for(let i=ini;i<=fin;i++) html+=`<button class="pag-btn ${i===paginaActual?'active':''}" onclick="irPagina(${i})">${i}</button>`;
  if(fin<totalPags) html+=`${fin<totalPags-1?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}<button class="pag-btn" onclick="irPagina(${totalPags})">${totalPags}</button>`;
  html+=`<button class="pag-btn" onclick="irPagina(${paginaActual+1})" ${paginaActual===totalPags?'disabled':''}>›</button>`;
  cont.innerHTML=html;
}

function irPagina(p){ paginaActual=Math.max(1,Math.min(p,Math.ceil(ventasFiltradas.length/porPagina)||1)); renderTabla(); document.querySelector('.tabla-scroll')?.scrollTo(0,0); }

function abrirModalEstado(id){ const v=ventas.find(x=>x.id===id); if(!v) return; editandoId=id; document.getElementById('re_estadoActual').textContent=estadoGrab(v._estadoGrab).label; document.getElementById('re_nuevoEstado').value=v._estadoGrab; document.getElementById('modalEstado').classList.add('open'); }

async function guardarEstado(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const nuevo=document.getElementById('re_nuevoEstado').value;
  const grabAnterior=estadoGrab(v._estadoGrab).label;
  v._estadoGrab=nuevo;
  hRegistrar(v.id,v,'Estado grabación',grabAnterior,estadoGrab(nuevo).label,'Grabaciones');
  await actualizarVentaBackend(v.id, { estado: v.estado, obs_backoffice: v.obsBackOffice||'' });
  cerrarModal('modalEstado'); aplicarFiltros();
  toast(`🔄 Estado: ${estadoGrab(nuevo).label}`);
}

function abrirModalSubir(id){ const v=ventas.find(x=>x.id===id); if(!v) return; editandoId=id; archivoSeleccionado=null; document.getElementById('subir_nombre').textContent=v.nombreApellidos||'—'; document.getElementById('subir_info').textContent=''; document.getElementById('archivoGrab').value=''; document.getElementById('modalSubir').classList.add('open'); }

function handleFileSelect(files){
  if(!files.length) return;
  const file=files[0];
  const tipos=['audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/webm','audio/x-m4a','video/mp4'];
  if(!tipos.includes(file.type)&&!file.name.match(/\.(mp3|wav|ogg|m4a|mp4|webm)$/i)){ toast('⚠️ Solo archivos de audio (mp3, wav, ogg, m4a)'); return; }
  archivoSeleccionado=file;
  document.getElementById('subir_info').innerHTML=`<span style="color:#16a34a;font-weight:600;">✅ ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)</span>`;
}

async function guardarAudio(){
  if(!archivoSeleccionado){ toast('⚠️ Selecciona un archivo primero'); return; }
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const url=URL.createObjectURL(archivoSeleccionado);
  v._grabAudio=url; v._grabNombre=archivoSeleccionado.name;
  const estadoAntes=v._estadoGrab;
  v._estadoGrab=v._estadoGrab==='pendiente'?'grabado':v._estadoGrab;
  hRegistrar(v.id,v,'Grabación subida',estadoAntes,archivoSeleccionado.name,'Grabaciones');
  cerrarModal('modalSubir'); aplicarFiltros();
  toast(`✅ Grabación: ${archivoSeleccionado.name}`);
}

function abrirModalAudio(id){ const v=ventas.find(x=>x.id===id); if(!v) return; editandoId=id; document.getElementById('audio_nombre').textContent=v.nombreApellidos||'—'; document.getElementById('audio_asesor').textContent=v.vendedor||'—'; document.getElementById('audio_fecha').textContent=formatF(v.fechaIngreso||v._fecha||''); const player=document.getElementById('audioPlayer'), noAudio=document.getElementById('audioNoDisp'); if(v._grabAudio){ player.src=v._grabAudio; player.style.display=''; noAudio.style.display='none'; document.getElementById('audio_archivo').textContent=v._grabNombre||'grabacion.mp3'; } else { player.style.display='none'; noAudio.style.display=''; document.getElementById('audio_archivo').textContent='—'; } document.getElementById('modalAudio').classList.add('open'); }

function abrirModalObs(id){ const v=ventas.find(x=>x.id===id); if(!v) return; editandoId=id; document.getElementById('obs_nombre').textContent=v.nombreApellidos||'—'; document.getElementById('obs_historial').textContent=v._grabObs||'Sin observaciones previas.'; document.getElementById('obs_nueva').value=''; document.getElementById('modalObs').classList.add('open'); }

async function guardarObservacion(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const nueva=document.getElementById('obs_nueva').value.trim();
  if(!nueva){ toast('⚠️ Escribe una observación'); return; }
  const prev=v._grabObs?v._grabObs+'\n':'';
  v._grabObs=prev+`[${formatF(fechaHoy())} ${horaAhora()} - ${usuarioActual}] ${nueva}`;
  hRegistrar(v.id,v,'Observación grabación','—',nueva.substring(0,60),'Grabaciones');
  await actualizarVentaBackend(v.id, { observacion: v._grabObs });
  cerrarModal('modalObs'); aplicarFiltros();
  toast('✅ Observación guardada');
}

function actualizarFecha(){ const el=document.getElementById('topbarFecha'); if(!el) return; const ahora=new Date(); const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']; const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; el.textContent=`${dias[ahora.getDay()]} ${ahora.getDate()} ${meses[ahora.getMonth()]} · ${horaAhora()}`; }

window.onload = async () => {
  const sesion=ncGetSesion(); if(sesion) usuarioActual=sesion.nombre||'Grabaciones';
  const selE=document.getElementById('f_estado');
  if(selE) selE.innerHTML='<option value="">Todos</option>'+ESTADOS_GRAB.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  const selRE=document.getElementById('re_nuevoEstado');
  if(selRE) selRE.innerHTML=ESTADOS_GRAB.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  await cargarVentas(); aplicarFiltros(); actualizarFecha(); setInterval(actualizarFecha,60000);
  ['modalEstado','modalSubir','modalAudio','modalObs'].forEach(id=>{ document.getElementById(id)?.addEventListener('click',e=>{ if(e.target===document.getElementById(id)) cerrarModal(id); }); });
  document.getElementById('selectPorPagina')?.addEventListener('change',e=>{ porPagina=parseInt(e.target.value)||18; paginaActual=1; renderTabla(); });
  setInterval(async()=>{ await cargarVentas(); aplicarFiltros(); },60000);
};