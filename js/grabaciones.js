/* ================================================
   GRABACIONES.JS — Módulo de Grabaciones Netcontact
   ================================================ */

const API_GRAB = window.NC_API + '/api';
const GRAB_TAB_KEY = 'nc_grabaciones_tab';

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

/* Fecha Peru UTC-5 */
function fechaHoy(){
  const ahora = new Date();
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const peru  = new Date(utcMs + (-5 * 60 * 60000));
  return peru.getFullYear() + '-' +
    String(peru.getMonth()+1).padStart(2,'0') + '-' +
    String(peru.getDate()).padStart(2,'0');
}

function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}); }
function formatF(f){ if(!f)return'—'; const p=f.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function estadoGrab(id){ return ESTADOS_GRAB.find(e=>e.id===id)||ESTADOS_GRAB[0]; }
function badgeGrab(id){ const e=estadoGrab(id); return '<span class="badge-grab '+e.cls+'">'+e.label+'</span>'; }
function toast(msg){ const el=document.getElementById('toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); }
function cerrarModal(id){ document.getElementById(id)?.classList.remove('open'); editandoId=null; archivoSeleccionado=null; }

/* ── DESCARGAR AUDIO ── */
function descargarAudio(id){
  const v = ventas.find(x => x.id === id);
  if (!v || !v._grabAudio) { toast('Esta venta no tiene grabación'); return; }

  const url = window.NC_API + '/' + v._grabAudio;
  const nombreArchivo = v._grabNombre || ('grabacion_' + id + '.mp3');

  const a = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  a.target   = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Descargando: ' + nombreArchivo);
}

async function cargarVentas(){
  try {
    const res  = await fetch(API_GRAB + '/ventas', { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data
        .filter(v => {
          const e = (v.estado||'').toLowerCase();
          return e === 'validado' || e === 'venta';
        })
        .map(v => {
          const fechaRaw = (v.created_at || '').split(' ')[0].split('T')[0];
          return {
            ...v,
            nombreApellidos:  v.nombre        || '',
            dni:              v.dni           || '',
            telefonoContacto: v.telefono1     || '',
            vendedor:         v.asesor_nombre || '',
            fechaIngreso:     fechaRaw,
            _estadoGrab:      v.estado_grab || 'pendiente',
            _grabAudio:       v.audio_path    || null,
            _grabNombre:      v.audio_path    ? v.audio_path.split('/').pop() : '',
            _grabObs:         v.observacion   || '',
          };
        });
      return;
    }
  } catch(e) { console.error('Error cargando grabaciones:', e); }
  ventas = [];
}

async function actualizarVentaBackend(id, cambios){
  try {
    await fetch(API_GRAB + '/ventas/' + id, {
      method: 'PATCH', headers: ncHeaders(), body: JSON.stringify(cambios),
    });
  } catch(e) { console.error('Error actualizando:', e); }
}

function getVentasHoy(){
  const hoy = fechaHoy();
  return ventas.filter(v => v.fechaIngreso === hoy);
}

function getVentasPendientes(){
  const hoy = fechaHoy();
  return ventas.filter(v => v.fechaIngreso < hoy);
}

function getVentasTab(){ return tabActiva==='hoy' ? getVentasHoy() : getVentasPendientes(); }

function aplicarFiltros(){
  let base = getVentasTab();
  const fVendedor = (document.getElementById('f_vendedor')?.value || '').toLowerCase();
  const fDesde    = document.getElementById('f_desde')?.value    || '';
  const fHasta    = document.getElementById('f_hasta')?.value    || '';
  const fDoc      = (document.getElementById('f_doc')?.value     || '').toLowerCase();
  const fEstado   = document.getElementById('f_estado')?.value   || '';

  base = base.filter(v => {
    if (fVendedor && !(v.vendedor||'').toLowerCase().includes(fVendedor)) return false;
    if (fDesde    && v.fechaIngreso < fDesde) return false;
    if (fHasta    && v.fechaIngreso > fHasta) return false;
    if (fDoc      && !(v.dni||'').toLowerCase().includes(fDoc)) return false;
    if (fEstado   && v._estadoGrab !== fEstado) return false;
    if (busquedaVal) {
      const b = busquedaVal.toLowerCase();
      if (![(v.nombreApellidos||''),(v.dni||''),(v.telefonoContacto||''),(v.vendedor||'')].some(c=>c.toLowerCase().includes(b))) return false;
    }
    return true;
  });

  ventasFiltradas = base;
  paginaActual = 1;
  renderTabla();
  actualizarKpis();
  actualizarTabCounts();
}

function limpiarFiltros(){
  ['f_vendedor','f_desde','f_hasta','f_doc'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  busquedaVal = '';
  const bs = document.getElementById('busquedaInput'); if(bs) bs.value = '';
  const fe = document.getElementById('f_estado'); if(fe) fe.value = '';
  aplicarFiltros();
}

function actualizarKpis(){
  const hoy  = getVentasHoy();
  const pend = getVentasPendientes();
  const elHoy  = document.getElementById('kpi-hoy');
  const elPend = document.getElementById('kpi-pendientes');
  const elGrab = document.getElementById('kpi-grabados');
  const elObs  = document.getElementById('kpi-observados');
  if(elHoy)  elHoy.textContent  = hoy.length;
  if(elPend) elPend.textContent = pend.length;
  if(elGrab) elGrab.textContent = ventas.filter(v=>v._estadoGrab==='grabado').length;
  if(elObs)  elObs.textContent  = ventas.filter(v=>v._estadoGrab==='observado').length;
}

function actualizarTabCounts(){
  const cH = document.getElementById('countHoy');
  const cP = document.getElementById('countPend');
  if(cH) cH.textContent = getVentasHoy().length;
  if(cP) cP.textContent = getVentasPendientes().length;
}

function cambiarTab(tab, btn){
  tabActiva = tab;
  try{ sessionStorage.setItem(GRAB_TAB_KEY, tab); }catch(e){}
  const activeBtn = btn || buscarTabGrabaciones(tab);
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b === activeBtn));
  busquedaVal = '';
  const bs = document.getElementById('busquedaInput'); if(bs) bs.value = '';
  aplicarFiltros();
}

function buscarTabGrabaciones(tab){
  return Array.from(document.querySelectorAll('.tab-btn')).find(b=>{
    const on=b.getAttribute('onclick')||'';
    return on.includes("cambiarTab('" + tab + "'") || on.includes('cambiarTab("' + tab + '"');
  }) || null;
}

function restaurarTabGrabaciones(){
  let tab='';
  try{ tab=sessionStorage.getItem(GRAB_TAB_KEY)||''; }catch(e){}
  if(!tab) return false;
  cambiarTab(tab, buscarTabGrabaciones(tab));
  return true;
}

function renderTabla(){
  const tbody  = document.getElementById('tablaBody');
  const total  = ventasFiltradas.length;
  const inicio = (paginaActual-1)*porPagina;
  const fin    = Math.min(inicio+porPagina, total);
  const pagina = ventasFiltradas.slice(inicio, fin);
  const hoy    = fechaHoy();

  document.getElementById('tablaCount').textContent = total + ' registros';
  const piInfo = document.getElementById('pagInfo');
  if(piInfo) piInfo.textContent = total ? 'Mostrando '+(inicio+1)+'–'+fin+' de '+total : '';

  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="tabla-empty">'+(tabActiva==='hoy'?'No hay ventas validadas para hoy.':'No hay ventas pendientes.')+'</td></tr>';
    renderPaginacion(0); return;
  }

  tbody.innerHTML = pagina.map(v => {
    const fecha      = v.fechaIngreso || '';
    const esAnterior = fecha < hoy;
    const tieneAudio = !!v._grabAudio;
    const nombreSeguro = (v.nombreApellidos||'').replace(/'/g, '');
    return '<tr class="'+(esAnterior?'fila-pendiente':'')+'">'+
      '<td><div class="acciones-cell">'+
        '<button class="btn-acc btn-acc-audio" onclick="abrirModalAudio('+v.id+')" title="Escuchar grabacion">Escuchar</button>'+
        (tieneAudio
          ? '<button class="btn-acc btn-acc-dl" onclick="descargarAudio('+v.id+')" title="Descargar grabacion">Descargar</button>'
          : '<button class="btn-acc btn-acc-dl" disabled title="Sin grabacion" style="opacity:.35;cursor:not-allowed;">Descargar</button>')+
        '<button class="btn-acc btn-acc-obs"   onclick="abrirModalObs('+v.id+')"   title="Observacion">Obs.</button>'+
        '<button class="btn-acc btn-acc-subir" onclick="abrirModalSubir('+v.id+')" title="Subir grabacion">Subir</button>'+
        '<button class="btn-acc btn-acc-estado" onclick="abrirModalEstado('+v.id+')" title="Cambiar estado">Estado</button>'+
        '<button class="btn-fotos" onclick="abrirModalFotos('+v.id+', \''+nombreSeguro+'\')" title="Ver fotos">📷 Fotos</button>'+
      '</div></td>'+
      '<td>'+badgeGrab(v._estadoGrab)+'</td>'+
      '<td><span style="color:#185FA5;font-weight:700;font-size:11px">'+formatF(fecha)+'</span>'+(esAnterior?'<span class="badge-anterior">ANTERIOR</span>':'')+'</td>'+
      '<td style="font-weight:600">'+(v.nombreApellidos||'—')+'</td>'+
      '<td style="font-family:monospace;font-size:11px">'+(v.dni||'—')+'</td>'+
      '<td style="font-family:monospace;color:#185FA5;font-weight:700">'+(v.telefonoContacto||'—')+'</td>'+
      '<td style="font-weight:600;color:#7C3AED">'+(v.vendedor||'—')+'</td>'+
      '<td style="font-size:11px">'+(v.supervisor||'—')+'</td>'+
      '<td>'+(tieneAudio
        ?'<span style="color:#16a34a;font-weight:600;font-size:11px">'+(v._grabNombre||'Archivo subido')+'</span>'
        :'<span style="color:#9ca3af;font-size:11px;font-style:italic">Sin grabacion</span>')+'</td>'+
      '<td style="font-size:10px;color:#6b7280">'+(v._grabObs?v._grabObs.split('\n').slice(-1)[0].substring(0,50):'—')+'</td>'+
    '</tr>';
  }).join('');

  renderPaginacion(total);
}

function renderPaginacion(total){
  const totalPags = Math.max(1, Math.ceil(total/porPagina));
  const cont = document.getElementById('paginacionBtns');
  if(!cont) return;
  let html = '<button class="pag-btn" onclick="irPagina('+(paginaActual-1)+')" '+(paginaActual===1?'disabled':'')+'>‹</button>';
  let ini=Math.max(1,paginaActual-3), fin2=Math.min(totalPags,ini+6);
  if(fin2-ini<6) ini=Math.max(1,fin2-6);
  if(ini>1) html+='<button class="pag-btn" onclick="irPagina(1)">1</button>'+(ini>2?'<span style="padding:0 4px;color:#9ca3af">…</span>':'');
  for(let i=ini;i<=fin2;i++) html+='<button class="pag-btn '+(i===paginaActual?'active':'')+'" onclick="irPagina('+i+')">'+i+'</button>';
  if(fin2<totalPags) html+=(fin2<totalPags-1?'<span style="padding:0 4px;color:#9ca3af">…</span>':'')+'<button class="pag-btn" onclick="irPagina('+totalPags+')">'+totalPags+'</button>';
  html+='<button class="pag-btn" onclick="irPagina('+(paginaActual+1)+')" '+(paginaActual===totalPags?'disabled':'')+'>›</button>';
  cont.innerHTML = html;
  const pi2 = document.getElementById('pagInfo2');
  if(pi2) pi2.textContent = total ? paginaActual+' / '+totalPags : '';
}

function irPagina(p){
  paginaActual=Math.max(1,Math.min(p,Math.ceil(ventasFiltradas.length/porPagina)||1));
  renderTabla();
  document.querySelector('.tabla-scroll')?.scrollTo(0,0);
}

/* ── MODAL ESTADO ── */
function abrirModalEstado(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id;
  document.getElementById('re_estadoActual').textContent = v._estadoGrab || 'pendiente';
  const sel = document.getElementById('re_nuevoEstado');
  sel.innerHTML = ESTADOS_GRAB.map(e=>'<option value="'+e.id+'">'+e.label+'</option>').join('');
  sel.value = v._estadoGrab || 'pendiente';
  document.getElementById('modalEstado').classList.add('open');
}

async function guardarEstado(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const nuevo = document.getElementById('re_nuevoEstado').value;

  if(nuevo === 'grabado'){
    await fetch(API_GRAB + '/ventas/' + v.id, {
      method: 'PATCH', headers: ncHeaders(),
      body: JSON.stringify({ estado: 'grabado' }),
    });
    ventas = ventas.filter(x => x.id !== editandoId);
    cerrarModal('modalEstado');
    aplicarFiltros();
    toast('Venta marcada como GRABADA — pasa al Supervisor');
    return;
  }

  v._estadoGrab = nuevo;
  try {
    await fetch(API_GRAB + '/ventas/' + v.id, {
      method: 'PATCH', headers: ncHeaders(),
      body: JSON.stringify({ estado_grab: nuevo }),
    });
  } catch(e) { console.error('Error guardando estado:', e); }

  cerrarModal('modalEstado');
  renderTabla();
  toast('Estado actualizado: ' + nuevo.toUpperCase());
}

/* ── MODAL SUBIR ── */
function abrirModalSubir(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id; archivoSeleccionado=null;
  document.getElementById('subir_nombre').textContent = v.nombreApellidos||'—';
  document.getElementById('subir_info').textContent   = '';
  document.getElementById('archivoGrab').value        = '';
  document.getElementById('modalSubir').classList.add('open');
}

function handleFileSelect(files){
  if(!files.length) return;
  const file=files[0];
  if(!file.name.match(/\.(mp3|wav|ogg|m4a|mp4|webm)$/i)){ toast('Solo archivos de audio'); return; }
  archivoSeleccionado=file;
  document.getElementById('subir_info').innerHTML='<span style="color:#16a34a;font-weight:600;">'+file.name+' ('+(file.size/1024/1024).toFixed(2)+' MB)</span>';
}

async function guardarAudio(){
  if(!archivoSeleccionado){ toast('Selecciona un archivo primero'); return; }
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;

  const formData = new FormData();
  formData.append('audio', archivoSeleccionado);

  let rutaAudio = null;
  try {
    const uploadRes = await fetch(API_GRAB + '/ventas/' + editandoId + '/audio', {
      method: 'POST',
      headers: { 'Authorization': ncHeaders()['Authorization'] },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (uploadData.ok) rutaAudio = uploadData.ruta;
  } catch(e){ console.error('Error subiendo audio:', e); }

  await fetch(API_GRAB + '/ventas/' + editandoId, {
    method: 'PATCH', headers: ncHeaders(),
    body: JSON.stringify({
      estado: 'grabado',
      ...(rutaAudio ? { audio_path: rutaAudio } : {}),
    }),
  });

  ventas = ventas.filter(x => x.id !== editandoId);
  cerrarModal('modalSubir');
  aplicarFiltros();
  toast('Grabacion subida — pasa al Supervisor de Grabaciones');
}

/* ── MODAL AUDIO ── */
function abrirModalAudio(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id;
  document.getElementById('audio_nombre').textContent = v.nombreApellidos||'—';
  document.getElementById('audio_asesor').textContent = v.vendedor||'—';
  document.getElementById('audio_fecha').textContent  = formatF(v.fechaIngreso||'');
  const player  = document.getElementById('audioPlayer');
  const noAudio = document.getElementById('audioNoDisp');

  if(v._grabAudio){
    player.src = window.NC_API + '/' + v._grabAudio;
    player.style.display='';
    if(noAudio) noAudio.style.display='none';
    document.getElementById('audio_archivo').textContent = v._grabNombre||'grabacion.mp3';

    const btnDl = document.getElementById('audio_btnDescargar');
    if(btnDl){ btnDl.style.display=''; btnDl.onclick = () => descargarAudio(id); }
  } else {
    player.src='';
    player.style.display='none';
    if(noAudio) noAudio.style.display='';
    document.getElementById('audio_archivo').textContent='—';
    const btnDl = document.getElementById('audio_btnDescargar');
    if(btnDl) btnDl.style.display='none';
  }
  document.getElementById('modalAudio').classList.add('open');
}

/* ── MODAL OBS ── */
function abrirModalObs(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id;
  document.getElementById('obs_nombre').textContent    = v.nombreApellidos||'—';
  document.getElementById('obs_historial').textContent = v._grabObs||'Sin observaciones previas.';
  document.getElementById('obs_nueva').value='';
  document.getElementById('modalObs').classList.add('open');
}

async function guardarObservacion(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const nueva=document.getElementById('obs_nueva').value.trim();
  if(!nueva){ toast('Escribe una observacion'); return; }
  const prev=v._grabObs?v._grabObs+'\n':'';
  v._grabObs=prev+'['+formatF(fechaHoy())+' '+horaAhora()+' - '+usuarioActual+'] '+nueva;
  await actualizarVentaBackend(v.id, { observacion: v._grabObs });
  cerrarModal('modalObs');
  aplicarFiltros();
  toast('Observacion guardada');
}

function actualizarFecha(){
  const el=document.getElementById('topbarFecha'); if(!el) return;
  const ahora=new Date();
  const dias=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  el.textContent=dias[ahora.getDay()]+' '+ahora.getDate()+' '+meses[ahora.getMonth()]+' · '+horaAhora();
}

window.onload = async () => {
  const sesion=ncGetSesion();
  if(sesion) usuarioActual=sesion.nombre||'Grabaciones';
  const el=document.getElementById('topbarUser'); if(el&&sesion) el.textContent=sesion.nombre||'Grabaciones';

  const fEstado = document.getElementById('f_estado');
  if(fEstado){
    fEstado.innerHTML = '<option value="">Todos</option>' +
      ESTADOS_GRAB.map(e=>'<option value="'+e.id+'">'+e.label+'</option>').join('');
  }

  await cargarVentas();
  if(!restaurarTabGrabaciones()) aplicarFiltros();
  actualizarFecha();
  setInterval(actualizarFecha, 60000);

  ['modalEstado','modalSubir','modalAudio','modalObs'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click',e=>{ if(e.target===document.getElementById(id)) cerrarModal(id); });
  });

  document.getElementById('selectPorPagina')?.addEventListener('change',e=>{
    porPagina=parseInt(e.target.value)||18; paginaActual=1; renderTabla();
  });

  setInterval(async()=>{ await cargarVentas(); aplicarFiltros(); }, 30000);
};
