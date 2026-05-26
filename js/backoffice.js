/* ================================================
   BACKOFFICE.JS — Conectado a Node.js backend
   ================================================ */
const API_BO = 'http://127.0.0.1:3000/api';

const COLORES_AV = ["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899"];
const DOT_COLORS = ['#185FA5','#0F6E56','#854F0B','#7C3AED','#DC2626'];

let asesores    = [];
let baseVendedor = {};

function fechaHoy()  { return new Date().toISOString().split('T')[0]; }
function horaAhora() { return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }
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

/* ── Guardar lead en backend ── */
async function guardarLeadBackend(lead) {
  try {
    const res  = await fetch(API_BO + '/leads', {
      method:  'POST',
      headers: ncHeaders(),
      body:    JSON.stringify(lead),
    });
    const data = await res.json();
    return data.ok;
  } catch(e) { return false; }
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
  if(actualizado > 0){ renderBase(); mostrarToast(`🔄 ${actualizado} tipificaciones actualizadas`); }
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
  if(!f){ mostrarToast('⚠️ Selecciona una fecha primero'); return; }
  if(!fechaPestanas.includes(f)){
    fechaPestanas.push(f);
    fechaPestanas.sort().reverse();
    if(!baseData[f]) baseData[f] = [];
    mostrarToast('✅ Fecha ' + formatFecha(f) + ' agregada');
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
  if(!n1){ document.getElementById('f_n1').classList.add('obligatorio-error'); mostrarToast('⚠️ El campo N1 es obligatorio'); return; }
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
    historial: asesor ? [{asesor, hora, fecha:fechaActiva, motivo:'Asignación inicial'}] : []
  };
  baseData[fechaActiva].unshift(reg);

  // Guardar en backend y guardar el id devuelto
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

  if(asesor) historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana,asesor,n1,n2:n2||'—',tipif:tipifBack||'—',accion:'Asignación inicial'});
  limpiarFormBase(); renderFechaTabs(); renderBase();
  mostrarToast(`✅ N1: ${n1} agregado${asesor?' → '+asesor:''}${tipAuto?' · Tipif.: '+tipAuto.tipif:''}`);
}

function limpiarFormBase(){
  ['f_campana','f_n1','f_n2'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('f_distrito').value='';
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
  const cls = {'CONTESTA':'tipif-contesta','NC':'tipif-nc','SIN COBERTURA':'tipif-sincobert','DERIVADO':'tipif-derivado'}[tipif]||'';
  return `<div style="display:flex;flex-direction:column;gap:2px;"><span class="tipif-auto ${cls}">${tipif}</span>${hora?`<span class="tipif-source">vendedor · ${hora}</span>`:''}</div>`;
}

function actualizarStats(){
  const todos = Object.values(baseData).flat();
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
    const histAbierto = histOpen[r.id] ? 'open' : '';
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
    <tr class="historial-row ${histAbierto}" id="hist-${r.id}">
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
  reg.historial.push({asesor:nuevoAsesor, hora, fecha:fechaHoy(), motivo:'Reasignación directa'});
  historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana:reg.campana,asesor:nuevoAsesor,n1:reg.n1,n2:reg.n2||'—',tipif:reg.tipifBack||'—',accion:'Asignación directa'});

  // Actualizar en backend
  if(reg._backendId){
    await actualizarLeadBackend(reg._backendId, {
      asesor_nombre: nuevoAsesor, hora_asig: hora,
      historial: reg.historial,
    });
  }

  renderFechaTabs(); renderBase();
  mostrarToast(`✅ N1 ${reg.n1} → ${nuevoAsesor} · ${hora}`);
}

function eliminarBase(id){
  for(const f in baseData) baseData[f]=baseData[f].filter(r=>r.id!==id);
  delete histOpen[id];
  renderFechaTabs(); renderBase();
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
  const motivo = document.getElementById('modal-motivo').value.trim()||'Rotación manual';
  if(!nuevoAsesor){ document.getElementById('modal-asesor').style.borderColor='#ef4444'; return; }
  document.getElementById('modal-asesor').style.borderColor='#e5e7eb';
  let reg=null;
  for(const f in baseData){ reg=baseData[f].find(r=>r.id===rotandoId); if(reg) break; }
  if(!reg) return;
  const anterior=reg.asesor, hora=horaAhora();
  reg.asesor=nuevoAsesor; reg.horaAsig=hora; reg.sinAsignar=false; reg.rotaciones+=1;
  reg.historial.push({asesor:nuevoAsesor,hora,fecha:fechaHoy(),motivo});
  histOpen[rotandoId]=true;
  historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana:reg.campana,asesor:nuevoAsesor,n1:reg.n1,n2:reg.n2||'—',tipif:reg.tipifBack||'—',accion:`Rotación desde ${anterior}`});

  if(reg._backendId){
    await actualizarLeadBackend(reg._backendId, {
      asesor_nombre: nuevoAsesor, hora_asig: hora,
      historial: reg.historial, sumarRotacion: true,
    });
  }

  cerrarModalRotar(); renderFechaTabs(); renderBase();
  mostrarToast(`🔄 Rotado: ${anterior} → ${nuevoAsesor} · ${hora}`);
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
  const tipo    = document.getElementById('rendFiltroTipo')?.value||'mes';
  const mesActual = new Date().toISOString().slice(0,7);
  const diaFiltro = document.getElementById('rendFiltroFecha')?.value||fechaHoy();
  const desde   = document.getElementById('rendFiltroDesde')?.value||'';
  const hasta   = document.getElementById('rendFiltroHasta')?.value||'';
  const orden   = document.getElementById('rendOrden')?.value||'ventas_desc';

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
    const contesta = miRegs.filter(r=>r._tipifVend==='CONTESTA').length;
    const nc       = miRegs.filter(r=>r._tipifVend==='NC').length;
    const ventas   = miRegs.filter(r=>(r.tipifBack||'').toUpperCase().includes('VENTA')).length;
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
  if(kpis) kpis.innerHTML=[['Total Leads',totLeads],['Total Ventas',totVentas],['Conversión',totConv+'%'],['Asesores',asesores.length]]
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

/* ===================== ROTACIÓN MASIVA ===================== */
const ahoraNow = new Date();
function hace(h,m=0){ const d=new Date(ahoraNow); d.setHours(d.getHours()-h); d.setMinutes(d.getMinutes()-m); return d; }

function buildRotLeads(){
  const lista=[];
  fechaPestanas.forEach(fecha=>{
    (baseData[fecha]||[]).forEach(reg=>{
      if(!reg.asesor) return;
      let ultimaAsig = new Date(fecha+'T'+(reg.horaAsig||'08:00')+':00');
      if(isNaN(ultimaAsig)) ultimaAsig = hace(24);
      lista.push({ id:reg.id, nombre:reg.n1, campana:reg.campana, tel:reg.n1, n2:reg.n2||'', estado:reg.tipifBack||'Nuevo', asesor:reg.asesor, ultimaAsig, fecha, histAsesores:reg.historial?reg.historial.map(h=>h.asesor):[reg.asesor], _reg:reg });
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
  const estadoOk=['Buzón','No contesta','Nuevo','BUZON','NO CONTESTA',''].includes(lead.estado);
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
      <td class="${tiempo?'timer-ok':'timer-fail'}">${rotTxt(l.ultimaAsig)} ${tiempo?'✅':'⏳ falta '+(120-mins)+'min'}</td>
      <td>${!rotAsesor?'—':sinRepetir?'<span class="check-ok">✓ OK</span>':'<span class="check-fail">✗ Ya tuvo</span>'}</td>
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
  if(checked){ if(rotSel.size>=cant){mostrarToast('⚠️ Máximo '+cant+' leads');rotRenderTabla();return;} rotSel.add(id); } else rotSel.delete(id);
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
  if(rotSel.size===0){ mostrarToast('❌ No hay leads aptos para '+rotAsesor); return; }
  const btn=document.getElementById('rotBtnRotar'); btn.disabled=true; btn.textContent='Rotando...';
  let p=0;
  const iv=setInterval(()=>{
    p+=25; document.getElementById('rotProgress').style.width=p+'%';
    if(p>=100){ clearInterval(iv); rotFinalizar(); btn.textContent='Rotar ahora'; btn.disabled=false; }
  },200);
}
async function rotFinalizar(){
  const hora=new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
  const allLeads=buildRotLeads();
  const rotados=allLeads.filter(l=>rotSel.has(l.id));
  for(const l of rotados){
    const reg=l._reg;
    reg.asesor=rotAsesor; reg.horaAsig=hora; reg.sinAsignar=false;
    reg.rotaciones=(reg.rotaciones||0)+1;
    reg.historial.push({asesor:rotAsesor,hora,fecha:fechaHoy(),motivo:'Rotación masiva'});
    historialGlobal.unshift({fecha:new Date().toLocaleString('es-PE'),campana:reg.campana,asesor:rotAsesor,n1:reg.n1,n2:reg.n2||'—',tipif:reg.tipifBack||'—',accion:`Rotación masiva`});
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
  mostrarToast(`✅ ${rotados.length} leads rotados a ${rotAsesor}`);
}

function toggleRotacion(){
  const panel=document.getElementById('panelRotacion');
  const btn=document.getElementById('btnRotToggle');
  const abierto=panel.style.display!=='none';
  panel.style.display=abierto?'none':'';
  btn.classList.toggle('abierto',!abierto);
  if(!abierto){ rotRenderAsesores(); rotRenderTabla(); }
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

function previsualizarMasiva(){
  const raw=document.getElementById('masivaNums').value.trim();
  if(!raw){ mostrarToast('⚠️ Pega números primero'); return; }
  const nums=raw.split(/[\n,;]+/).map(n=>n.trim().replace(/\s+/g,'')).filter(n=>n.length>=7);
  if(!nums.length){ mostrarToast('⚠️ No se encontraron números válidos'); return; }
  const lote=parseInt(document.getElementById('masivaLote').value)||10;
  const lista=lote>0?nums.slice(0,lote):nums;
  const campana=document.getElementById('masivacamp').value.trim()||'—';
  const asesor=document.getElementById('masivaasesor').value;
  const tbody=document.getElementById('masivaPreviewBody');
  tbody.innerHTML=lista.map((n,i)=>`<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:5px 10px;color:#9ca3af">${i+1}</td><td style="padding:5px 10px;font-family:monospace;font-weight:600">${n}</td><td style="padding:5px 10px;color:#374151">${campana}</td><td style="padding:5px 10px;color:#374151">${formatFecha(fechaActiva)}</td><td style="padding:5px 10px;color:#374151">${asesor||'Sin asignar'}</td></tr>`).join('');
  document.getElementById('masivaPreview').style.display='';
  document.getElementById('masivaStatus').textContent=`${lista.length} de ${nums.length} números listos`;
  document.getElementById('btnCargaMasiva').disabled=false;
  document.getElementById('btnCargaMasiva').textContent=`Cargar ${lista.length} registros`;
}

async function ejecutarCargaMasiva(){
  const raw=document.getElementById('masivaNums').value.trim();
  const nums=raw.split(/[\n,;]+/).map(n=>n.trim().replace(/\s+/g,'')).filter(n=>n.length>=7);
  const lote=parseInt(document.getElementById('masivaLote').value)||10;
  const lista=lote>0?nums.slice(0,lote):nums;
  const campana=document.getElementById('masivacamp').value.trim()||'—';
  const asesor=document.getElementById('masivaasesor').value;
  const hora=asesor?horaAhora():'';
  if(!baseData[fechaActiva]) baseData[fechaActiva]=[];

  // Preparar lote para backend
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

  // Enviar al backend en lote y guardar _backendIds
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
  document.getElementById('masivaStatus').textContent='';
  renderFechaTabs(); renderBase();
  mostrarToast(`✅ ${importados} registros cargados${asesor?' → '+asesor:''}`);
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
    if(!lineas.length){ st.textContent='Archivo vacío'; return; }
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
    if(!archivoRows.length){ st.textContent='No se encontraron registros válidos'; return; }
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
  if(!archivoRows.length){ mostrarToast('⚠️ No hay datos'); return; }
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
  mostrarToast(`✅ ${importados} importados${omitidos?' · '+omitidos+' omitidos':''}`);
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
    if(!lineas.length){ st.textContent='Archivo vacío'; return; }
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
    if(!legacyRows.length){ st.textContent='No se encontraron filas válidas'; return; }
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
  if(!legacyRows.length){ mostrarToast('⚠️ No hay datos'); return; }
  let importados=0,omitidos=0,nuevasFechas=0;
  const leadsBackend=[];
  legacyRows.forEach(r=>{
    const fecha=r.fecha;
    if(!fechaPestanas.includes(fecha)){ fechaPestanas.push(fecha); fechaPestanas.sort().reverse(); if(!baseData[fecha]) baseData[fecha]=[]; nuevasFechas++; }
    if(!baseData[fecha]) baseData[fecha]=[];
    if(baseData[fecha].find(x=>x.n1===r.n1)){ omitidos++; return; }
    const hist=r.asesores.map((a,i)=>({asesor:a,hora:r.hora||'—',fecha,motivo:i===0?'Asignación inicial':`Rotación ${i}`}));
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
  mostrarToast(`✅ ${importados} importados${nuevasFechas?' · '+nuevasFechas+' fechas nuevas':''}${omitidos?' · '+omitidos+' omitidos':''}`);
}

/* ===================== NAVEGACIÓN ===================== */
function mostrarSeccion(id,btn){
  document.querySelectorAll('.bo-seccion').forEach(s=>s.classList.add('hidden'));
  const sec=document.getElementById('sec-'+id); if(sec) sec.classList.remove('hidden');
  document.querySelectorAll('.bo-nav').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(id==='base')        { renderFechaTabs(); renderBase(); }
  if(id==='asesores')    renderAsesoresCards();
  if(id==='rendimiento') renderRendimiento();
}

function syncLocalStorage(){
  try{ localStorage.setItem('bo_baseData', JSON.stringify(baseData)); }catch(e){}
}

/* ===================== INIT ===================== */
window.onload = async ()=>{
  await cargarAsesoresBackend();
  poblarSelectAsesorForm();
  poblarSelectMasiva();
  renderFechaTabs();
  renderBase();
  setInterval(syncTipifVendedor, 30000);
  document.getElementById('modal-rotar')?.addEventListener('click',e=>{if(e.target===document.getElementById('modal-rotar'))cerrarModalRotar();});

  // Aplicar sesión en topbar
  const u = ncGetSesion();
  if(u){
    const el = document.querySelector('.bo-usuario');
    if(el) el.textContent = u.nombre || 'Back Office';
  }
  const btnSalir = document.querySelector('.bo-salir');
  if(btnSalir) btnSalir.onclick = (e)=>{ e.preventDefault(); ncCerrarSesion(); };
};