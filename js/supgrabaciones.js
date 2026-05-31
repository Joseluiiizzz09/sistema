/* ================================================
   SUPGRABACIONES.JS — Supervisor de Grabaciones
   ================================================ */

const API_SUP_GRAB = 'http://127.0.0.1:3000/api';

let ventas          = [];
let ventasFiltradas = [];
let paginaActual    = 1;
let porPagina       = 18;
let editandoId      = null;
let busquedaVal     = '';
let usuarioActual   = 'Supervisor';
let estadoRevision  = '';

function fechaHoy(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}); }
function nowLabel(){ return new Date().toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function formatF(f){ if(!f)return'—'; const d=(f.split('T')[0]||f); const p=d.split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:f; }

function toast(msg){ const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); }
function cerrarModal(id){ document.getElementById(id)?.classList.remove('open'); }

function badgeRev(estado){
  const map = {
    'aprobado':   {cls:'bg-grabado',  label:'APROBADO'},
    'rechazado':  {cls:'bg-pendiente',label:'RECHAZADO'},
    'observado':  {cls:'bg-observado',label:'OBSERVADO'},
    'sin_revisar':{cls:'bg-revisado', label:'SIN REVISAR'},
  };
  const e = map[estado] || map['sin_revisar'];
  return '<span class="badge-grab '+e.cls+'" onclick="abrirModalRevisar('+editandoId+')" title="Click para revisar">'+e.label+'</span>';
}

/* ===== CARGAR — solo ventas GRABADAS ===== */
async function cargarVentas(){
  try {
    const res  = await fetch(API_SUP_GRAB + '/ventas', { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data
        .filter(v => (v.estado||'').toLowerCase() === 'grabado' ||
                     (v._estadoGrab||'') === 'grabado' ||
                     (v.obs_supgrab||'') !== '')  // incluir si ya tiene revisión previa
        // Fallback: mostrar validadas con audio (grabadas en memoria)
        // En producción, el estado 'grabado' se guarda en obs_supgrab
        .filter(v => (v.estado||'').toLowerCase() === 'validado' || (v.obs_supgrab))
        .map(v => ({
          ...v,
          nombreApellidos:  v.nombre        || '',
          dni:              v.dni           || '',
          telefonoContacto: v.telefono1     || '',
          vendedor:         v.asesor_nombre || '',
          fechaIngreso:     (v.created_at||'').split(' ')[0],
          estadoRev:        v.estado_supgrab || 'sin_revisar',
          obsSup:           v.obs_supgrab    || '',
        }));
    }
  } catch(e) { console.error('Error:', e); }
}

function actualizarKpis(){
  document.getElementById('kpiTotal').textContent     = ventas.length;
  document.getElementById('kpiAprobado').textContent  = ventas.filter(v=>v.estadoRev==='aprobado').length;
  document.getElementById('kpiRechazado').textContent = ventas.filter(v=>v.estadoRev==='rechazado').length;
  document.getElementById('kpiPendiente').textContent = ventas.filter(v=>v.estadoRev==='sin_revisar').length;
  document.getElementById('kpiObservado').textContent = ventas.filter(v=>v.estadoRev==='observado').length;
}

function aplicarFiltros(){
  const fEst  = document.getElementById('f_estado')?.value   || '';
  const fDoc  = (document.getElementById('f_doc')?.value     || '').toLowerCase();
  const fVend = (document.getElementById('f_vendedor')?.value|| '').toLowerCase();
  const fDesde= document.getElementById('f_desde')?.value    || '';
  const fHasta= document.getElementById('f_hasta')?.value    || '';

  ventasFiltradas = ventas.filter(v => {
    if (fEst   && v.estadoRev !== fEst) return false;
    if (fDoc   && !(v.dni||'').toLowerCase().includes(fDoc)) return false;
    if (fVend  && !(v.vendedor||'').toLowerCase().includes(fVend)) return false;
    if (fDesde && v.fechaIngreso < fDesde) return false;
    if (fHasta && v.fechaIngreso > fHasta) return false;
    if (busquedaVal){
      const b = busquedaVal.toLowerCase();
      if(![(v.nombreApellidos||''),(v.dni||''),(v.telefonoContacto||''),(v.vendedor||'')].some(c=>c.toLowerCase().includes(b))) return false;
    }
    return true;
  });

  paginaActual = 1;
  renderTabla();
  actualizarKpis();
}

function limpiarFiltros(){
  ['f_estado','f_doc','f_vendedor','f_desde','f_hasta'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  busquedaVal = '';
  const bs = document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

function getBadgeRevHtml(estadoRev, vid){
  const map = {
    'aprobado':   {cls:'bg-grabado',  label:'APROBADO'},
    'rechazado':  {cls:'bg-pendiente',label:'RECHAZADO'},
    'observado':  {cls:'bg-observado',label:'OBSERVADO'},
    'sin_revisar':{cls:'bg-revisado', label:'SIN REVISAR'},
  };
  const e = map[estadoRev] || map['sin_revisar'];
  return '<span class="badge-grab '+e.cls+'" onclick="abrirModalRevisar('+vid+')" style="cursor:pointer;">'+e.label+'</span>';
}

function renderTabla(){
  const tbody  = document.getElementById('tablaBody');
  const total  = ventasFiltradas.length;
  const inicio = (paginaActual-1)*porPagina;
  const fin    = Math.min(inicio+porPagina, total);
  const pagina = ventasFiltradas.slice(inicio, fin);

  document.getElementById('tablaCount').textContent = total + ' registros';
  document.getElementById('pagInfo').textContent    = total ? 'Mostrando '+(inicio+1)+'–'+fin+' de '+total : '';

  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="tabla-empty">Sin ventas grabadas para revisar.</td></tr>';
    renderPaginacion(0); return;
  }

  tbody.innerHTML = pagina.map(v => {
    const tieneAudio = !!v._grabAudio;
    const ultimaObs  = v.obsSup ? v.obsSup.split('\n').slice(-1)[0].replace(/^\[.+?\]\s*/,'') : '—';
    return '<tr>'+
      '<td><div class="acciones-cell">'+
        '<button class="btn-acc btn-acc-audio" onclick="abrirModalRevisar('+v.id+')" title="Escuchar y revisar">🎙️ Escuchar</button>'+
        (v._grabAudio ? '<a class="btn-acc btn-acc-subir" href="'+v._grabAudio+'" download="grabacion_'+v.id+'.mp3" title="Descargar">⬇️ Descargar</a>' : '<span style="font-size:11px;color:#9ca3af;padding:0 6px;">Sin audio</span>')+
        '<button class="btn-acc btn-acc-obs" onclick="verObs('+v.id+')" title="Ver observaciones">💬</button>'+
      '</div></td>'+
      '<td>'+getBadgeRevHtml(v.estadoRev, v.id)+'</td>'+
      '<td><span style="color:#185FA5;font-weight:700;font-size:11px;">'+formatF(v.fechaIngreso)+'</span></td>'+
      '<td style="font-weight:600;">'+(v.nombreApellidos||'—')+'</td>'+
      '<td style="font-family:monospace;font-size:11px;">'+(v.dni||'—')+'</td>'+
      '<td style="font-family:monospace;color:#185FA5;font-weight:700;">'+(v.telefonoContacto||'—')+'</td>'+
      '<td style="font-weight:600;color:#7C3AED;">'+(v.vendedor||'—')+'</td>'+
      '<td style="font-size:11px;">'+(v.supervisor||'—')+'</td>'+
      '<td>'+(tieneAudio ? '<span style="color:#16a34a;font-weight:600;font-size:11px;">✅ '+(v._grabNombre||'Archivo subido')+'</span>' : '<span style="color:#9ca3af;font-size:11px;font-style:italic;">Sin grabación</span>')+'</td>'+
      '<td style="font-size:10px;color:#6b7280;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+ultimaObs+'">'+ultimaObs+'</td>'+
    '</tr>';
  }).join('');

  renderPaginacion(total);
}

function renderPaginacion(total){
  const totalPags = Math.max(1, Math.ceil(total/porPagina));
  const cont = document.getElementById('paginacionBtns');
  let html = '<button class="pag-btn" onclick="irPagina('+(paginaActual-1)+')" '+(paginaActual===1?'disabled':'')+'>‹</button>';
  let ini=Math.max(1,paginaActual-3), fin=Math.min(totalPags,ini+6);
  if(fin-ini<6) ini=Math.max(1,fin-6);
  if(ini>1) html+='<button class="pag-btn" onclick="irPagina(1)">1</button>'+(ini>2?'<span style="padding:0 4px;color:#9ca3af">…</span>':'');
  for(let i=ini;i<=fin;i++) html+='<button class="pag-btn '+(i===paginaActual?'active':'')+'" onclick="irPagina('+i+')">'+i+'</button>';
  if(fin<totalPags) html+=(fin<totalPags-1?'<span style="padding:0 4px;color:#9ca3af">…</span>':'')+'<button class="pag-btn" onclick="irPagina('+totalPags+')">'+totalPags+'</button>';
  html+='<button class="pag-btn" onclick="irPagina('+(paginaActual+1)+')" '+(paginaActual===totalPags?'disabled':'')+'>›</button>';
  cont.innerHTML = html;
}

function irPagina(p){ paginaActual=Math.max(1,Math.min(p,Math.ceil(ventasFiltradas.length/porPagina)||1)); renderTabla(); document.querySelector('.tabla-scroll')?.scrollTo(0,0); }

/* ===== MODAL REVISAR ===== */
function abrirModalRevisar(id){
  const v = ventas.find(x=>x.id===id); if(!v) return;
  editandoId = id;
  estadoRevision = v.estadoRev || 'sin_revisar';

  document.getElementById('rev_nombre').textContent  = v.nombreApellidos||'—';
  document.getElementById('rev_vendedor').textContent = v.vendedor||'—';
  document.getElementById('rev_fecha').textContent    = formatF(v.fechaIngreso);
  document.getElementById('rev_obs').value            = '';
  document.getElementById('revEstadoLabel').textContent = 'Estado actual: ' + estadoRevision.replace('_',' ').toUpperCase();

  // Audio
  const player  = document.getElementById('audioPlayer');
  const noAudio = document.getElementById('audioNoDisp');
  const btnDesc = document.getElementById('btnDescargar');
  if (v._grabAudio) {
    player.src = v._grabAudio; player.style.display=''; noAudio.style.display='none';
    btnDesc.href = v._grabAudio; btnDesc.download = 'grabacion_'+(v.nombreApellidos||v.id)+'.mp3'; btnDesc.style.display='inline-flex';
  } else {
    player.src=''; player.style.display='none'; noAudio.style.display=''; btnDesc.style.display='none';
  }

  // Marcar botón activo
  document.querySelectorAll('.rev-btn').forEach(b=>{
    b.style.outline = b.dataset.estado === estadoRevision ? '3px solid #7C3AED' : '';
    b.style.transform = b.dataset.estado === estadoRevision ? 'scale(1.04)' : '';
  });

  document.getElementById('modalRevisar').classList.add('open');
}

function seleccionarRevision(btn){
  estadoRevision = btn.dataset.estado;
  document.querySelectorAll('.rev-btn').forEach(b=>{
    b.style.outline = ''; b.style.transform='';
  });
  btn.style.outline = '3px solid #7C3AED';
  btn.style.transform = 'scale(1.04)';
  document.getElementById('revEstadoLabel').textContent = 'Seleccionado: ' + estadoRevision.replace('_',' ').toUpperCase();
}

async function guardarRevision(){
  const v = ventas.find(x=>x.id===editandoId); if(!v) return;
  if (!estadoRevision || estadoRevision==='sin_revisar'){ toast('Selecciona un resultado'); return; }

  const obs   = document.getElementById('rev_obs').value.trim();
  const lineas = (v.obsSup||'').split('\n').filter(l=>l.trim());
  lineas.push('['+nowLabel()+' - '+usuarioActual+'] '+estadoRevision.toUpperCase()+(obs?' — '+obs:''));
  const nuevoHistorial = lineas.join('\n');

  try {
    const res = await fetch(API_SUP_GRAB+'/ventas/'+editandoId, {
      method:'PATCH', headers:ncHeaders(),
      body: JSON.stringify({ obs_supgrab: nuevoHistorial, estado_supgrab: estadoRevision }),
    });
    const data = await res.json();
    if (!data.ok){ toast('Error guardando'); return; }
    v.estadoRev = estadoRevision;
    v.obsSup    = nuevoHistorial;
    cerrarModalRevisar();
    aplicarFiltros();
    toast('✅ Revisión guardada: '+estadoRevision.toUpperCase());
  } catch(e){ toast('Error conectando al servidor'); }
}

function cerrarModalRevisar(){
  document.getElementById('modalRevisar').classList.remove('open');
  document.getElementById('audioPlayer').pause();
  editandoId=null; estadoRevision='';
}

function verObs(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  document.getElementById('obs_nombre').textContent = v.nombreApellidos||'—';
  const lineas = (v.obsSup||'').split('\n').filter(l=>l.trim());
  document.getElementById('obs_historial').textContent = lineas.length ? lineas.join('\n') : 'Sin observaciones del supervisor.';
  document.getElementById('modalObs').classList.add('open');
}

function actualizarFecha(){
  const el=document.getElementById('topbarFecha'); if(!el) return;
  const d=new Date(), dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
    meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  el.textContent=dias[d.getDay()]+' '+d.getDate()+' '+meses[d.getMonth()]+' · '+horaAhora();
}

window.onload = async () => {
  const sesion = ncGetSesion();
  if(sesion){ usuarioActual=sesion.nombre||'Supervisor'; const el=document.getElementById('topbarUser'); if(el) el.textContent=sesion.nombre||'Supervisor'; }

  await cargarVentas();
  aplicarFiltros();
  actualizarFecha();
  setInterval(actualizarFecha, 60000);

  // Botones de revisión
  document.querySelectorAll('.rev-btn').forEach(b=>{
    b.addEventListener('click', ()=>seleccionarRevision(b));
  });

  ['modalRevisar','modalObs'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click',e=>{ if(e.target===document.getElementById(id)){ if(id==='modalRevisar') cerrarModalRevisar(); else cerrarModal(id); } });
  });

  document.getElementById('selectPorPagina')?.addEventListener('change',e=>{ porPagina=parseInt(e.target.value)||18; paginaActual=1; renderTabla(); });
  setInterval(async()=>{ await cargarVentas(); aplicarFiltros(); }, 60000);
};