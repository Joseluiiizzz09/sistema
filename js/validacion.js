/* ================================================
   VALIDACION.JS — Módulo de Validación Netcontact
   ================================================ */

const ESTADOS_VALIDADOR = [
  { id:'corta_llamada',  label:'CORTA LLAMADA',  cls:'be-corta' },
  { id:'fraude',         label:'FRAUDE',          cls:'be-fraude' },
  { id:'no_desea',       label:'NO DESEA',        cls:'be-nodesea' },
  { id:'no_contesta',    label:'NO CONTESTA',     cls:'be-nocontesta' },
  { id:'servicio_activo',label:'SERVICIO ACTIVO', cls:'be-servicio' },
];

const ESTADOS_TODOS = [
  { id:'venta',          label:'VENTA',           cls:'be-venta' },
  { id:'validado',       label:'VALIDADO',        cls:'be-validado' },
  { id:'instalado',      label:'INSTALADO',       cls:'be-instalado' },
  { id:'programado',     label:'PROGRAMADO',      cls:'be-programado' },
  { id:'caida',          label:'CAÍDA',           cls:'be-caida' },
  { id:'observado',      label:'OBSERVADO',       cls:'be-observado' },
  { id:'pendiente',      label:'PENDIENTE',       cls:'be-pendiente' },
  { id:'corta_llamada',  label:'CORTA LLAMADA',   cls:'be-corta' },
  { id:'fraude',         label:'FRAUDE',          cls:'be-fraude' },
  { id:'no_desea',       label:'NO DESEA',        cls:'be-nodesea' },
  { id:'no_contesta',    label:'NO CONTESTA',     cls:'be-nocontesta' },
  { id:'servicio_activo',label:'SERVICIO ACTIVO', cls:'be-servicio' },
];

const API_VAL = 'http://127.0.0.1:3000/api';

let ventas          = [];
let ventasFiltradas = [];
let paginaActual    = 1;
let porPagina       = 18;
let editandoId      = null;
let busquedaVal     = '';
let usuarioActual   = 'Validador';

function fechaHoy()  { return new Date().toISOString().split('T')[0]; }
function horaAhora() { return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }
function nowLabel()  { return new Date().toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function formatF(f)  { if(!f)return'—'; const d=f.split('T')[0]||f; const p=d.split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:f; }

function estadoObj(id){
  return ESTADOS_TODOS.find(e=>e.id===id?.toLowerCase()) || { id:'venta', label:'VENTA', cls:'be-venta' };
}

function badgeEstado(id, tipifVal, vId){
  // Mostrar tipificación del validador si existe, si no mostrar estado original
  const mostrar = tipifVal || id;
  const e = estadoObj(mostrar);
  return `<span class="badge-estado ${e.cls}" onclick="abrirModalEstado(${vId})" title="Click para tipificar">${e.label}</span>`;
}

function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3000);
}

/* ===== HISTORIAL (línea de tiempo) ===== */
function parsearHistorial(obs) {
  if (!obs) return [];
  return obs.split('\n').filter(l=>l.trim()).map(l=>l.trim());
}

function ultimaObs(obs) {
  const lineas = parsearHistorial(obs);
  return lineas.length ? lineas[lineas.length-1] : '—';
}

function renderLineaTiempo(lineas) {
  if (!lineas.length) return '<div style="color:#9ca3af;font-size:12px;padding:8px 0;">Sin historial de tipificaciones.</div>';

  // Agrupar de 2 en 2: tipificación + comentario
  const grupos = [];
  let i = 0;
  while (i < lineas.length) {
    const match1 = lineas[i].match(/^\[(.+?)\]\s*(.*)$/);
    const meta1  = match1 ? match1[1] : '';
    const txt1   = match1 ? match1[2] : lineas[i];

    // Si la siguiente línea existe y no es una tipificación conocida, es el comentario
    const TIPS = ['CORTA LLAMADA','FRAUDE','NO DESEA','NO CONTESTA','SERVICIO ACTIVO',
                  'VENTA','VALIDADO','INSTALADO','PROGRAMADO','CAÍDA','OBSERVADO','PENDIENTE'];
    const esTip = TIPS.includes(txt1.trim().toUpperCase());

    let comentario = '';
    if (esTip && i+1 < lineas.length) {
      const match2 = lineas[i+1].match(/^\[(.+?)\]\s*(.*)$/);
      const txt2   = match2 ? match2[2] : lineas[i+1];
      if (!TIPS.includes(txt2.trim().toUpperCase())) {
        comentario = txt2;
        i++; // saltar la siguiente línea
      }
    }

    grupos.push({ meta: meta1, tipif: txt1, comentario });
    i++;
  }

  const colores = ['#7C3AED','#2563eb','#16a34a','#d97706','#dc2626','#0891b2','#ec4899'];
  return grupos.map((g, idx) => {
    const color = colores[idx % colores.length];
    return `<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;padding-bottom:14px;border-bottom:1px solid #f3f4f6;">
      <div style="width:11px;height:11px;border-radius:50%;background:${color};margin-top:5px;flex-shrink:0;box-shadow:0 0 0 3px ${color}22;"></div>
      <div style="flex:1;">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;letter-spacing:.2px;">${g.meta}</div>
        <div style="display:inline-block;background:${color}18;color:${color};border:1.5px solid ${color}44;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin-bottom:${g.comentario?'6px':'0'};">${g.tipif}</div>
        ${g.comentario ? `<div style="font-size:13px;color:#374151;font-style:italic;">"${g.comentario}"</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ===== CARGAR VENTAS ===== */
async function loadFromStorage() {
  try {
    const res  = await fetch(API_VAL + '/ventas', { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data.map(v => ({
        ...v,
        estado:             (v.estado || 'venta').toLowerCase(),
        fechaIngreso:       (v.created_at || '').split(' ')[0],
        horaIngreso:        (v.created_at || '').split(' ')[1] || '',
        nombreApellidos:    v.nombre      || '',
        telefonoContacto:   v.telefono1   || '',
        telefonoReferencia: v.telefono2   || '',
        obsBackOffice:      v.obs_backoffice || '',
        vendedor:           v.asesor_nombre  || '',
        obsVal:             v.obs_validacion || '',
        tipifVal: (()=>{
          // Extraer última tipificación del historial
          const TIPS = ['corta_llamada','fraude','no_desea','no_contesta','servicio_activo','validado'];
          const lineas = (v.obs_validacion||'').split('\n').filter(l=>l.trim());
          for(let i=lineas.length-1;i>=0;i--){
            const txt=((lineas[i].match(/^\[.+?\]\s*(.*)$/)||[])[1]||'').toLowerCase().replace(/ /g,'_');
            if(TIPS.includes(txt)) return txt;
          }
          return '';
        })(),
        obsSeg:             v.obs_seguimiento  || '',
      }));
    }
  } catch(e) { console.error('Error cargando ventas:', e); }
}

/* ===== KPIs ===== */
function actualizarKpis(){
  const total     = ventas.length;
  const validados = ventas.filter(v=>['validado','instalado','programado'].includes(v.estado)).length;
  document.getElementById('kpi-total').textContent       = total;
  document.getElementById('kpi-validados').textContent   = validados;
  document.getElementById('kpi-novalidados').textContent = total - validados;
}

/* ===== FILTROS ===== */
function aplicarFiltros(){
  const fEstado = document.getElementById('f_estado')?.value || '';
  const fAsesor = (document.getElementById('f_asesor')?.value || '').toLowerCase();
  const fDesde  = document.getElementById('f_desde')?.value  || '';
  const fHasta  = document.getElementById('f_hasta')?.value  || '';

  ventasFiltradas = ventas.filter(v => {
    if (fEstado === 'novalidado') {
      if (['validado','instalado','programado'].includes(v.estado)) return false;
    } else if (fEstado && v.estado !== fEstado) {
      return false;
    }
    if (fAsesor && !(v.vendedor||'').toLowerCase().includes(fAsesor)) return false;
    if (fDesde  && v.fechaIngreso < fDesde) return false;
    if (fHasta  && v.fechaIngreso > fHasta) return false;
    if (busquedaVal) {
      const b = busquedaVal.toLowerCase();
      if (![(v.nombreApellidos||''),(v.dni||''),(v.telefonoContacto||''),(v.vendedor||''),(v.distrito||'')].some(c=>c.toLowerCase().includes(b))) return false;
    }
    return true;
  });

  ventasFiltradas.sort((a,b)=>(b.fechaIngreso+b.horaIngreso).localeCompare(a.fechaIngreso+a.horaIngreso));
  paginaActual = 1;
  renderTabla();
  actualizarKpis();
}

function limpiarFiltros(){
  ['f_estado','f_asesor','f_desde','f_hasta'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  busquedaVal='';
  const bs=document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

/* ===== RENDER TABLA ===== */
function renderTabla(){
  const tbody  = document.getElementById('tablaBody');
  const total  = ventasFiltradas.length;
  const inicio = (paginaActual-1)*porPagina;
  const fin    = Math.min(inicio+porPagina, total);
  const pagina = ventasFiltradas.slice(inicio, fin);

  document.getElementById('tablaCount').textContent = total + ' registros';
  document.getElementById('pagInfo').textContent    = total ? `Mostrando ${inicio+1}–${fin} de ${total}` : '';

  if (!pagina.length) {
    tbody.innerHTML=`<tr class="tabla-empty"><td colspan="22">Sin registros.</td></tr>`;
    renderPaginacion(total); return;
  }

  tbody.innerHTML = pagina.map(v => {
    // Observación: solo última línea visible en tabla
    const lineas = parsearHistorial(v.obsVal);
    // Mostrar última observación (preferir comentarios sobre tipificaciones)
    const TIPS_DISPLAY = ['CORTA LLAMADA','FRAUDE','NO DESEA','NO CONTESTA','SERVICIO ACTIVO','VENTA','VALIDADO','INSTALADO','PROGRAMADO','CAÍDA','OBSERVADO','PENDIENTE'];
    let obsDisplay = '—';
    for (let li = lineas.length - 1; li >= 0; li--) {
      const txt = (lineas[li].match(/^\[.+?\]\s*(.*)$/) || [])[1] || lineas[li];
      if (!TIPS_DISPLAY.includes(txt.trim().toUpperCase())) { obsDisplay = txt; break; }
      if (li === 0) obsDisplay = txt; // si solo hay tipificaciones
    }

    return `<tr id="fila-${v.id}">
      <td style="text-align:center;vertical-align:middle;">
        <div class="acciones-cell">
          <button class="btn-accion-row btn-obs" onclick="abrirModalObs(${v.id})" title="Ver historial y observar">📋</button>
        </div>
      </td>
      <td style="vertical-align:middle">${badgeEstado(v.estado, v.tipifVal||"", v.id)}</td>
      <td class="td-wrap td-obs-seg">${v.obsSeg||'—'}</td>
      <td style="color:#185FA5;font-weight:700;font-family:monospace;font-size:10px;white-space:nowrap">${formatF(v.fechaIngreso)}<br><span style="color:#9ca3af;font-weight:400">${v.horaIngreso||''}</span></td>
      <td style="font-weight:600">${v.nombreApellidos||'—'}</td>
      <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
      <td style="font-family:monospace;color:#185FA5;font-weight:700">${v.telefonoContacto||'—'}</td>
      <td style="font-family:monospace;color:#6b7280">${v.telefonoReferencia||'—'}</td>
      <td>${v.departamento||'—'}</td>
      <td>${v.provincia||'—'}</td>
      <td style="font-weight:600">${v.distrito||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.direccion||'—'}</td>
      <td>${v.cuota_inst||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.claro_hogar||'—'}</td>
      <td>${v.tecnologia||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.paquete||'—'}</td>
      <td style="text-align:center">${v.full_claro||'—'}</td>
      <td style="text-align:center">${v.cant_decos??'—'}</td>
      <td style="text-align:center">${v.cant_mesh??'—'}</td>
      <td>${v.plano||'—'}</td>
      <td style="font-size:11px;color:#374151;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${obsDisplay}">${obsDisplay}</td>
      <td style="font-weight:600;color:#7C3AED">${v.vendedor||'—'}</td>
    </tr>`;
  }).join('');

  renderPaginacion(total);
}

/* ===== PAGINACIÓN ===== */
function renderPaginacion(total){
  const totalPags = Math.max(1, Math.ceil(total/porPagina));
  const cont = document.getElementById('paginacionBtns');
  let html = `<button class="pag-btn" onclick="irPagina(${paginaActual-1})" ${paginaActual===1?'disabled':''}>‹</button>`;
  let ini=Math.max(1,paginaActual-3), fin2=Math.min(totalPags,ini+6);
  if(fin2-ini<6) ini=Math.max(1,fin2-6);
  if(ini>1) html+=`<button class="pag-btn" onclick="irPagina(1)">1</button>${ini>2?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}`;
  for(let i=ini;i<=fin2;i++) html+=`<button class="pag-btn ${i===paginaActual?'active':''}" onclick="irPagina(${i})">${i}</button>`;
  if(fin2<totalPags) html+=`${fin2<totalPags-1?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}<button class="pag-btn" onclick="irPagina(${totalPags})">${totalPags}</button>`;
  html+=`<button class="pag-btn" onclick="irPagina(${paginaActual+1})" ${paginaActual===totalPags?'disabled':''}>›</button>`;
  cont.innerHTML = html;
}

function irPagina(p){
  const totalPags = Math.ceil(ventasFiltradas.length/porPagina)||1;
  paginaActual = Math.max(1,Math.min(p,totalPags));
  renderTabla();
  document.querySelector('.tabla-scroll')?.scrollTo(0,0);
}

/* ===== MODAL TIPIFICACIÓN + OBSERVACIÓN ===== */
function abrirModalEstado(id){
  const v = ventas.find(x=>x.id===id); if(!v) return;
  editandoId = id;
  const tipActual = v.tipifVal || '';
  document.getElementById('re_estadoActual').textContent = tipActual ? estadoObj(tipActual).label : estadoObj(v.estado).label;

  // Marcar tipificación actual si es del validador
  document.querySelectorAll('.tip-val-btn').forEach(b => {
    b.classList.toggle('activo', b.dataset.id === tipActual);
  });

  // Mostrar línea de tiempo
  const lineas = parsearHistorial(v.obsVal);
  document.getElementById('lt_container').innerHTML = renderLineaTiempo(lineas);

  // Limpiar campo observación
  document.getElementById('re_nueva_obs').value = '';

  document.getElementById('modalEstado').classList.add('open');
}

async function guardarTipificacion(){
  const v = ventas.find(x=>x.id===editandoId); if(!v) return;

  // Ver qué tipificación está seleccionada
  const btnActivo = document.querySelector('.tip-val-btn.activo');
  const nuevoEstado = btnActivo ? btnActivo.dataset.id : v.estado;
  const nuevaObs = document.getElementById('re_nueva_obs').value.trim();

  if (!nuevoEstado && !nuevaObs) { toast('Selecciona una tipificación o escribe una observación'); return; }

  // Construir entrada de historial: tipificación primero, comentario después
  let lineas = parsearHistorial(v.obsVal);
  const ts = nowLabel();
  if (nuevoEstado !== v.estado) {
    lineas.push(`[${ts} - ${usuarioActual}] ${estadoObj(nuevoEstado).label}`);
  }
  if (nuevaObs) {
    lineas.push(`[${ts} - ${usuarioActual}] ${nuevaObs}`);
  }
  const nuevoHistorial = lineas.join('\n');

  try {
    // NO pisamos el estado real de la venta — solo guardamos la tipificación en obs_validacion
    const res = await fetch(`${API_VAL}/ventas/${editandoId}`, {
      method:'PATCH', headers:ncHeaders(),
      body: JSON.stringify({ obs_validacion: nuevoHistorial }),
    });
    const data = await res.json();
    if (!data.ok) { toast('Error: ' + data.mensaje); return; }

    // Guardar tipificacion local para mostrar el badge
    v.tipifVal = nuevoEstado;
    v.obsVal = nuevoHistorial;

    cerrarModal('modalEstado');
    aplicarFiltros();
    toast('✅ Tipificación y observación guardadas');
  } catch(e) { toast('Error conectando al servidor'); }
}

function seleccionarTip(btn) {
  document.querySelectorAll('.tip-val-btn').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
}

/* ===== MODAL HISTORIAL ===== */
function abrirModalObs(id){
  const v = ventas.find(x=>x.id===id); if(!v) return;
  editandoId = id;
  document.getElementById('obs_nombre').textContent = v.nombreApellidos||'—';
  const lineas = parsearHistorial(v.obsVal);
  document.getElementById('obs_historial').innerHTML = renderLineaTiempo(lineas);
  document.getElementById('modalObs').classList.add('open');
}

function cerrarModal(id){ document.getElementById(id).classList.remove('open'); editandoId=null; }

/* ===== INIT ===== */
window.onload = async () => {
  const u = ncGetSesion();
  if (u) {
    usuarioActual = u.nombre || 'Validador';
    const el = document.getElementById('topbarUser');
    if (el) el.textContent = u.nombre || 'Validador';
  }

  await loadFromStorage();
  aplicarFiltros();

  ['modalEstado','modalObs'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click', e=>{
      if(e.target===document.getElementById(id)) cerrarModal(id);
    });
  });

  document.getElementById('selectPorPagina')?.addEventListener('change', e=>{
    porPagina = parseInt(e.target.value)||18;
    paginaActual = 1;
    renderTabla();
  });
};