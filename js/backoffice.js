/* ================================================
   BACKOFFICE.JS — Conectado a Node.js backend
   ================================================ */
const API_BO = window.NC_API + '/api';

const COLORES_AV = ["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899"];
const DOT_COLORS = ['#185FA5','#0F6E56','#854F0B','#7C3AED','#DC2626'];

let asesores    = [];
let baseVendedor = {};

/* ── Zona horaria Peru UTC-5 ── */
function fechaHoy() {
  const ahora = new Date();
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const peru  = new Date(utcMs + (-5 * 60 * 60000));
  const y = peru.getFullYear();
  const m = String(peru.getMonth()+1).padStart(2,'0');
  const d = String(peru.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function horaAhora() {
  const ahora = new Date();
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const peru  = new Date(utcMs + (-5 * 60 * 60000));
  return String(peru.getHours()).padStart(2,'0') + ':' + String(peru.getMinutes()).padStart(2,'0');
}

function formatFecha(f){ if(!f) return f; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function colorAv(n)  { let s=0; for(let c of n) s+=c.charCodeAt(0); return COLORES_AV[s%COLORES_AV.length]; }
function iniciales(n){ return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function mostrarToast(msg){
  const n=document.getElementById('notifyToast');
  n.textContent=msg; n.classList.add('show');
  setTimeout(()=>n.classList.remove('show'),3200);
}

/* ── Cargar asesores desde backend ── */
async function cargarAsesoresBackend() {
  try {
    const res  = await fetch(API_BO + '/usuarios', { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      asesores = data.data
        .filter(u => u.cargo === 'asesor' && u.activo)
        .map(u => ({ id: u.id, nombre: u.nombre, usuario: u.usuario, sala: u.sala }));
      localStorage.setItem('bo_asesores', JSON.stringify(asesores));
    }
  } catch(e) { console.error('Error cargando asesores:', e); }
}

/* ── Actualizar asesor de un lead en backend ── */
async function actualizarLeadBackend(id, cambios) {
  try {
    await fetch(`${API_BO}/leads/${id}`, {
      method:  'PATCH',
      headers: ncHeaders(),
      body:    JSON.stringify(cambios),
    });
  } catch(e) { console.error('Error actualizando lead:', e); }
}

/* ===================== ESTADO GLOBAL ===================== */
let fechaPestanas   = [fechaHoy()];
let fechaActiva     = fechaHoy();
let baseData        = {};
let baseIdCnt       = 1;
let histOpen        = {};
let rotandoId       = null;
let historialGlobal = [];

function getTipifVendedor(n1){
  const n = n1.replace(/[\s\-]/g,'');
  return baseVendedor[n] || null;
}

function syncTipifVendedor(){
  let actualizado = 0;
  for(const f in baseData){
    baseData[f].forEach(reg=>{
      const tip = getTipifVendedor(reg.n1);
      if(tip && reg._tipifVend !== tip.tipif){
        reg._tipifVend = tip.tipif;
        reg._tipifHora = tip.hora;
        actualizado++;
      }
    });
  }
  if(actualizado > 0){ renderBase(); mostrarToast(`${actualizado} tipificaciones actualizadas`); }
}

/* ===================== NAVEGADOR DE FECHA ===================== */
function renderFechaTabs(){
  const idx   = fechaPestanas.indexOf(fechaActiva);
  const total = fechaPestanas.length;
  const sel = document.getElementById('fnav-select');
  if(sel){
    sel.innerHTML = fechaPestanas.map(f=>{
      const c = (baseData[f]||[]).length;
      return `<option value="${f}" ${f===fechaActiva?'selected':''}>${formatFecha(f)} (${c})</option>`;
    }).join('');
  }
  const count = document.getElementById('fnav-count');
  if(count) count.textContent = `${idx+1} / ${total}`;
  const prev = document.getElementById('fnav-prev');
  const next = document.getElementById('fnav-next');
  if(prev) prev.disabled = idx >= total-1;
  if(next) next.disabled = idx <= 0;
  const lbl = document.getElementById('fechaActivaLabel');
  if(lbl) lbl.textContent = formatFecha(fechaActiva);
  poblarSelectAsesorForm();
}

function cambiarFechaSelect(f){ fechaActiva=f; renderFechaTabs(); renderBase(); }
function navegarFecha(dir){
  const idx = fechaPestanas.indexOf(fechaActiva);
  const nuevoIdx = idx - dir;
  if(nuevoIdx < 0 || nuevoIdx >= fechaPestanas.length) return;
  fechaActiva = fechaPestanas[nuevoIdx];
  renderFechaTabs(); renderBase();
}
function cambiarFecha(f){ fechaActiva=f; renderFechaTabs(); renderBase(); }

function agregarFechaCalendario(){
  const picker = document.getElementById('calPicker');
  const f = picker ? picker.value : '';
  if(!f){ mostrarToast('Selecciona una fecha primero'); return; }
  if(!fechaPestanas.includes(f)){
    fechaPestanas.push(f);
    fechaPestanas.sort().reverse();
    if(!baseData[f]) baseData[f] = [];
    mostrarToast('Fecha ' + formatFecha(f) + ' agregada');
  } else {
    mostrarToast('Esa fecha ya existe');
  }
  picker.value = '';
  fechaActiva = f;
  renderFechaTabs(); renderBase();
}

/* ===================== FORM BASE ===================== */
function poblarSelectAsesorForm(){
  ['f_asesor_form','modal-asesor','rotSelAsesor','filtro_asesor_base'].forEach(sid=>{
    const sel = document.getElementById(sid); if(!sel) return;
    const ph = {'f_asesor_form':'— Sin asignar —','modal-asesor':'-- Seleccionar nuevo asesor --','rotSelAsesor':'-- Seleccionar asesor destino --','filtro_asesor_base':'Todos'}[sid]||'—';
    const val = sel.value;
    sel.innerHTML = `<option value="">${ph}</option>`;
    asesores.forEach(a => sel.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`);
    sel.value = val;
  });
}

async function agregarRegistroBase(){
  const n1 = document.getElementById('f_n1').value.trim();
  if(!n1){ document.getElementById('f_n1').classList.add('obligatorio-error'); mostrarToast('El campo N1 es obligatorio'); return; }
  document.getElementById('f_n1').classList.remove('obligatorio-error');
  const campana  = document.getElementById('f_campana').value.trim()||'—';
  const distrito = document.getElementById('f_distrito').value||'—';
  const n2       = document.getElementById('f_n2').value.trim();
  const tipifBack= document.getElementById('f_tipif_back').value;
  const asesor   = document.getElementById('f_asesor_form').value;
  const hora     = asesor ? horaAhora() : '';
  if(!baseData[fechaActiva]) baseData[fechaActiva] = [];
  const tipAuto = getTipifVendedor(n1);

  const reg = {
    id:baseIdCnt++, campana, distrito, n1, n2, tipifBack, asesor, horaAsig:hora,
    sinAsignar:!asesor, rotaciones:0,
    _tipifVend: tipAuto ? tipAuto.tipif : '',
    _tipifHora: tipAuto ? tipAuto.hora  : '',
    historial: asesor ? [{asesor, hora, fecha:fechaActiva, motivo:'Asignacion inicial'}] : []
  };
  baseData[fechaActiva].unshift(reg);

  try {
    const res = await fetch(API_BO + '/leads', {
      method: 'POST', headers: ncHeaders(),
      body: JSON.stringify({ campana, distrito, n1, n2, tipif_back: tipifBack,
        asesor_nombre: asesor, fecha: fechaActiva, hora_asig: hora }),
    });
    const data = await res.json();
    if (data.ok && data.ids && data.ids[0]) reg._backendId = data.ids[0];
    else if (data.ok && data.id) reg._backendId = data.id;
  } catch(e) {}

  if(asesor) historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana,asesor,n1,n2:n2||'—',tipif:tipifBack||'—',accion:'Asignacion inicial'});
  limpiarFormBase(); renderFechaTabs(); renderBase();
  mostrarToast(`N1: ${n1} agregado${asesor?' → '+asesor:''}${tipAuto?' · Tipif.: '+tipAuto.tipif:''}`);
}

function limpiarFormBase(){
  ['f_campana','f_n1','f_n2'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  // Reset ubigeo cascada
  const dpto = document.getElementById('f_dpto');
  const prov = document.getElementById('f_prov');
  const dist = document.getElementById('f_distrito');
  if(dpto) dpto.value='';
  if(prov){ prov.innerHTML='<option value="">— Seleccionar —</option>'; }
  if(dist){ dist.innerHTML='<option value="">— Seleccionar —</option>'; }
  document.getElementById('f_tipif_back').value='';
  document.getElementById('f_asesor_form').value='';
}

/* ===================== RENDER BASE ===================== */
function tipifBadgeClass(t){
  if(!t) return 'b-default';
  const u = t.toUpperCase();
  if(u.includes('VENTA'))       return 'b-venta';
  if(u.includes('BUZON'))       return 'b-buzon';
  if(u.includes('NO CONTESTA')) return 'b-nocontesta';
  if(u.includes('DER'))         return 'b-derivado';
  return 'b-default';
}

function tipifVendHtml(tipif, hora){
  if(!tipif) return '<span class="tipif-empty">— Pendiente —</span>';
  const styles = {
    'VENTA CERRADA':         ['#d1fae5','#065f46'],
    'PREVENTA':              ['#dbeafe','#1e40af'],
    'AGENDADO':              ['#fef3c7','#78350f'],
    'NO CONTESTA':           ['#fefce8','#854d0e'],
    'BUZON DE VOZ':          ['#e0f2fe','#0c4a6e'],
    'CORTA LLAMADA':         ['#f8fafc','#334155'],
    'EN EJECUCION':          ['#dcfce7','#14532d'],
    'SIN COBERTURA':         ['#ffe4e6','#881337'],
    'NO CALIFICA':           ['#fefce8','#713f12'],
    'NO DESEA':              ['#ffe4e6','#7f1d1d'],
    'CONTACTO CON TERCEROS': ['#ccfbf1','#134e4a'],
    'EDIFICIO NO LIBERADO':  ['#f5f3ff','#4c1d95'],
    'DESEA MOVIL':           ['#f8fafc','#1e293b'],
    'SERVICIO ACTIVO':       ['#f1f5f9','#1e293b'],
    'CONTESTA':              ['#d1fae5','#065f46'],
    'NC':                    ['#fefce8','#854d0e'],
    'DERIVADO':              ['#ede9fe','#5b21b6'],
  };
  const [bg, color] = styles[tipif] || ['#f3f4f6','#374151'];
  return `<div style="display:flex;flex-direction:column;gap:2px;">
    <span style="display:inline-flex;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${bg};color:${color};white-space:nowrap;">${tipif}</span>
    ${hora ? `<span style="font-size:9px;color:#9ca3af;">vendedor · ${hora}</span>` : ''}
  </div>`;
}

function actualizarStats(){
  const todos = baseData[fechaActiva] || [];
  document.getElementById('statTotal').textContent      = todos.length;
  document.getElementById('statVentas').textContent     = todos.filter(r=>(r.tipifBack||'').toUpperCase().includes('VENTA')).length;
  document.getElementById('statAsignados').textContent  = todos.filter(r=>r.asesor&&r.asesor!=='').length;
  document.getElementById('statSinAsignar').textContent = todos.filter(r=>r.sinAsignar).length;
  document.getElementById('statRotados').textContent    = todos.reduce((s,r)=>s+r.rotaciones,0);
  document.getElementById('baseContador').textContent   = todos.length+' registros';
  syncLocalStorage();
}

function renderBase(){
  for(const f in baseData){
    baseData[f].forEach(reg=>{
      const tip = getTipifVendedor(reg.n1);
      if(tip){ reg._tipifVend = tip.tipif; reg._tipifHora = tip.hora; }
    });
  }
  actualizarStats();
  const tbody = document.getElementById('tablaBaseBody'); if(!tbody) return;
  const mostrarTV = document.getElementById('mostrarTipVend')?.checked;
  const thTV = document.getElementById('thTipVend');
  if(thTV) thTV.style.display = mostrarTV ? '' : 'none';

  const ft  = (document.getElementById('filtro_tip')?.value||'').toUpperCase();
  const ftv = (document.getElementById('filtro_tip_vend')?.value||'').toUpperCase();
  const fa  = (document.getElementById('filtro_asesor_base')?.value||'').toUpperCase();
  const fn  = (document.getElementById('filtro_numero')?.value||'').trim();

  let datos = (baseData[fechaActiva]||[]).filter(r=>{
    if(ft  && !(r.tipifBack||'').toUpperCase().includes(ft))  return false;
    if(ftv && (r._tipifVend||'').toUpperCase() !== ftv)       return false;
    if(fa  && !(r.asesor||'').toUpperCase().includes(fa))     return false;
    if(fn  && !r.n1.includes(fn) && !(r.n2||'').includes(fn))return false;
    return true;
  });

  if(!datos.length){ tbody.innerHTML=`<tr><td colspan="12" class="bo-empty">Sin registros en ${formatFecha(fechaActiva)}.</td></tr>`; return; }

  const asesorOpts = (asesor)=>asesores.map(a=>`<option value="${a.nombre}" ${a.nombre===asesor?'selected':''}>${a.nombre}</option>`).join('');

  tbody.innerHTML = datos.map((r,i)=>{
    const badgeTip  = r.tipifBack ? `<span class="badge ${tipifBadgeClass(r.tipifBack)}">${r.tipifBack}</span>` : '<span style="color:#ccc;font-size:10px">—</span>';
    const sinAsig   = r.sinAsignar ? '<span class="sin-asig-badge">Sin asig.</span>' : '<span style="color:#d1d5db;font-size:10px">—</span>';
    const rotBadge  = r.rotaciones>0 ? `<span style="background:#EDE9FE;color:#4C1D95;font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px;display:inline-block">${r.rotaciones}x</span>` : '<span style="color:#d1d5db;font-size:11px">0</span>';
    const tvCell    = mostrarTV ? `<td style="display:table-cell">${tipifVendHtml(r._tipifVend,r._tipifHora)}</td>` : `<td style="display:none"></td>`;
    return `
    <tr id="fila-${r.id}">
      <td style="color:#9ca3af;font-size:10px">${i+1}</td>
      <td><strong>${r.campana}</strong></td>
      <td style="font-size:11px">${r.distrito}</td>
      <td style="font-family:monospace;font-weight:700;color:#111827">${r.n1}</td>
      <td style="font-family:monospace;color:#6b7280">${r.n2||'—'}</td>
      <td>${badgeTip}</td>
      <td><select class="sel-asesor-tabla" onchange="reasignarBase(${r.id},this.value)">
        <option value="">— Sin asignar —</option>${asesorOpts(r.asesor)}
      </select></td>
      <td>${r.horaAsig?`<span class="hora-cell">${r.horaAsig}</span> <span class="hora-date">${formatFecha(fechaActiva)}</span>`:'<span class="hora-empty">—</span>'}</td>
      ${tvCell}
      <td>${sinAsig}</td>
      <td style="text-align:center">${rotBadge}</td>
      <td>
        <div class="acciones-cell">
          <button class="btn-rotar" onclick="abrirModalRotar(${r.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Rotar
          </button>
          <button class="btn-hist" onclick="toggleHist(${r.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Historial
          </button>
          <button class="btn-del" onclick="eliminarBase(${r.id})" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
    <tr class="historial-row ${histOpen[r.id]?'open':''}" id="hist-${r.id}">
      <td colspan="12">
        <div class="historial-inner">
          <div class="hist-label">Historial de asignaciones — N1: ${r.n1}</div>
          ${r.historial.length
            ? r.historial.map((h,hi)=>`<div class="hist-item"><div class="hist-dot" style="background:${DOT_COLORS[hi%DOT_COLORS.length]}"></div><span style="font-weight:600">${h.asesor}</span><span class="hora-cell" style="margin-left:4px">${h.hora}</span><span style="color:#9ca3af;margin-left:4px">${h.fecha}</span><span style="color:#6b7280;font-style:italic;margin-left:8px">${h.motivo}</span></div>`).join('')
            : '<div style="font-size:11px;color:#ccc">Sin historial.</div>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function toggleHist(id){ histOpen[id]=!histOpen[id]; renderBase(); }

async function reasignarBase(id, nuevoAsesor){
  let reg=null;
  for(const f in baseData){ reg=baseData[f].find(r=>r.id===id); if(reg) break; }
  if(!reg) return;
  const hora = horaAhora();
  if(!nuevoAsesor){
    reg.asesor=''; reg.horaAsig=''; reg.sinAsignar=true;
    if(reg._backendId) await actualizarLeadBackend(reg._backendId, { asesor_nombre:'', hora_asig:'' });
    renderBase(); return;
  }
  reg.asesor=nuevoAsesor; reg.horaAsig=hora; reg.sinAsignar=false;
  reg.historial.push({asesor:nuevoAsesor, hora, fecha:fechaHoy(), motivo:'Reasignacion directa'});
  historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana:reg.campana,asesor:nuevoAsesor,n1:reg.n1,n2:reg.n2||'—',tipif:reg.tipifBack||'—',accion:'Asignacion directa'});
  if(reg._backendId){
    await actualizarLeadBackend(reg._backendId, {
      asesor_nombre: nuevoAsesor, hora_asig: hora,
      historial: reg.historial,
    });
  }
  renderFechaTabs(); renderBase();
  mostrarToast(`N1 ${reg.n1} → ${nuevoAsesor} · ${hora}`);
}

async function eliminarBase(id){
  // Buscar el reg para obtener _backendId
  let reg = null;
  for(const f in baseData){ reg = baseData[f].find(r=>r.id===id); if(reg) break; }

  // Eliminar del backend
  if(reg && reg._backendId){
    try {
      await fetch(`${API_BO}/leads/${reg._backendId}`, {
        method: 'DELETE',
        headers: ncHeaders(),
      });
    } catch(e){ console.error('Error eliminando lead:', e); }
  }

  // Eliminar del estado local
  for(const f in baseData) baseData[f] = baseData[f].filter(r=>r.id!==id);
  delete histOpen[id];
  renderFechaTabs(); renderBase();
  mostrarToast('Lead eliminado');
}

function limpiarFiltrosBase(){
  ['filtro_tip','filtro_tip_vend','filtro_asesor_base'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const fn=document.getElementById('filtro_numero'); if(fn) fn.value='';
  renderBase();
}

/* ===================== MODAL ROTACIÓN MANUAL ===================== */
function abrirModalRotar(id){
  let reg=null;
  for(const f in baseData){ reg=baseData[f].find(r=>r.id===id); if(reg) break; }
  if(!reg) return;
  rotandoId = id;
  document.getElementById('modal-desc').textContent = `N1: ${reg.n1} — Asesor actual: ${reg.asesor||'Sin asignar'}`;
  poblarSelectAsesorForm();
  document.getElementById('modal-asesor').value = '';
  document.getElementById('modal-motivo').value = '';
  Array.from(document.getElementById('modal-asesor').options).forEach(o=>{o.disabled=o.value===reg.asesor; o.style.color=o.value===reg.asesor?'#ccc':'';});
  document.getElementById('modal-rotar').classList.add('open');
}
function cerrarModalRotar(){ document.getElementById('modal-rotar').classList.remove('open'); rotandoId=null; }

async function confirmarRotacion(){
  const nuevoAsesor = document.getElementById('modal-asesor').value;
  const motivo = document.getElementById('modal-motivo').value.trim()||'Rotacion manual';
  if(!nuevoAsesor){ document.getElementById('modal-asesor').style.borderColor='#ef4444'; return; }
  document.getElementById('modal-asesor').style.borderColor='#e5e7eb';
  let reg=null;
  for(const f in baseData){ reg=baseData[f].find(r=>r.id===rotandoId); if(reg) break; }
  if(!reg) return;
  const anterior=reg.asesor, hora=horaAhora();
  reg.asesor=nuevoAsesor; reg.horaAsig=hora; reg.sinAsignar=false; reg.rotaciones+=1;
  reg.historial.push({asesor:nuevoAsesor,hora,fecha:fechaHoy(),motivo});
  histOpen[rotandoId]=true;
  historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana:reg.campana,asesor:nuevoAsesor,n1:reg.n1,n2:reg.n2||'—',tipif:reg.tipifBack||'—',accion:`Rotacion desde ${anterior}`});
  if(reg._backendId){
    await actualizarLeadBackend(reg._backendId, {
      asesor_nombre: nuevoAsesor, hora_asig: hora,
      historial: reg.historial, sumarRotacion: true,
    });
  }
  cerrarModalRotar(); renderFechaTabs(); renderBase();
  mostrarToast(`Rotado: ${anterior} → ${nuevoAsesor} · ${hora}`);
}

/* ===================== ASESORES ===================== */
function renderAsesoresCards(){
  const el=document.getElementById('asesoresCards'); if(!el) return;
  const todos=Object.values(baseData).flat();
  el.innerHTML=asesores.map(a=>{
    const cnt=todos.filter(r=>r.asesor===a.nombre).length;
    return `<div class="bo-asesor-card">
      <div class="bo-asesor-card-avatar" style="background:${colorAv(a.nombre)}">${iniciales(a.nombre)}</div>
      <div class="bo-asesor-card-nombre">${a.nombre}</div>
      <div class="bo-asesor-card-sala">${a.sala||'—'}</div>
      <div class="bo-asesor-card-nums">${cnt}</div>
      <div class="bo-asesor-card-label">registros asignados</div>
    </div>`;
  }).join('');
}

/* ===================== RENDIMIENTO ===================== */
function onRendFiltroTipo(){
  const t=document.getElementById('rendFiltroTipo').value;
  document.getElementById('rendFiltroFechaWrap').style.display  = t==='dia'   ? '' : 'none';
  document.getElementById('rendFiltroDesdeWrap').style.display  = t==='rango' ? '' : 'none';
  document.getElementById('rendFiltroHastaWrap').style.display  = t==='rango' ? '' : 'none';
  renderRendimiento();
}
function setRendOrden(o){ document.getElementById('rendOrden').value=o; renderRendimiento(); }

function renderRendimiento(){
  const tipo      = document.getElementById('rendFiltroTipo')?.value||'mes';
  const mesActual = new Date().toISOString().slice(0,7);
  const diaFiltro = document.getElementById('rendFiltroFecha')?.value||fechaHoy();
  const desde     = document.getElementById('rendFiltroDesde')?.value||'';
  const hasta     = document.getElementById('rendFiltroHasta')?.value||'';
  const orden     = document.getElementById('rendOrden')?.value||'ventas_desc';

  let todosReg=[];
  for(const f in baseData){
    if(tipo==='mes'   && !f.startsWith(mesActual)) continue;
    if(tipo==='dia'   && f!==diaFiltro)            continue;
    if(tipo==='rango' && desde && f < desde)        continue;
    if(tipo==='rango' && hasta && f > hasta)        continue;
    todosReg = todosReg.concat(baseData[f]);
  }

  let rendData = asesores.map(a=>{
    const miRegs   = todosReg.filter(r=>r.asesor===a.nombre);
    const leads    = miRegs.length;
    const contesta = miRegs.filter(r=>(r._tipifVend||'').toUpperCase()==='CONTESTA'||(r._tipifVend||'').toUpperCase()==='VENTA CERRADA'||(r._tipifVend||'').toUpperCase()==='PREVENTA'||(r._tipifVend||'').toUpperCase()==='AGENDADO').length;
    const nc       = miRegs.filter(r=>(r._tipifVend||'').toUpperCase()==='NC'||(r._tipifVend||'').toUpperCase()==='NO CONTESTA'||(r._tipifVend||'').toUpperCase()==='BUZON DE VOZ').length;
    const ventas   = miRegs.filter(r=>(r._tipifVend||'').toUpperCase()==='VENTA CERRADA').length;
    const conv     = leads ? Math.round(ventas/leads*100) : 0;
    return {nombre:a.nombre, usuario:a.usuario||'', leads, contesta, nc, ventas, conv};
  });

  const sortMap = {
    'ventas_desc':(a,b)=>b.ventas-a.ventas,'ventas_asc':(a,b)=>a.ventas-b.ventas,
    'conv_desc':(a,b)=>b.conv-a.conv,'leads_desc':(a,b)=>b.leads-a.leads,
    'contesta_desc':(a,b)=>b.contesta-a.contesta,'nc_desc':(a,b)=>b.nc-a.nc,
  };
  rendData.sort(sortMap[orden]||sortMap['ventas_desc']);

  const totLeads=rendData.reduce((s,r)=>s+r.leads,0);
  const totVentas=rendData.reduce((s,r)=>s+r.ventas,0);
  const totConv=totLeads?Math.round(totVentas/totLeads*100):0;
  const maxVentas=Math.max(...rendData.map(r=>r.ventas),1);

  const kpis=document.getElementById('rendKpis');
  if(kpis) kpis.innerHTML=[['Total Leads',totLeads],['Total Ventas',totVentas],['Conversion',totConv+'%'],['Asesores',asesores.length]]
    .map(([l,v])=>`<div class="rend-kpi"><div class="rend-kpi-label">${l}</div><div class="rend-kpi-valor">${v}</div></div>`).join('');

  const tbody=document.getElementById('tablaRendimiento'); if(!tbody) return;
  if(!rendData.length){ tbody.innerHTML=`<tr><td colspan="8" class="bo-empty">Sin datos.</td></tr>`; return; }
  const pc=['p1','p2','p3'];
  tbody.innerHTML=rendData.map((r,i)=>`<tr>
    <td><div class="rend-pos ${pc[i]||''}">${i+1}</div></td>
    <td><div class="bo-cliente-cell"><div class="bo-cliente-avatar" style="background:${colorAv(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:600;font-size:13px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>
    <td style="font-weight:600">${r.leads}</td>
    <td style="color:#16a34a;font-weight:600">${r.contesta}</td>
    <td style="color:#d97706;font-weight:600">${r.nc}</td>
    <td><span style="font-size:18px;font-weight:800;color:#111827">${r.ventas}</span></td>
    <td><span class="badge ${r.conv>=30?'b-venta':r.conv>=15?'b-nocontesta':'b-default'}">${r.conv}%</span></td>
    <td><div class="rend-bar-wrap"><div class="rend-bar"><div class="rend-bar-fill" style="width:${Math.round(r.ventas/maxVentas*100)}%"></div></div><span style="font-size:10px;color:#9ca3af">${Math.round(r.ventas/maxVentas*100)}%</span></div></td>
  </tr>`).join('');
}

/* ===================== ROTACION MASIVA ===================== */
const ahoraNow = new Date();
function hace(h,m=0){ const d=new Date(ahoraNow); d.setHours(d.getHours()-h); d.setMinutes(d.getMinutes()-m); return d; }

function buildRotLeads(){
  const lista=[];
  const filtroFecha = (document.getElementById('rotFiltroFecha')||{}).value || '';
  const todasFechasBase = Object.keys(baseData).sort().reverse();
  const fechasFiltro = filtroFecha ? [filtroFecha] : todasFechasBase;
  fechasFiltro.forEach(fecha=>{
    (baseData[fecha]||[]).forEach(reg=>{
      let ultimaAsig = new Date(fecha+'T'+(reg.horaAsig||'00:00')+':00');
      if(isNaN(ultimaAsig)) ultimaAsig = hace(24);
      lista.push({ id:reg.id, nombre:reg.n1, campana:reg.campana, tel:reg.n1, n2:reg.n2||'', estado:reg.tipifBack||'Nuevo', asesor:reg.asesor||'', ultimaAsig, fecha, histAsesores:reg.historial?reg.historial.map(h=>h.asesor):[], _reg:reg });
    });
  });
  return lista;
}

let rotSel=new Set(), rotAsesor='', rotRotados=0;
function rotMins(f){ return Math.floor((ahoraNow-f)/60000); }
function rotTxt(f){ const m=rotMins(f); if(m<60) return m+' min'; const h=Math.floor(m/60),r=m%60; return h+'h'+(r>0?' '+r+'min':''); }
function rotApto(lead,asesor){
  if(!asesor) return {apto:false};
  const sinRepetir=!lead.histAsesores.includes(asesor);
  const mins=rotMins(lead.ultimaAsig), tiempo=mins>=120;
  const estadoOk=['Buzon','No contesta','Nuevo','BUZON','NO CONTESTA',''].includes(lead.estado);
  if(!lead.asesor) return {apto:sinRepetir, sinRepetir, tiempo:true, estadoOk:true};
  return {apto:sinRepetir&&tiempo&&estadoOk, sinRepetir, tiempo, estadoOk};
}

function rotRenderAsesores(){
  const el=document.getElementById('rotAsesoresDisp'); if(!el) return;
  const todos=Object.values(baseData).flat();
  el.innerHTML=asesores.map(a=>{
    const cnt=todos.filter(r=>r.asesor===a.nombre).length;
    return `<div class="rot-asesor-row"><span>${a.nombre}</span><span class="rot-asesor-badge">${cnt} registros</span></div>`;
  }).join('');
}

function rotPoblarFiltroFecha(){
  const sel = document.getElementById('rotFiltroFecha');
  if(!sel) return;
  const val = sel.value;
  const todasFechas = Object.keys(baseData).sort().reverse();
  sel.innerHTML = '<option value="">Todas las fechas</option>';
  todasFechas.forEach(f => {
    const cnt = (baseData[f]||[]).length;
    if(cnt === 0) return;
    sel.innerHTML += '<option value="'+f+'" '+(f===val?'selected':'')+'>'+formatFecha(f)+' ('+cnt+')</option>';
  });
}

function rotLimpiarFiltroFecha(){
  const sel = document.getElementById('rotFiltroFecha');
  if(sel) sel.value = '';
  rotFiltrarAptos();
}

function rotFiltrarAptos(){
  rotAsesor=document.getElementById('rotSelAsesor').value;
  rotSel.clear(); document.getElementById('rotChkAll').checked=false;
  rotRenderTabla(); document.getElementById('rotBtnRotar').disabled=!rotAsesor;
}

function rotRenderTabla(){
  const tbody=document.getElementById('rotTablaLeads');
  const allLeads=buildRotLeads(); let aptos=0;
  if(!allLeads.length){ tbody.innerHTML=`<tr><td colspan="9" class="bo-empty">Sin leads.</td></tr>`; document.getElementById('rotTagAptos').textContent='0 aptos'; document.getElementById('rotStatAptos').textContent=0; document.getElementById('rotStatNoAptos').textContent=0; document.getElementById('rotStatTotal').textContent=0; return; }
  tbody.innerHTML=allLeads.map(l=>{
    const{apto,sinRepetir,tiempo}=rotApto(l,rotAsesor);
    if(apto) aptos++;
    const mins=rotMins(l.ultimaAsig), checked=rotSel.has(l.id);
    const esFechaHoy=l.fecha===fechaHoy();
    const fechaLabel=esFechaHoy?`<span style="background:#dcfce7;color:#166534;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px">HOY</span>`:`<span style="background:#f3f4f6;color:#6b7280;font-size:9px;padding:1px 6px;border-radius:99px">${formatFecha(l.fecha)}</span>`;
    return `<tr class="${(!rotAsesor||apto)?'':'row-noapto'}">
      <td><input type="checkbox" ${checked?'checked':''} ${!apto&&rotAsesor?'disabled':''} onchange="rotToggleSel(${l.id},this.checked)"></td>
      <td><div style="font-family:monospace;font-weight:700;color:#111827;font-size:12px">${l.tel}</div><div style="font-size:10px;color:#9ca3af;margin-top:1px">${l.campana} · ${l.n2||'—'}</div></td>
      <td>${fechaLabel}</td>
      <td><span class="badge ${l.estado.toUpperCase().includes('VENTA')?'b-venta':l.estado.toUpperCase().includes('NO CONT')||l.estado==='No contesta'?'b-nocontesta':'b-default'}">${l.estado||'Sin tipif.'}</span></td>
      <td style="font-size:12px">${l.asesor}</td>
      <td class="hora-color">${l.ultimaAsig.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
      <td class="${tiempo?'timer-ok':'timer-fail'}">${rotTxt(l.ultimaAsig)} ${tiempo?'OK':'falta '+(120-mins)+'min'}</td>
      <td>${!rotAsesor?'—':sinRepetir?'<span class="check-ok">OK</span>':'<span class="check-fail">Ya tuvo</span>'}</td>
      <td>${!rotAsesor?'—':apto?'<span class="badge-apto">Apto</span>':'<span class="badge-noapto">No apto</span>'}</td>
    </tr>`;
  }).join('');
  document.getElementById('rotTagAptos').textContent=aptos+' aptos';
  document.getElementById('rotStatAptos').textContent=aptos;
  document.getElementById('rotStatNoAptos').textContent=allLeads.length-aptos;
  document.getElementById('rotStatTotal').textContent=allLeads.length;
}

function rotToggleSel(id,checked){
  const cant=parseInt(document.getElementById('rotCant').value)||4;
  if(checked){ if(rotSel.size>=cant){mostrarToast('Maximo '+cant+' leads');rotRenderTabla();return;} rotSel.add(id); } else rotSel.delete(id);
  rotRenderTabla();
}
function rotToggleAll(){
  const cant=parseInt(document.getElementById('rotCant').value)||4;
  rotSel.clear();
  if(document.getElementById('rotChkAll').checked) buildRotLeads().filter(l=>rotApto(l,rotAsesor).apto).slice(0,cant).forEach(l=>rotSel.add(l.id));
  rotRenderTabla();
}
function rotEjecutar(){
  if(!rotAsesor) return;
  const cant=parseInt(document.getElementById('rotCant').value)||4;
  if(rotSel.size===0) buildRotLeads().filter(l=>rotApto(l,rotAsesor).apto).slice(0,cant).forEach(l=>rotSel.add(l.id));
  if(rotSel.size===0){ mostrarToast('No hay leads aptos para '+rotAsesor); return; }
  const btn=document.getElementById('rotBtnRotar'); btn.disabled=true; btn.textContent='Rotando...';
  let p=0;
  const iv=setInterval(()=>{
    p+=25; document.getElementById('rotProgress').style.width=p+'%';
    if(p>=100){ clearInterval(iv); rotFinalizar(); btn.textContent='Rotar ahora'; btn.disabled=false; }
  },200);
}
async function rotFinalizar(){
  const hora=horaAhora();
  const allLeads=buildRotLeads();
  const rotados=allLeads.filter(l=>rotSel.has(l.id));
  for(const l of rotados){
    const reg=l._reg;
    reg.asesor=rotAsesor; reg.horaAsig=hora; reg.sinAsignar=false;
    reg.rotaciones=(reg.rotaciones||0)+1;
    reg.historial.push({asesor:rotAsesor,hora,fecha:fechaHoy(),motivo:'Rotacion masiva'});
    historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana:reg.campana,asesor:rotAsesor,n1:reg.n1,n2:reg.n2||'—',tipif:reg.tipifBack||'—',accion:'Rotacion masiva'});
    if(reg._backendId){
      await actualizarLeadBackend(reg._backendId, {
        asesor_nombre:rotAsesor, hora_asig:hora,
        historial:reg.historial, sumarRotacion:true,
      });
    }
  }
  rotRotados+=rotados.length;
  document.getElementById('rotStatRotados').textContent=rotRotados;
  const res=document.getElementById('rotResultado'); res.classList.add('show');
  document.getElementById('rotResLista').innerHTML=rotados.map(l=>`<div class="rot-res-item"><div class="rot-res-dot"></div><strong>${l.tel}</strong> → <strong>${rotAsesor}</strong> · ${hora}</div>`).join('');
  rotSel.clear(); rotRenderTabla(); rotRenderAsesores(); renderFechaTabs(); renderBase();
  mostrarToast(`${rotados.length} leads rotados a ${rotAsesor}`);
}

function toggleRotacion(){
  const panel=document.getElementById('panelRotacion');
  const btn=document.getElementById('btnRotToggle');
  const abierto=panel.style.display!=='none';
  panel.style.display=abierto?'none':'';
  btn.classList.toggle('abierto',!abierto);
  if(!abierto){ rotPoblarFiltroFecha(); rotRenderAsesores(); rotRenderTabla(); }
}

/* ===================== CARGA MASIVA ===================== */
let archivoRows=[];

function switchTabCarga(tab){
  ['pegar','archivo','legacy'].forEach(t=>{
    document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
    document.getElementById('panel'+t.charAt(0).toUpperCase()+t.slice(1)).style.display=t===tab?'':'none';
  });
  if(tab==='legacy') poblarLegacyFecha();
}

function poblarSelectMasiva(){
  const sel=document.getElementById('masivaasesor'); if(!sel) return;
  const val=sel.value;
  sel.innerHTML='<option value="">— Sin asignar —</option>';
  asesores.forEach(a=>sel.innerHTML+=`<option value="${a.nombre}">${a.nombre}</option>`);
  sel.value=val;
}

// Devuelve un Set con todos los N1 ya existentes en toda la base (cualquier fecha)
function obtenerN1Existentes(){
  const set = new Set();
  for(const f in baseData){
    (baseData[f]||[]).forEach(r=>{ if(r.n1) set.add(String(r.n1).replace(/\s+/g,'')); });
  }
  return set;
}

function previsualizarMasiva(){
  const raw=document.getElementById('masivaNums').value.trim();
  if(!raw){ mostrarToast('Pega numeros primero'); return; }
  const numsRaw=raw.split(/[\n,;]+/).map(n=>n.trim().replace(/\s+/g,'')).filter(n=>n.length>=7);
  if(!numsRaw.length){ mostrarToast('No se encontraron numeros validos'); return; }
  const loteRaw=document.getElementById('masivaLote').value; const lote=(loteRaw===''||loteRaw==null)?10:parseInt(loteRaw);
  const numsLote=lote>0?numsRaw.slice(0,lote):numsRaw;
  const campana=document.getElementById('masivacamp').value.trim()||'—';
  const asesor=document.getElementById('masivaasesor').value;

  // ---- Deteccion de duplicados ----
  const existentes = obtenerN1Existentes();   // ya cargados en el sistema
  const vistos = new Set();                    // para detectar repetidos dentro de la lista
  const filas = [];                            // {n1, dup, motivo}
  let nDupLista=0, nDupBase=0, nUnicos=0;

  numsLote.forEach(n=>{
    let dup=false, motivo='';
    if(vistos.has(n)){ dup=true; motivo='Repetido en la lista'; nDupLista++; }
    else if(existentes.has(n)){ dup=true; motivo='Ya esta en el sistema'; nDupBase++; }
    else { nUnicos++; }
    vistos.add(n);
    filas.push({n1:n, dup, motivo});
  });

  // Guardar para usar al cargar
  window._masivaFilas = filas;

  // ---- Render de la tabla con marca de duplicados ----
  const tbody=document.getElementById('masivaPreviewBody');
  tbody.innerHTML=filas.map((f,i)=>{
    const bg = f.dup ? 'background:#fef2f2;' : '';
    const badge = f.dup
      ? `<span style="background:#fee2e2;color:#991b1b;font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;">DUPLICADO</span> <span style="font-size:9px;color:#b91c1c;">${f.motivo}</span>`
      : `<span style="background:#dcfce7;color:#15803d;font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;">NUEVO</span>`;
    return `<tr style="border-bottom:1px solid #f3f4f6;${bg}">`+
      `<td style="padding:5px 10px;color:#9ca3af">${i+1}</td>`+
      `<td style="padding:5px 10px;font-family:monospace;font-weight:600">${f.n1}</td>`+
      `<td style="padding:5px 10px;color:#374151">${campana}</td>`+
      `<td style="padding:5px 10px;color:#374151">${formatFecha(fechaActiva)}</td>`+
      `<td style="padding:5px 10px;">${badge}</td>`+
    `</tr>`;
  }).join('');

  document.getElementById('masivaPreview').style.display='';

  // ---- Alerta de duplicados + checkbox para incluirlos ----
  const totalDup = nDupLista + nDupBase;
  const st = document.getElementById('masivaStatus');
  if(totalDup>0){
    st.innerHTML = `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;color:#92400e;">`+
      `Se detectaron <strong>${totalDup} duplicados</strong> `+
      `(${nDupBase} ya en el sistema, ${nDupLista} repetidos en la lista). `+
      `<strong>${nUnicos} numeros nuevos</strong>.<br>`+
      `<label style="display:inline-flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer;font-size:11px;color:#374151;">`+
      `<input type="checkbox" id="chkIncluirDup" onchange="actualizarBtnCargaMasiva()"> Cargar tambien los duplicados</label>`+
      `</div>`;
  } else {
    st.innerHTML = `<span style="color:#15803d;font-weight:600;">${nUnicos} numeros nuevos, sin duplicados.</span>`;
  }
  actualizarBtnCargaMasiva();
}

// Actualiza el texto del boton segun si se incluyen duplicados o no
function actualizarBtnCargaMasiva(){
  const filas = window._masivaFilas||[];
  const incluirDup = document.getElementById('chkIncluirDup')?.checked;
  const aCargar = incluirDup ? filas.length : filas.filter(f=>!f.dup).length;
  const btn=document.getElementById('btnCargaMasiva');
  btn.disabled = aCargar===0;
  btn.textContent = `Cargar ${aCargar} registros`;
}

async function ejecutarCargaMasiva(){
  const cmSel = document.getElementById('cm-fnav-select');
  if(cmSel && cmSel.value) fechaActiva = cmSel.value;

  // Usar las filas calculadas en la vista previa (con info de duplicados)
  const filas = window._masivaFilas || [];
  if(!filas.length){ mostrarToast('Primero dale a Vista previa'); return; }
  const incluirDup = document.getElementById('chkIncluirDup')?.checked;
  const lista = (incluirDup ? filas : filas.filter(f=>!f.dup)).map(f=>f.n1);
  if(!lista.length){ mostrarToast('No hay numeros nuevos para cargar'); return; }
  const campana=document.getElementById('masivacamp').value.trim()||'—';
  const asesor=document.getElementById('masivaasesor').value;
  const hora=asesor?horaAhora():'';
  if(!baseData[fechaActiva]) baseData[fechaActiva]=[];

  const leadsParaBackend = [];
  let importados=0;
  lista.forEach(n1=>{
    if(baseData[fechaActiva].find(r=>r.n1===n1)) return;
    const tipAuto=getTipifVendedor(n1);
    const reg = {id:baseIdCnt++,campana,distrito:'—',n1,n2:'',tipifBack:'',asesor,horaAsig:hora,sinAsignar:!asesor,rotaciones:0,_tipifVend:tipAuto?tipAuto.tipif:'',_tipifHora:tipAuto?tipAuto.hora:'',historial:asesor?[{asesor,hora,fecha:fechaActiva,motivo:'Carga masiva'}]:[]};
    baseData[fechaActiva].push(reg);
    leadsParaBackend.push({ campana, distrito:'—', n1, n2:'', tipif_back:'', asesor_nombre:asesor, fecha:fechaActiva, hora_asig:hora });
    if(asesor) historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana,asesor,n1,n2:'—',tipif:'—',accion:'Carga masiva'});
    importados++;
  });

  if(leadsParaBackend.length){
    try {
      const res = await fetch(API_BO + '/leads', {
        method:'POST', headers:ncHeaders(),
        body: JSON.stringify(leadsParaBackend),
      });
      const data = await res.json();
      if(data.ok && data.ids){
        const regs = baseData[fechaActiva].slice(-data.ids.length);
        data.ids.forEach((id,i) => { if(regs[i]) regs[i]._backendId = id; });
      }
    } catch(e){}
  }

  document.getElementById('masivaNums').value='';
  document.getElementById('masivaPreview').style.display='none';
  document.getElementById('btnCargaMasiva').disabled=true;
  document.getElementById('masivaStatus').innerHTML='';
  window._masivaFilas=[];
  renderFechaTabs(); renderBase();
  renderFechasCargaMasiva();
  mostrarToast(`${importados} registros cargados${asesor?' → '+asesor:''}`);
}

function handleFileDrop(files){ if(files.length) procesarArchivo(files[0]); }
function handleFileSelect(files){ if(files.length) procesarArchivo(files[0]); }

function procesarArchivo(file){
  const st=document.getElementById('archivoStatus');
  st.textContent=`Leyendo ${file.name}...`;
  const reader=new FileReader();
  reader.onload=e=>{
    const text=e.target.result;
    const lineas=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
    if(!lineas.length){ st.textContent='Archivo vacio'; return; }
    const sep=lineas[0].includes('\t')?'\t':lineas[0].includes(';')?';':',';
    const primeraCelda=lineas[0].split(sep)[0].trim();
    const tieneCabecera=isNaN(primeraCelda.replace(/\s/g,''))&&primeraCelda.length>0&&!/^\d{7,}$/.test(primeraCelda);
    const cabecera=tieneCabecera?lineas[0].split(sep).map(c=>c.trim().toLowerCase()):null;
    const datos=tieneCabecera?lineas.slice(1):lineas;
    const iN1=cabecera?(cabecera.findIndex(c=>c.includes('n1')||c.includes('numero')||c.includes('telefono'))):0;
    const iN2=cabecera?(cabecera.findIndex(c=>c.includes('n2'))):-1;
    const iCamp=cabecera?(cabecera.findIndex(c=>c.includes('camp')||c.includes('zona'))):-1;
    const iDist=cabecera?(cabecera.findIndex(c=>c.includes('dist'))):-1;
    const iTip=cabecera?(cabecera.findIndex(c=>c.includes('tipif')||c.includes('estado'))):-1;
    archivoRows=datos.map(linea=>{
      const cols=linea.split(sep).map(c=>c.trim().replace(/^["']|["']$/g,''));
      const n1=cols[iN1>=0?iN1:0]||'';
      if(!n1||n1.length<6) return null;
      return {n1,n2:iN2>=0?(cols[iN2]||''):'',camp:iCamp>=0?(cols[iCamp]||'—'):'—',dist:iDist>=0?(cols[iDist]||'—'):'—',tipif:iTip>=0?(cols[iTip]||''):''};
    }).filter(Boolean);
    if(!archivoRows.length){ st.textContent='No se encontraron registros validos'; return; }
    st.textContent='';
    document.getElementById('archivoInfo').textContent=`${archivoRows.length} registros en "${file.name}"`;
    const tbody=document.getElementById('archivoPreviewBody');
    tbody.innerHTML=archivoRows.slice(0,50).map((r,i)=>`<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:5px 10px;color:#9ca3af">${i+1}</td><td style="padding:5px 10px;font-family:monospace;font-weight:600">${r.n1}</td><td style="padding:5px 10px">${r.camp}</td><td style="padding:5px 10px">${r.dist}</td><td style="padding:5px 10px">${r.tipif||'—'}</td></tr>`).join('');
    document.getElementById('archivoPreview').style.display='';
    document.getElementById('btnCargaArchivo').textContent=`Cargar ${archivoRows.length} registros`;
  };
  reader.readAsText(file,'UTF-8');
}

async function ejecutarCargaArchivo(){
  if(!archivoRows.length){ mostrarToast('No hay datos'); return; }
  if(!baseData[fechaActiva]) baseData[fechaActiva]=[];
  let importados=0,omitidos=0;
  const leadsBackend=[];
  archivoRows.forEach(r=>{
    if(baseData[fechaActiva].find(x=>x.n1===r.n1)){omitidos++;return;}
    const tipAuto=getTipifVendedor(r.n1);
    baseData[fechaActiva].push({id:baseIdCnt++,campana:r.camp,distrito:r.dist,n1:r.n1,n2:r.n2,tipifBack:r.tipif,asesor:'',horaAsig:'',sinAsignar:true,rotaciones:0,_tipifVend:tipAuto?.tipif||'',_tipifHora:tipAuto?.hora||'',historial:[]});
    leadsBackend.push({campana:r.camp,distrito:r.dist,n1:r.n1,n2:r.n2,tipif_back:r.tipif,asesor_nombre:'',fecha:fechaActiva,hora_asig:''});
    importados++;
  });
  if(leadsBackend.length){
    try { await fetch(API_BO+'/leads',{method:'POST',headers:ncHeaders(),body:JSON.stringify(leadsBackend)}); } catch(e){}
  }
  archivoRows=[];
  document.getElementById('archivoPreview').style.display='none';
  document.getElementById('archivoStatus').textContent='';
  document.getElementById('archivoInput').value='';
  renderFechaTabs(); renderBase();
  mostrarToast(`${importados} importados${omitidos?' · '+omitidos+' omitidos':''}`);
}

let legacyRows=[];
function poblarLegacyFecha(){
  const sel=document.getElementById('legacyFecha'); if(!sel) return;
  sel.innerHTML=fechaPestanas.map(f=>`<option value="${f}" ${f===fechaActiva?'selected':''}>${formatFecha(f)}</option>`).join('');
}
function handleLegacyDrop(files){ if(files.length) procesarLegacy(files[0]); }
function handleLegacySelect(files){ if(files.length) procesarLegacy(files[0]); }

function procesarLegacy(file){
  const st=document.getElementById('legacyStatus');
  st.textContent=`Leyendo ${file.name}...`;
  const reader=new FileReader();
  reader.onload=e=>{
    const text=e.target.result;
    const lineas=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
    if(!lineas.length){ st.textContent='Archivo vacio'; return; }
    const sep=lineas[0].includes('\t')?'\t':lineas[0].includes(';')?';':',';
    const primera=lineas[0].split(sep);
    const tieneCab=isNaN((primera[3]||'').replace(/\s/g,''))||(primera[3]||'').length<6;
    const datos=tieneCab?lineas.slice(1):lineas;
    const fechaDest=document.getElementById('legacyFecha')?.value||fechaActiva;
    const usarFechaFila=document.getElementById('legacyUsarFecha')?.value==='si';
    legacyRows=[];
    datos.forEach(linea=>{
      const c=linea.split(sep).map(x=>x.trim().replace(/^["']|["']$/g,''));
      const n1=c[3]||c[0]||'';
      if(!n1||n1.length<6) return;
      const asesoresHist=[];
      for(let i=8;i<=13;i++){ const a=(c[i]||'').trim(); if(a&&a.length>1) asesoresHist.push(a); }
      let fechaFila=fechaDest;
      if(usarFechaFila){ for(let i=0;i<c.length;i++){ const m=c[i].match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(m){fechaFila=`${m[3]}-${m[2]}-${m[1]}`;break;} if(/^\d{4}-\d{2}-\d{2}$/.test(c[i])){fechaFila=c[i];break;} } }
      legacyRows.push({campana:c[0]||'—',distrito:c[1]||'—',n2:c[2]||'',n1,tipifBack:c[4]||'',comentario:c[5]||'',tipifVend:c[6]||'',hora:c[7]||'',asesores:asesoresHist,fecha:fechaFila});
    });
    if(!legacyRows.length){ st.textContent='No se encontraron filas validas'; return; }
    st.textContent='';
    document.getElementById('legacyInfo').textContent=`${legacyRows.length} registros desde "${file.name}"`;
    const tbody=document.getElementById('legacyPreviewBody');
    tbody.innerHTML=legacyRows.slice(0,60).map((r,i)=>`<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:4px 10px;color:#9ca3af">${i+1}</td><td style="padding:4px 10px;font-weight:600">${r.campana}</td><td style="padding:4px 10px">${r.distrito}</td><td style="padding:4px 10px;font-family:monospace;font-weight:700;color:#111827">${r.n1}</td><td style="padding:4px 10px;font-family:monospace;color:#6b7280">${r.n2||'—'}</td><td style="padding:4px 10px">${r.tipifBack||'—'}</td><td style="padding:4px 10px">${r.tipifVend||'—'}</td><td style="padding:4px 10px;color:#185FA5;font-weight:600">${r.hora||'—'}</td><td style="padding:4px 10px;color:#6b7280">${r.asesores.join(' → ')||'—'}</td><td style="padding:4px 10px;color:#374151">${formatFecha(r.fecha)}</td></tr>`).join('');
    document.getElementById('legacyPreview').style.display='';
    document.getElementById('btnCargaLegacy').textContent=`Importar ${legacyRows.length} registros`;
  };
  reader.readAsText(file,'UTF-8');
}

async function ejecutarCargaLegacy(){
  if(!legacyRows.length){ mostrarToast('No hay datos'); return; }
  let importados=0,omitidos=0,nuevasFechas=0;
  const leadsBackend=[];
  legacyRows.forEach(r=>{
    const fecha=r.fecha;
    if(!fechaPestanas.includes(fecha)){ fechaPestanas.push(fecha); fechaPestanas.sort().reverse(); if(!baseData[fecha]) baseData[fecha]=[]; nuevasFechas++; }
    if(!baseData[fecha]) baseData[fecha]=[];
    if(baseData[fecha].find(x=>x.n1===r.n1)){ omitidos++; return; }
    const hist=r.asesores.map((a,i)=>({asesor:a,hora:r.hora||'—',fecha,motivo:i===0?'Asignacion inicial':`Rotacion ${i}`}));
    const tipAuto=getTipifVendedor(r.n1);
    baseData[fecha].push({id:baseIdCnt++,campana:r.campana,distrito:r.distrito,n1:r.n1,n2:r.n2,tipifBack:r.tipifBack,asesor:r.asesores[r.asesores.length-1]||'',horaAsig:r.hora,sinAsignar:r.asesores.length===0,rotaciones:Math.max(0,r.asesores.length-1),_tipifVend:tipAuto?.tipif||r.tipifVend||'',_tipifHora:tipAuto?.hora||r.hora||'',_comentario:r.comentario,historial:hist});
    leadsBackend.push({campana:r.campana,distrito:r.distrito,n1:r.n1,n2:r.n2,tipif_back:r.tipifBack,asesor_nombre:r.asesores[r.asesores.length-1]||'',fecha,hora_asig:r.hora});
    importados++;
  });
  if(leadsBackend.length){
    try { await fetch(API_BO+'/leads',{method:'POST',headers:ncHeaders(),body:JSON.stringify(leadsBackend)}); } catch(e){}
  }
  legacyRows=[];
  document.getElementById('legacyPreview').style.display='none';
  document.getElementById('legacyStatus').textContent='';
  document.getElementById('legacyInput').value='';
  renderFechaTabs(); renderBase();
  mostrarToast(`${importados} importados${nuevasFechas?' · '+nuevasFechas+' fechas nuevas':''}${omitidos?' · '+omitidos+' omitidos':''}`);
}

/* ===================== NAVEGACION ===================== */
function mostrarSeccion(id,btn){
  document.querySelectorAll('.bo-seccion').forEach(s=>s.classList.add('hidden'));
  const sec=document.getElementById('sec-'+id); if(sec) sec.classList.remove('hidden');
  document.querySelectorAll('.bo-nav').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(id==='base')         { renderFechaTabs(); renderBase(); }
  if(id==='asesores')     renderAsesoresCards();
  if(id==='rendimiento')  renderRendimiento();
  if(id==='carga-masiva'){ poblarSelectMasiva(); poblarLegacyFecha(); renderFechasCargaMasiva(); }
}

function syncLocalStorage(){
  try{ localStorage.setItem('bo_baseData', JSON.stringify(baseData)); }catch(e){}
}

/* ===================== CARGAR LEADS DESDE BACKEND ===================== */
async function cargarLeadsBackend() {
  try {
    const res  = await fetch(API_BO + '/leads', { headers: ncHeaders() });
    const data = await res.json();
    if (!data.ok) return;

    const nuevoBaseData = {};
    const nuevasFechas = [];

    data.data.forEach(l => {
      const fecha = l.fecha || fechaHoy();
      if (!nuevoBaseData[fecha]) nuevoBaseData[fecha] = [];
      if (!nuevasFechas.includes(fecha)) nuevasFechas.push(fecha);

      let regExistente = null;
      for (const f in baseData) {
        regExistente = baseData[f].find(r => r._backendId === l.id);
        if (regExistente) break;
      }

      nuevoBaseData[fecha].push({
        id:          regExistente ? regExistente.id : baseIdCnt++,
        _backendId:  l.id,
        campana:     l.campana || '—',
        distrito:    l.distrito || '—',
        n1:          l.n1,
        n2:          l.n2 || '',
        tipifBack:   l.tipif_back || '',
        asesor:      l.asesor_nombre || '',
        horaAsig:    l.hora_asig || '',
        sinAsignar:  !!l.sin_asignar,
        rotaciones:  l.rotaciones || 0,
        _tipifVend:  l.tipif_vend || '',
        _tipifHora:  l.tipif_hora || '',
        historial:   Array.isArray(l.historial) ? l.historial : [],
      });
    });

    if (!nuevasFechas.includes(fechaHoy())) nuevasFechas.push(fechaHoy());
    nuevasFechas.sort().reverse();

    baseData = nuevoBaseData;
    fechaPestanas = nuevasFechas;
    if (!fechaPestanas.includes(fechaActiva)) fechaActiva = fechaPestanas[0];

    renderFechaTabs();
    renderBase();
  } catch(e) { console.error('Error cargando leads:', e); }
}

/* ===================== FECHAS CARGA MASIVA ===================== */
function renderFechasCargaMasiva(){
  const sel = document.getElementById('cm-fnav-select');
  if(!sel) return;
  sel.innerHTML = fechaPestanas.map(f=>{
    const c = (baseData[f]||[]).length;
    const sel2 = f===fechaActiva ? 'selected' : '';
    return '<option value="'+f+'" '+sel2+'>'+formatFecha(f)+' ('+c+')</option>';
  }).join('');
  const count = document.getElementById('cm-fnav-count');
  if(count) count.textContent = (fechaPestanas.indexOf(fechaActiva)+1) + ' / ' + fechaPestanas.length;
}

function cambiarFechaCargaMasiva(f){
  fechaActiva = f;
  renderFechaTabs();
  renderFechasCargaMasiva();
}

function agregarFechaCargaMasiva(){
  const picker = document.getElementById('cm-calPicker');
  const f = picker ? picker.value : '';
  if(!f){ mostrarToast('Selecciona una fecha primero'); return; }
  if(!fechaPestanas.includes(f)){
    fechaPestanas.push(f);
    fechaPestanas.sort().reverse();
    if(!baseData[f]) baseData[f] = [];
    mostrarToast('Fecha ' + formatFecha(f) + ' agregada');
  } else {
    mostrarToast('Esa fecha ya existe');
  }
  picker.value = '';
  fechaActiva = f;
  renderFechaTabs();
  renderFechasCargaMasiva();
}



/* ── UBIGEO Perú — Departamento/Provincia/Distrito ── */
const UBIGEO_PERU = {"LAMBAYEQUE": {"CHICLAYO": ["CHICLAYO", "ETEN", "JOSE LEONARDO ORTIZ", "LA VICTORIA", "MONSEFU", "PICSI", "PIMENTEL", "POMALCA", "REQUE", "TUMAN"], "FERREÑAFE": ["FERREÑAFE", "PUEBLO NUEVO"], "LAMBAYEQUE": ["LAMBAYEQUE", "MOTUPE", "OLMOS", "TUCUME"]}, "CAJAMARCA": {"CAJAMARCA": ["CAJAMARCA", "LOS BAÑOS DEL INCA"], "CHOTA": ["CHOTA"], "CUTERVO": ["CUTERVO"], "JAEN": ["JAEN"], "HUALGAYOC": ["BAMBAMARCA"], "CELENDIN": ["CELENDIN"], "CAJABAMBA": ["CAJABAMBA"], "SAN IGNACIO": ["SAN IGNACIO"]}, "LIMA": {"LIMA": ["ANCON", "ATE", "BARRANCO", "BREÑA", "CARABAYLLO", "CERCADO DE LIMA", "CHACLACAYO", "CHORRILLOS", "CIENEGUILLA", "COMAS", "EL AGUSTINO", "INDEPENDENCIA", "JESUS MARIA", "LA MOLINA", "LA VICTORIA", "LIMA", "LINCE", "LOS OLIVOS", "LURIGANCHO", "LURIN", "MAGDALENA DEL MAR", "MIRAFLORES", "PACHACAMAC", "PUCUSANA", "PUEBLO LIBRE", "PUENTE PIEDRA", "PUNTA HERMOSA", "RIMAC", "SAN BARTOLO", "SAN BORJA", "SAN ISIDRO", "SAN JUAN DE LURIGANCHO", "SAN JUAN DE MIRAFLORES", "SAN LUIS", "SAN MARTIN DE PORRES", "SAN MIGUEL", "SANTA ANITA", "SANTA MARIA DEL MAR", "SANTA ROSA", "SANTIAGO DE SURCO", "SURQUILLO", "VILLA EL SALVADOR", "VILLA MARIA DEL TRIUNFO"], "HUARAL": ["CHANCAY", "HUARAL"], "CALLAO": ["BELLAVISTA", "CALLAO", "CARMEN DE LA LEGUA REYNOSO", "LA PERLA", "LA PUNTA", "MI PERU", "VENTANILLA"], "HUAURA": ["CALETA DE CARQUIN", "HUACHO", "HUALMAY", "HUAURA", "SANTA MARIA"], "CAÑETE": ["CHILCA", "IMPERIAL", "MALA", "SAN VICENTE DE CAÑETE"], "BARRANCA": ["BARRANCA", "PARAMONGA", "SUPE", "SUPE PUERTO"]}, "AYACUCHO": {"HUAMANGA": ["ANDRES AVELINO CACERES DORREGARAY", "AYACUCHO", "CARMEN ALTO", "JESUS NAZARENO", "SAN JUAN BAUTISTA"], "PARINACOCHAS": ["CORACORA"], "LUCANAS": ["PUQUIO"], "HUANTA": ["HUANTA"], "LA MAR": ["AYNA"]}, "PIURA": {"TALARA": ["LOS ORGANOS", "MANCORA", "PARIÑAS"], "PIURA": ["CASTILLA", "CATACAOS", "LA UNION", "PIURA", "TAMBO GRANDE", "VEINTISEIS DE OCTUBRE"], "SULLANA": ["BELLAVISTA", "SULLANA"], "SECHURA": ["SECHURA"], "PAITA": ["PAITA"], "MORROPON": ["CHULUCANAS"], "HUANCABAMBA": ["HUANCABAMBA"]}, "ICA": {"PISCO": ["PARACAS", "PISCO", "TUPAC AMARU INCA"], "ICA": ["ICA", "LA TINGUIÑA", "PARCONA", "SALAS", "SAN JUAN BAUTISTA", "SUBTANJALLA"], "NAZCA": ["MARCONA", "NAZCA", "VISTA ALEGRE"], "CHINCHA": ["CHINCHA ALTA", "GROCIO PRADO", "PUEBLO NUEVO", "SUNAMPE"]}, "LA LIBERTAD": {"TRUJILLO": ["EL PORVENIR", "FLORENCIA DE MORA", "HUANCHACO", "LA ESPERANZA", "LAREDO", "MOCHE", "SALAVERRY", "TRUJILLO", "VICTOR LARCO HERRERA"], "CHEPEN": ["CHEPEN"], "PACASMAYO": ["PACASMAYO", "SAN PEDRO DE LLOC"], "VIRU": ["CHAO", "VIRU"], "SANCHEZ CARRION": ["HUAMACHUCO"], "ASCOPE": ["CASA GRANDE"], "OTUZCO": ["OTUZCO"]}, "JUNIN": {"HUANCAYO": ["CHILCA", "EL TAMBO", "HUANCAYO", "PILCOMAYO"], "TARMA": ["TARMA"], "YAULI": ["LA OROYA", "SANTA ROSA DE SACCO"], "JAUJA": ["JAUJA", "SAUSA", "YAUYOS"], "CHUPACA": ["CHUPACA"], "CHANCHAMAYO": ["CHANCHAMAYO", "PERENE", "PICHANAQUI", "SAN RAMON"], "SATIPO": ["MAZAMARI", "PANGOA", "SATIPO"]}, "PUNO": {"CHUCUITO": ["DESAGUADERO", "JULI"], "PUNO": ["ACORA", "PUNO"], "MELGAR": ["AYAVIRI"], "SAN ROMAN": ["JULIACA", "SAN MIGUEL"], "YUNGUYO": ["YUNGUYO"], "AZANGARO": ["AZANGARO"], "SANDIA": ["SANDIA"], "EL COLLAO": ["ILAVE"], "CARABAYA": ["MACUSANI"], "HUANCANE": ["HUANCANE"], "SAN ANTONIO DE PUTINA": ["ANANEA"]}, "AREQUIPA": {"AREQUIPA": ["ALTO SELVA ALEGRE", "AREQUIPA", "CAYMA", "CERRO COLORADO", "CHARACATO", "JACOBO HUNTER", "JOSE LUIS BUSTAMANTE Y RIVERO", "LA JOYA", "MARIANO MELGAR", "MIRAFLORES", "PAUCARPATA", "SABANDIA", "SACHACA", "SOCABAYA", "UCHUMAYO", "YANAHUARA", "YURA"], "CARAVELI": ["CHALA"], "CAMANA": ["CAMANA", "MARIANO NICOLAS VALCARCEL", "NICOLAS DE PIEROLA", "SAMUEL PASTOR"], "CAYLLOMA": ["MAJES"], "ISLAY": ["MEJIA", "MOLLENDO"]}, "APURIMAC": {"ABANCAY": ["ABANCAY", "TAMBURCO"], "ANDAHUAYLAS": ["ANDAHUAYLAS"], "COTABAMBAS": ["CHALLHUAHUACHO"], "CHINCHEROS": ["ANCO-HUALLO"]}, "CUSCO": {"CUSCO": ["CUSCO", "SAN JERONIMO", "SAN SEBASTIAN", "SANTIAGO", "WANCHAQ"], "CANCHIS": ["SICUANI"], "ESPINAR": ["ESPINAR"], "CALCA": ["CALCA"], "URUBAMBA": ["URUBAMBA"], "LA CONVENCION": ["KIMBIRI", "PICHARI", "SANTA ANA"], "QUISPICANCHI": ["URCOS"]}, "ANCASH": {"SANTA": ["CHIMBOTE", "COISHCO", "NUEVO CHIMBOTE", "SANTA"], "HUARAZ": ["HUARAZ", "INDEPENDENCIA"], "CASMA": ["CASMA"], "YUNGAY": ["YUNGAY"], "HUAYLAS": ["CARAZ"], "HUARMEY": ["HUARMEY"]}, "TACNA": {"TACNA": ["ALTO DE LA ALIANZA", "CIUDAD NUEVA", "CORONEL GREGORIO ALBARRACIN LANCHIPA", "POCOLLAY", "TACNA"]}, "MOQUEGUA": {"ILO": ["ILO", "PACOCHA"], "MARISCAL NIETO": ["MOQUEGUA", "SAMEGUA"]}, "UCAYALI": {"CORONEL PORTILLO": ["CALLERIA", "MANANTAY", "YARINACOCHA"], "PADRE ABAD": ["PADRE ABAD"]}, "HUANUCO": {"HUANUCO": ["AMARILIS", "HUANUCO", "PILLCO MARCA"], "LEONCIO PRADO": ["CASTILLO GRANDE", "JOSE CRESPO Y CASTILLO", "MARIANO DAMASO BERAUN", "RUPA-RUPA"], "PUERTO INCA": ["PUERTO INCA"], "AMBO": ["AMBO"]}, "SAN MARTIN": {"SAN MARTIN": ["CACATACHI", "LA BANDA DE SHILCAYO", "MORALES", "TARAPOTO"], "RIOJA": ["NUEVA CAJAMARCA", "RIOJA"], "MARISCAL CACERES": ["JUANJUI"], "BELLAVISTA": ["BELLAVISTA"], "MOYOBAMBA": ["MOYOBAMBA"], "TOCACHE": ["TOCACHE"]}, "AMAZONAS": {"CHACHAPOYAS": ["CHACHAPOYAS"], "BAGUA": ["BAGUA"], "UTCUBAMBA": ["BAGUA GRANDE"]}, "PASCO": {"PASCO": ["CHAUPIMARCA", "YANACANCHA"], "OXAPAMPA": ["CHONTABAMBA", "OXAPAMPA", "PUERTO BERMUDEZ", "VILLA RICA"]}, "TUMBES": {"TUMBES": ["CORRALES", "TUMBES"], "ZARUMILLA": ["ZARUMILLA"], "CONTRALMIRANTE VILLAR": ["ZORRITOS"]}, "MADRE DE DIOS": {"TAMBOPATA": ["INAMBARI", "TAMBOPATA"], "MANU": ["HUEPETUHE"]}, "HUANCAVELICA": {"TAYACAJA": ["DANIEL HERNANDEZ", "PAMPAS"], "ANGARAES": ["LIRCAY"], "HUANCAVELICA": ["HUANCAVELICA"]}, "LORETO": {"ALTO AMAZONAS": ["YURIMAGUAS"]}};

function ubigeoInit() {
  const sel = document.getElementById('f_dpto');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar —</option>';
  Object.keys(UBIGEO_PERU).sort().forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    sel.appendChild(opt);
  });
}

function ubigeoChangeDpto(dpto) {
  const selProv = document.getElementById('f_prov');
  const selDist = document.getElementById('f_distrito');
  selProv.innerHTML = '<option value="">— Seleccionar —</option>';
  selDist.innerHTML = '<option value="">— Seleccionar —</option>';
  if (!dpto || !UBIGEO_PERU[dpto]) return;
  Object.keys(UBIGEO_PERU[dpto]).sort().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    selProv.appendChild(opt);
  });
  // Auto-select if only one province
  if (Object.keys(UBIGEO_PERU[dpto]).length === 1) {
    selProv.selectedIndex = 1;
    ubigeoChangeProv(selProv.value);
  }
}

function ubigeoChangeProv(prov) {
  const selDist = document.getElementById('f_distrito');
  const dpto = document.getElementById('f_dpto').value;
  selDist.innerHTML = '<option value="">— Seleccionar —</option>';
  if (!dpto || !prov || !UBIGEO_PERU[dpto]?.[prov]) return;
  UBIGEO_PERU[dpto][prov].forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    selDist.appendChild(opt);
  });
}

/* ===================== INIT ===================== */
window.onload = async ()=>{
  localStorage.removeItem('bo_baseData');

  await cargarAsesoresBackend();
  await cargarLeadsBackend();
  ubigeoInit();
  poblarSelectAsesorForm();
  poblarSelectMasiva();
  renderFechaTabs();
  renderBase();

  // Refrescar leads cada 15s para ver tipificaciones del vendedor
  setInterval(cargarLeadsBackend, 15000);
  setInterval(syncTipifVendedor, 15000);

  document.getElementById('modal-rotar')?.addEventListener('click',e=>{
    if(e.target===document.getElementById('modal-rotar')) cerrarModalRotar();
  });

  const u = ncGetSesion();
  if(u){
    const el = document.querySelector('.bo-usuario');
    if(el) el.textContent = u.nombre || 'Back Office';
  }
  const btnSalir = document.querySelector('.bo-salir');
  if(btnSalir) btnSalir.onclick = (e)=>{ e.preventDefault(); ncCerrarSesion(); };
};