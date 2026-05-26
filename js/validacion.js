/* ================================================
   VALIDACION.JS — Módulo de Validación Netcontact
   ================================================ */

/* ===================== ESTADOS ===================== */
const ESTADOS = [
  { id:'venta',      label:'VENTA',      cls:'be-venta' },
  { id:'validado',   label:'VALIDADO',   cls:'be-validado' },
  { id:'instalado',  label:'INSTALADO',  cls:'be-instalado' },
  { id:'programado', label:'PROGRAMADO', cls:'be-programado' },
  { id:'caida',      label:'CAÍDA',      cls:'be-caida' },
  { id:'observado',  label:'OBSERVADO',  cls:'be-observado' },
  { id:'pendiente',  label:'PENDIENTE',  cls:'be-pendiente' },
];

const TIPO_VENTA   = ['VENTA HOGAR','VENTA EMPRESAS','PORTABILIDAD'];
const TECNOLOGIAS  = ['HFC','FTTH','HFC+FTTH'];
const PAQUETES     = ['150 MBPS S/65.00','400 MBPS S/94.00','400 MBPS S/170.00','1500 MBPS S/200.00','PROMO 39.50'];
const CLARO_HOGAR  = ['1 PLAY','2 PLAY - INTERNET + TV','2 PLAY - INTERNET + TELÉFONO','3 PLAY'];
const CANALES      = ['ECOMMERCE','CALL CENTER','CAMPO','REFERIDOS','TELEMERCADEO'];
const RELACION_PREDIO = ['PROPIETARIO','INQUILINO','FAMILIAR','OTRO'];
const CUOTAS_INST  = ['S/.0 SOLES','S/.100 SOLES','S/.200 SOLES'];

/* ===================== ESTADO GLOBAL ===================== */
let ventas        = [];   // todos los registros
let ventasFiltradas = []; // después de aplicar filtros
let ventasIdCnt   = 1;
let paginaActual  = 1;
let porPagina     = 18;
let editandoId    = null;
let busquedaVal   = '';
let usuarioActual = 'Validador';

/* ===================== UTILS ===================== */
function fechaHoy() { return new Date().toISOString().split('T')[0]; }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }
function formatF(f) { if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function estadoObj(id){ return ESTADOS.find(e=>e.id===id) || ESTADOS[0]; }
function badgeEstado(id, vId){
  const e = estadoObj(id);
  return `<span class="badge-estado ${e.cls}" onclick="abrirModalEstado(${vId})" title="Click para cambiar estado">${e.label}</span>`;
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3000);
}
function poblarSelect(id, opts, vacio='— Seleccionar —'){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML=`<option value="">${vacio}</option>`+opts.map(o=>`<option value="${o}">${o}</option>`).join('');
}
const API_VAL = 'http://localhost:3000/api';

async function syncLocalStorage() {
  /* En producción — ya no se usa localStorage */
}

async function loadFromStorage() {
  try {
    const res  = await fetch(API_VAL + '/ventas', { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data.map(v => ({
        ...v,
        id:            v.id,
        estado:        v.estado || 'venta',
        fechaIngreso:  v.created_at ? v.created_at.split(' ')[0] : '',
        horaIngreso:   v.created_at ? v.created_at.split(' ')[1] || '' : '',
        nombreApellidos: v.nombre || '',
        dniDocumento:    v.dni    || '',
        telefonoContacto: v.telefono1 || '',
        obsBackOffice:   v.obs_backoffice || '',
        paquete:         v.paquete || '',
      }));
      ventasIdCnt = ventas.length ? Math.max(...ventas.map(v=>v.id||0)) + 1 : 1;
    }
  } catch(e) { console.error('Error cargando ventas:', e); }
}

/* ===================== KPIs ===================== */
function actualizarKpis(){
  const total      = ventas.length;
  const validados  = ventas.filter(v=>v.estado==='validado'||v.estado==='instalado'||v.estado==='programado').length;
  const noValidados= total - validados;

  document.getElementById('kpi-total').textContent      = total;
  document.getElementById('kpi-validados').textContent  = validados;
  document.getElementById('kpi-novalidados').textContent= noValidados;
}

/* ===================== FILTROS ===================== */
function getValFiltro(id){ const e=document.getElementById(id); return e?e.value.trim():''; }

function aplicarFiltros(){
  const fEstado   = getValFiltro('f_estado');
  const fAsesor   = getValFiltro('f_asesor').toLowerCase();
  const fDesde    = getValFiltro('f_desde');
  const fHasta    = getValFiltro('f_hasta');
  const fCanal    = getValFiltro('f_canal');
  const fSuperv   = getValFiltro('f_supervisor').toLowerCase();

  ventasFiltradas = ventas.filter(v=>{
    if(fEstado && v.estado !== fEstado)                                    return false;
    if(fAsesor && !(v.vendedor||'').toLowerCase().includes(fAsesor))       return false;
    if(fDesde  && v.fechaIngreso < fDesde)                                 return false;
    if(fHasta  && v.fechaIngreso > fHasta)                                 return false;
    if(fCanal  && v.canal !== fCanal)                                      return false;
    if(fSuperv && !(v.supervisor||'').toLowerCase().includes(fSuperv))     return false;
    if(busquedaVal){
      const b = busquedaVal.toLowerCase();
      const campos = [v.nombreApellidos,v.dni,v.telefonoContacto,v.vendedor,v.distrito,v.campana].map(x=>(x||'').toLowerCase());
      if(!campos.some(c=>c.includes(b))) return false;
    }
    return true;
  });

  // Ordenar: más reciente primero
  ventasFiltradas.sort((a,b)=>(b.fechaIngreso+b.horaIngreso||'').localeCompare(a.fechaIngreso+a.horaIngreso||''));

  paginaActual = 1;
  renderTabla();
  actualizarKpis();
}

function limpiarFiltros(){
  ['f_estado','f_asesor','f_desde','f_hasta','f_canal','f_supervisor'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.value='';
  });
  busquedaVal='';
  const bs=document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

/* ===================== RENDER TABLA ===================== */
function renderTabla(){
  const tbody  = document.getElementById('tablaBody');
  const total  = ventasFiltradas.length;
  const inicio = (paginaActual-1)*porPagina;
  const fin    = Math.min(inicio+porPagina, total);
  const pagina = ventasFiltradas.slice(inicio, fin);

  // Contador
  document.getElementById('tablaCount').textContent = `${total} registros`;
  document.getElementById('pagInfo').textContent    = `Mostrando ${inicio+1}–${fin} de ${total}`;

  if(!pagina.length){
    tbody.innerHTML=`<tr class="tabla-empty"><td colspan="26">
      <div style="font-size:28px;margin-bottom:8px;">📋</div>
      Sin registros. Agrega ventas o cambia los filtros.
    </td></tr>`;
    renderPaginacion(total);
    return;
  }

  tbody.innerHTML = pagina.map(v=>{
    const e = estadoObj(v.estado);
    return `<tr id="fila-${v.id}">
      <td style="text-align:center;vertical-align:middle;">
        <div class="acciones-cell">
          <button class="btn-accion-row btn-editar" onclick="abrirModalEditar(${v.id})" title="Editar registro">✏️</button>
          <button class="btn-accion-row btn-obs"    onclick="abrirModalObs(${v.id})"    title="Agregar observación">💬</button>
        </div>
      </td>
      <td style="vertical-align:middle">${badgeEstado(v.estado, v.id)}</td>
      <td class="td-wrap td-obs-bo">${v.obsBackOffice||'—'}</td>
      <td>${v.tipoVenta||'—'}</td>
      <td style="color:#185FA5;font-weight:700;font-family:monospace;font-size:10px;white-space:nowrap">${formatF(v.fechaIngreso)}<br><span style="color:#9ca3af;font-weight:400">${v.horaIngreso||''}</span></td>
      <td style="font-weight:600">${v.nombreApellidos||'—'}</td>
      <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
      <td style="font-size:11px">${v.nombreRepresentante||'—'}</td>
      <td style="font-family:monospace;color:#185FA5;font-weight:700">${v.telefonoContacto||'—'}</td>
      <td style="font-family:monospace;color:#6b7280">${v.telefonoReferencia||'—'}</td>
      <td style="font-size:10px;color:#374151">${v.email||'—'}</td>
      <td>${v.departamento||'—'}</td>
      <td>${v.provincia||'—'}</td>
      <td style="font-weight:600">${v.distrito||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.direccion||'—'}</td>
      <td style="font-size:10px;color:#6b7280">${v.coordenadas||'—'}</td>
      <td>${v.tipoDomicilio||'—'}</td>
      <td>${v.relacionPredio||'—'}</td>
      <td>${v.cuotasInstalacion||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.claroHogar||'—'}</td>
      <td>${v.tecnologia||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.paquete||'—'}</td>
      <td style="text-align:center">${v.fullClaro||'—'}</td>
      <td style="text-align:center">${v.cantDecos??'—'}</td>
      <td style="text-align:center">${v.cantMesh??'—'}</td>
      <td>${v.cuotaMesh||'—'}</td>
      <td>${v.plano||'—'}</td>
      <td class="td-wrap td-audit" style="font-size:10px;background:#f8f9fa;border-left:3px solid #e5e7eb;">${v.observacion||'—'}</td>
      <td style="font-weight:600;color:#7C3AED">${v.vendedor||'—'}</td>
      <td style="font-size:11px;color:#6b7280">${v.supervisor||'—'}</td>
      <td>${v.canal||'—'}</td>
      <td class="td-audit" style="font-weight:700;color:#7C3AED;background:#f5f3ff;border-left:3px solid #ede9fe;">${v.userModifica||'—'}</td>
      <td class="td-audit" style="font-size:10px;background:#f5f3ff;white-space:nowrap">${v.fechaModifica?'<span style="color:#374151;font-weight:600">'+formatF(v.fechaModifica)+'</span> <span style="color:#9ca3af">'+v.horaModifica+'</span>':'—'}</td>
    </tr>`;
  }).join('');

  renderPaginacion(total);
}

/* ===================== PAGINACIÓN ===================== */
function renderPaginacion(total){
  const totalPags = Math.max(1, Math.ceil(total/porPagina));
  const cont = document.getElementById('paginacionBtns');

  let html = `<button class="pag-btn" onclick="irPagina(${paginaActual-1})" ${paginaActual===1?'disabled':''}>‹</button>`;

  // Mostrar máx 7 páginas
  let inicio = Math.max(1, paginaActual-3);
  let fin    = Math.min(totalPags, inicio+6);
  if(fin-inicio<6) inicio = Math.max(1, fin-6);

  if(inicio>1) html+=`<button class="pag-btn" onclick="irPagina(1)">1</button>${inicio>2?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}`;
  for(let i=inicio;i<=fin;i++)
    html+=`<button class="pag-btn ${i===paginaActual?'active':''}" onclick="irPagina(${i})">${i}</button>`;
  if(fin<totalPags) html+=`${fin<totalPags-1?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}<button class="pag-btn" onclick="irPagina(${totalPags})">${totalPags}</button>`;

  html+=`<button class="pag-btn" onclick="irPagina(${paginaActual+1})" ${paginaActual===totalPags?'disabled':''}>›</button>`;
  cont.innerHTML = html;
}

function irPagina(p){
  const total = ventasFiltradas.length;
  const totalPags = Math.ceil(total/porPagina)||1;
  paginaActual = Math.max(1, Math.min(p, totalPags));
  renderTabla();
  document.querySelector('.tabla-scroll')?.scrollTo(0,0);
}

/* ===================== MODAL EDITAR ===================== */
function abrirModalEditar(id){
  const v = ventas.find(x=>x.id===id);
  if(!v) return;
  editandoId = id;

  const campos = {
    'e_nombreApellidos':    v.nombreApellidos,
    'e_dni':                v.dni,
    'e_nombreRepresentante':v.nombreRepresentante,
    'e_email':              v.email,
    'e_telefonoContacto':   v.telefonoContacto,
    'e_telefonoReferencia': v.telefonoReferencia,
    'e_departamento':       v.departamento,
    'e_provincia':          v.provincia,
    'e_distrito':           v.distrito,
    'e_direccion':          v.direccion,
    'e_coordenadas':        v.coordenadas,
    'e_tipoVenta':          v.tipoVenta,
    'e_tipoDomicilio':      v.tipoDomicilio,
    'e_relacionPredio':     v.relacionPredio,
    'e_cuotasInstalacion':  v.cuotasInstalacion,
    'e_claroHogar':         v.claroHogar,
    'e_tecnologia':         v.tecnologia,
    'e_paquete':            v.paquete,
    'e_fullClaro':          v.fullClaro,
    'e_cantDecos':          v.cantDecos,
    'e_cantMesh':           v.cantMesh,
    'e_cuotaMesh':          v.cuotaMesh,
    'e_plano':              v.plano,
    'e_estado':             v.estado,
    'e_vendedor':           v.vendedor,
    'e_supervisor':         v.supervisor,
    'e_canal':              v.canal,
    'e_obsBackOffice':      v.obsBackOffice,
    'e_observacion':        v.observacion,
  };
  for(const [id, val] of Object.entries(campos)){
    const el=document.getElementById(id);
    if(el) el.value = val||'';
  }
  document.getElementById('modalEditarTitulo').textContent = `Editar — N°${id} · ${v.nombreApellidos||'Sin nombre'}`;
  document.getElementById('modalEditar').classList.add('open');
}

function guardarEdicion(){
  const v = ventas.find(x=>x.id===editandoId);
  if(!v) return;

  const campos = ['nombreApellidos','dni','nombreRepresentante','email','telefonoContacto',
    'telefonoReferencia','departamento','provincia','distrito','direccion','coordenadas',
    'tipoVenta','tipoDomicilio','relacionPredio','cuotasInstalacion','claroHogar',
    'tecnologia','paquete','fullClaro','cantDecos','cantMesh','cuotaMesh','plano',
    'estado','vendedor','supervisor','canal','obsBackOffice','observacion'];

  campos.forEach(c=>{
    const el=document.getElementById('e_'+c);
    if(el) v[c] = el.value;
  });

  v.userModifica  = usuarioActual;
  v.fechaModifica = fechaHoy();
  v.horaModifica  = horaAhora();

  syncLocalStorage();
  cerrarModal('modalEditar');
  aplicarFiltros();
  toast(`✅ Registro actualizado · ${v.nombreApellidos||'ID '+editandoId}`);
}

/* ===================== MODAL ESTADO RÁPIDO ===================== */
function abrirModalEstado(id){
  const v = ventas.find(x=>x.id===id);
  if(!v) return;
  editandoId = id;
  document.getElementById('re_estadoActual').textContent = estadoObj(v.estado).label;
  document.getElementById('re_nuevoEstado').value = v.estado;
  document.getElementById('modalEstado').classList.add('open');
}

function guardarEstado(){
  const v = ventas.find(x=>x.id===editandoId);
  if(!v) return;
  const nuevo = document.getElementById('re_nuevoEstado').value;
  if(!nuevo) return;
  const anterior = v.estado;
  v.estado        = nuevo;
  v.userModifica  = usuarioActual;
  v.fechaModifica = fechaHoy();
  v.horaModifica  = horaAhora();
  syncLocalStorage();
  cerrarModal('modalEstado');
  aplicarFiltros();
  toast(`🔄 Estado: ${estadoObj(anterior).label} → ${estadoObj(nuevo).label}`);
}

/* ===================== MODAL OBSERVACIÓN ===================== */
function abrirModalObs(id){
  const v = ventas.find(x=>x.id===id);
  if(!v) return;
  editandoId = id;
  document.getElementById('obs_nombre').textContent    = v.nombreApellidos||'—';
  document.getElementById('obs_historial').textContent = v.observacion||'Sin observaciones previas.';
  document.getElementById('obs_nueva').value = '';
  document.getElementById('modalObs').classList.add('open');
}

function guardarObservacion(){
  const v = ventas.find(x=>x.id===editandoId);
  if(!v) return;
  const nueva = document.getElementById('obs_nueva').value.trim();
  if(!nueva){ toast('⚠️ Escribe una observación'); return; }
  const prev = v.observacion ? v.observacion+'\n' : '';
  v.observacion   = prev + `[${formatF(fechaHoy())} ${horaAhora()} - ${usuarioActual}] ${nueva}`;
  v.userModifica  = usuarioActual;
  v.fechaModifica = fechaHoy();
  v.horaModifica  = horaAhora();
  syncLocalStorage();
  cerrarModal('modalObs');
  aplicarFiltros();
  toast('✅ Observación guardada');
}



/* ================================================
   VALIDACION.JS — Módulo de Validación Netcontact
   ================================================ */

/* ===================== ESTADOS ===================== */
const ESTADOS = [
  { id:'venta',      label:'VENTA',      cls:'be-venta' },
  { id:'validado',   label:'VALIDADO',   cls:'be-validado' },
  { id:'instalado',  label:'INSTALADO',  cls:'be-instalado' },
  { id:'programado', label:'PROGRAMADO', cls:'be-programado' },
  { id:'caida',      label:'CAÍDA',      cls:'be-caida' },
  { id:'observado',  label:'OBSERVADO',  cls:'be-observado' },
  { id:'pendiente',  label:'PENDIENTE',  cls:'be-pendiente' },
];

const TIPO_VENTA   = ['VENTA HOGAR','VENTA EMPRESAS','PORTABILIDAD'];
const TECNOLOGIAS  = ['HFC','FTTH','HFC+FTTH'];
const PAQUETES     = ['150 MBPS S/65.00','400 MBPS S/94.00','400 MBPS S/170.00','1500 MBPS S/200.00','PROMO 39.50'];
const CLARO_HOGAR  = ['1 PLAY','2 PLAY - INTERNET + TV','2 PLAY - INTERNET + TELÉFONO','3 PLAY'];
const CANALES      = ['ECOMMERCE','CALL CENTER','CAMPO','REFERIDOS','TELEMERCADEO'];
const RELACION_PREDIO = ['PROPIETARIO','INQUILINO','FAMILIAR','OTRO'];
const CUOTAS_INST  = ['S/.0 SOLES','S/.100 SOLES','S/.200 SOLES'];

/* ===================== ESTADO GLOBAL ===================== */
let ventas        = [];   // todos los registros
let ventasFiltradas = []; // después de aplicar filtros
let ventasIdCnt   = 1;
let paginaActual  = 1;
let porPagina     = 18;
let editandoId    = null;
let busquedaVal   = '';
let usuarioActual = 'Validador';

/* ===================== UTILS ===================== */
function fechaHoy() { return new Date().toISOString().split('T')[0]; }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }
function formatF(f) { if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function estadoObj(id){ return ESTADOS.find(e=>e.id===id) || ESTADOS[0]; }
function badgeEstado(id, vId){
  const e = estadoObj(id);
  return `<span class="badge-estado ${e.cls}" onclick="abrirModalEstado(${vId})" title="Click para cambiar estado">${e.label}</span>`;
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3000);
}
function poblarSelect(id, opts, vacio='— Seleccionar —'){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML=`<option value="">${vacio}</option>`+opts.map(o=>`<option value="${o}">${o}</option>`).join('');
}
const API_VAL = 'http://localhost:3000/api';

async function syncLocalStorage() {
  /* En producción — ya no se usa localStorage */
}

async function loadFromStorage() {
  try {
    const res  = await fetch(API_VAL + '/ventas', { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data.map(v => ({
        ...v,
        id:            v.id,
        estado:        v.estado || 'venta',
        fechaIngreso:  v.created_at ? v.created_at.split(' ')[0] : '',
        horaIngreso:   v.created_at ? v.created_at.split(' ')[1] || '' : '',
        nombreApellidos: v.nombre || '',
        dniDocumento:    v.dni    || '',
        telefonoContacto: v.telefono1 || '',
        obsBackOffice:   v.obs_backoffice || '',
        paquete:         v.paquete || '',
      }));
      ventasIdCnt = ventas.length ? Math.max(...ventas.map(v=>v.id||0)) + 1 : 1;
    }
  } catch(e) { console.error('Error cargando ventas:', e); }
}

/* ===================== KPIs ===================== */
function actualizarKpis(){
  const total      = ventas.length;
  const validados  = ventas.filter(v=>v.estado==='validado'||v.estado==='instalado'||v.estado==='programado').length;
  const noValidados= total - validados;

  document.getElementById('kpi-total').textContent      = total;
  document.getElementById('kpi-validados').textContent  = validados;
  document.getElementById('kpi-novalidados').textContent= noValidados;
}

/* ===================== FILTROS ===================== */
function getValFiltro(id){ const e=document.getElementById(id); return e?e.value.trim():''; }

function aplicarFiltros(){
  const fEstado   = getValFiltro('f_estado');
  const fAsesor   = getValFiltro('f_asesor').toLowerCase();
  const fDesde    = getValFiltro('f_desde');
  const fHasta    = getValFiltro('f_hasta');
  const fCanal    = getValFiltro('f_canal');
  const fSuperv   = getValFiltro('f_supervisor').toLowerCase();

  ventasFiltradas = ventas.filter(v=>{
    if(fEstado && v.estado !== fEstado)                                    return false;
    if(fAsesor && !(v.vendedor||'').toLowerCase().includes(fAsesor))       return false;
    if(fDesde  && v.fechaIngreso < fDesde)                                 return false;
    if(fHasta  && v.fechaIngreso > fHasta)                                 return false;
    if(fCanal  && v.canal !== fCanal)                                      return false;
    if(fSuperv && !(v.supervisor||'').toLowerCase().includes(fSuperv))     return false;
    if(busquedaVal){
      const b = busquedaVal.toLowerCase();
      const campos = [v.nombreApellidos,v.dni,v.telefonoContacto,v.vendedor,v.distrito,v.campana].map(x=>(x||'').toLowerCase());
      if(!campos.some(c=>c.includes(b))) return false;
    }
    return true;
  });

  // Ordenar: más reciente primero
  ventasFiltradas.sort((a,b)=>(b.fechaIngreso+b.horaIngreso||'').localeCompare(a.fechaIngreso+a.horaIngreso||''));

  paginaActual = 1;
  renderTabla();
  actualizarKpis();
}

function limpiarFiltros(){
  ['f_estado','f_asesor','f_desde','f_hasta','f_canal','f_supervisor'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.value='';
  });
  busquedaVal='';
  const bs=document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

/* ===================== RENDER TABLA ===================== */
function renderTabla(){
  const tbody  = document.getElementById('tablaBody');
  const total  = ventasFiltradas.length;
  const inicio = (paginaActual-1)*porPagina;
  const fin    = Math.min(inicio+porPagina, total);
  const pagina = ventasFiltradas.slice(inicio, fin);

  // Contador
  document.getElementById('tablaCount').textContent = `${total} registros`;
  document.getElementById('pagInfo').textContent    = `Mostrando ${inicio+1}–${fin} de ${total}`;

  if(!pagina.length){
    tbody.innerHTML=`<tr class="tabla-empty"><td colspan="26">
      <div style="font-size:28px;margin-bottom:8px;">📋</div>
      Sin registros. Agrega ventas o cambia los filtros.
    </td></tr>`;
    renderPaginacion(total);
    return;
  }

  tbody.innerHTML = pagina.map(v=>{
    const e = estadoObj(v.estado);
    return `<tr id="fila-${v.id}">
      <td style="text-align:center;vertical-align:middle;">
        <div class="acciones-cell">
          <button class="btn-accion-row btn-editar" onclick="abrirModalEditar(${v.id})" title="Editar registro">✏️</button>
          <button class="btn-accion-row btn-obs"    onclick="abrirModalObs(${v.id})"    title="Agregar observación">💬</button>
          <button class="btn-accion-row" style="border-color:#c4b5fd;background:#faf5ff;" onclick="hAbrir(${v.id},{nombre:'${(v.nombreApellidos||'').replace(/'/g,'')}'.substring(0,30),dni:'${v.dni||''}',n1:'${v.telefonoContacto||''}'})" title="Historial de cambios">📋</button>
        </div>
      </td>
      <td style="vertical-align:middle">${badgeEstado(v.estado, v.id)}</td>
      <td class="td-wrap td-obs-bo">${v.obsBackOffice||'—'}</td>
      <td>${v.tipoVenta||'—'}</td>
      <td style="color:#185FA5;font-weight:700;font-family:monospace;font-size:10px;white-space:nowrap">${formatF(v.fechaIngreso)}<br><span style="color:#9ca3af;font-weight:400">${v.horaIngreso||''}</span></td>
      <td style="font-weight:600">${v.nombreApellidos||'—'}</td>
      <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
      <td style="font-size:11px">${v.nombreRepresentante||'—'}</td>
      <td style="font-family:monospace;color:#185FA5;font-weight:700">${v.telefonoContacto||'—'}</td>
      <td style="font-family:monospace;color:#6b7280">${v.telefonoReferencia||'—'}</td>
      <td style="font-size:10px;color:#374151">${v.email||'—'}</td>
      <td>${v.departamento||'—'}</td>
      <td>${v.provincia||'—'}</td>
      <td style="font-weight:600">${v.distrito||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.direccion||'—'}</td>
      <td style="font-size:10px;color:#6b7280">${v.coordenadas||'—'}</td>
      <td>${v.tipoDomicilio||'—'}</td>
      <td>${v.relacionPredio||'—'}</td>
      <td>${v.cuotasInstalacion||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.claroHogar||'—'}</td>
      <td>${v.tecnologia||'—'}</td>
      <td class="td-wrap" style="font-size:10px">${v.paquete||'—'}</td>
      <td style="text-align:center">${v.fullClaro||'—'}</td>
      <td style="text-align:center">${v.cantDecos??'—'}</td>
      <td style="text-align:center">${v.cantMesh??'—'}</td>
      <td>${v.cuotaMesh||'—'}</td>
      <td>${v.plano||'—'}</td>
      <td class="td-wrap td-audit" style="font-size:10px;background:#f8f9fa;border-left:3px solid #e5e7eb;">${v.observacion||'—'}</td>
      <td style="font-weight:600;color:#7C3AED">${v.vendedor||'—'}</td>
      <td style="font-size:11px;color:#6b7280">${v.supervisor||'—'}</td>
      <td>${v.canal||'—'}</td>
      <td class="td-audit" style="font-weight:700;color:#7C3AED;background:#f5f3ff;border-left:3px solid #ede9fe;">${v.userModifica||'—'}</td>
      <td class="td-audit" style="font-size:10px;background:#f5f3ff;white-space:nowrap">${v.fechaModifica?'<span style="color:#374151;font-weight:600">'+formatF(v.fechaModifica)+'</span> <span style="color:#9ca3af">'+v.horaModifica+'</span>':'—'}</td>
    </tr>`;
  }).join('');

  renderPaginacion(total);
}

/* ===================== PAGINACIÓN ===================== */
function renderPaginacion(total){
  const totalPags = Math.max(1, Math.ceil(total/porPagina));
  const cont = document.getElementById('paginacionBtns');

  let html = `<button class="pag-btn" onclick="irPagina(${paginaActual-1})" ${paginaActual===1?'disabled':''}>‹</button>`;

  // Mostrar máx 7 páginas
  let inicio = Math.max(1, paginaActual-3);
  let fin    = Math.min(totalPags, inicio+6);
  if(fin-inicio<6) inicio = Math.max(1, fin-6);

  if(inicio>1) html+=`<button class="pag-btn" onclick="irPagina(1)">1</button>${inicio>2?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}`;
  for(let i=inicio;i<=fin;i++)
    html+=`<button class="pag-btn ${i===paginaActual?'active':''}" onclick="irPagina(${i})">${i}</button>`;
  if(fin<totalPags) html+=`${fin<totalPags-1?'<span style="padding:0 4px;color:#9ca3af">…</span>':''}<button class="pag-btn" onclick="irPagina(${totalPags})">${totalPags}</button>`;

  html+=`<button class="pag-btn" onclick="irPagina(${paginaActual+1})" ${paginaActual===totalPags?'disabled':''}>›</button>`;
  cont.innerHTML = html;
}

function irPagina(p){
  const total = ventasFiltradas.length;
  const totalPags = Math.ceil(total/porPagina)||1;
  paginaActual = Math.max(1, Math.min(p, totalPags));
  renderTabla();
  document.querySelector('.tabla-scroll')?.scrollTo(0,0);
}

/* ===================== MODAL EDITAR ===================== */
function abrirModalEditar(id){
  const v = ventas.find(x=>x.id===id);
  if(!v) return;
  editandoId = id;

  const campos = {
    'e_nombreApellidos':    v.nombreApellidos,
    'e_dni':                v.dni,
    'e_nombreRepresentante':v.nombreRepresentante,
    'e_email':              v.email,
    'e_telefonoContacto':   v.telefonoContacto,
    'e_telefonoReferencia': v.telefonoReferencia,
    'e_departamento':       v.departamento,
    'e_provincia':          v.provincia,
    'e_distrito':           v.distrito,
    'e_direccion':          v.direccion,
    'e_coordenadas':        v.coordenadas,
    'e_tipoVenta':          v.tipoVenta,
    'e_tipoDomicilio':      v.tipoDomicilio,
    'e_relacionPredio':     v.relacionPredio,
    'e_cuotasInstalacion':  v.cuotasInstalacion,
    'e_claroHogar':         v.claroHogar,
    'e_tecnologia':         v.tecnologia,
    'e_paquete':            v.paquete,
    'e_fullClaro':          v.fullClaro,
    'e_cantDecos':          v.cantDecos,
    'e_cantMesh':           v.cantMesh,
    'e_cuotaMesh':          v.cuotaMesh,
    'e_plano':              v.plano,
    'e_estado':             v.estado,
    'e_vendedor':           v.vendedor,
    'e_supervisor':         v.supervisor,
    'e_canal':              v.canal,
    'e_obsBackOffice':      v.obsBackOffice,
    'e_observacion':        v.observacion,
  };
  for(const [id, val] of Object.entries(campos)){
    const el=document.getElementById(id);
    if(el) el.value = val||'';
  }
  document.getElementById('modalEditarTitulo').textContent = `Editar — N°${id} · ${v.nombreApellidos||'Sin nombre'}`;
  document.getElementById('modalEditar').classList.add('open');
}

function guardarEdicion(){
  const v = ventas.find(x=>x.id===editandoId);
  if(!v) return;
  const estadoAnterior = v.estado;

  const campos = ['nombreApellidos','dni','nombreRepresentante','email','telefonoContacto',
    'telefonoReferencia','departamento','provincia','distrito','direccion','coordenadas',
    'tipoVenta','tipoDomicilio','relacionPredio','cuotasInstalacion','claroHogar',
    'tecnologia','paquete','fullClaro','cantDecos','cantMesh','cuotaMesh','plano',
    'estado','vendedor','supervisor','canal','obsBackOffice','observacion'];

  campos.forEach(c=>{
    const el=document.getElementById('e_'+c);
    if(el) v[c] = el.value;
  });

  // Registrar en historial si cambió el estado
  const nuevoEstado = document.getElementById('e_estado').value;
  if(nuevoEstado && nuevoEstado !== estadoAnterior){
    hRegistrar(v.id, v, 'Estado', estadoAnterior, nuevoEstado, 'Validación');
  }

  v.userModifica  = usuarioActual;
  v.fechaModifica = fechaHoy();
  v.horaModifica  = horaAhora();

  syncLocalStorage();
  cerrarModal('modalEditar');
  aplicarFiltros();
  toast(`✅ Registro actualizado · ${v.nombreApellidos||'ID '+editandoId}`);
}

/* ===================== MODAL ESTADO RÁPIDO ===================== */
function abrirModalEstado(id){
  const v = ventas.find(x=>x.id===id);
  if(!v) return;
  editandoId = id;
  document.getElementById('re_estadoActual').textContent = estadoObj(v.estado).label;
  document.getElementById('re_nuevoEstado').value = v.estado;
  document.getElementById('modalEstado').classList.add('open');
}

function guardarEstado(){
  const v = ventas.find(x=>x.id===editandoId);
  if(!v) return;
  const nuevo = document.getElementById('re_nuevoEstado').value;
  if(!nuevo) return;
  const anterior = v.estado;
  v.estado        = nuevo;
  v.userModifica  = usuarioActual;
  v.fechaModifica = fechaHoy();
  v.horaModifica  = horaAhora();
  hRegistrar(v.id, v, 'Estado', estadoObj(anterior).label, estadoObj(nuevo).label, 'Validación');
  syncLocalStorage();
  cerrarModal('modalEstado');
  aplicarFiltros();
  toast(`🔄 Estado: ${estadoObj(anterior).label} → ${estadoObj(nuevo).label}`);
}

/* ===================== MODAL OBSERVACIÓN ===================== */
function abrirModalObs(id){
  const v = ventas.find(x=>x.id===id);
  if(!v) return;
  editandoId = id;
  document.getElementById('obs_nombre').textContent    = v.nombreApellidos||'—';
  document.getElementById('obs_historial').textContent = v.observacion||'Sin observaciones previas.';
  document.getElementById('obs_nueva').value = '';
  document.getElementById('modalObs').classList.add('open');
}

function guardarObservacion(){
  const v = ventas.find(x=>x.id===editandoId);
  if(!v) return;
  const nueva = document.getElementById('obs_nueva').value.trim();
  if(!nueva){ toast('⚠️ Escribe una observación'); return; }
  const prev = v.observacion ? v.observacion+'\n' : '';
  v.observacion   = prev + `[${formatF(fechaHoy())} ${horaAhora()} - ${usuarioActual}] ${nueva}`;
  v.userModifica  = usuarioActual;
  v.fechaModifica = fechaHoy();
  v.horaModifica  = horaAhora();
  hRegistrar(v.id, v, 'Observación', '—', nueva.substring(0,60), 'Validación');
  syncLocalStorage();
  cerrarModal('modalObs');
  aplicarFiltros();
  toast('✅ Observación guardada');
}





/* ===================== EXPORTAR ===================== */
function exportarExcel(){ toast('📊 Exportación a Excel — próximamente'); }
function exportarPDF()  { toast('📄 Exportación a PDF — próximamente'); }

function exportarCSV(){
  if(!ventasFiltradas.length){ toast('⚠️ Sin datos para exportar'); return; }
  const headers=['Estado','Fecha Ingreso','Nombre y Apellidos','DNI','Tel. Contacto','Vendedor','Supervisor','Canal','Distrito','Provincia','Departamento','Dirección','Estado Venta'];
  const rows = ventasFiltradas.map(v=>[
    estadoObj(v.estado).label, formatF(v.fechaIngreso), v.nombreApellidos||'',
    v.dni||'', v.telefonoContacto||'', v.vendedor||'', v.supervisor||'',
    v.canal||'', v.distrito||'', v.provincia||'', v.departamento||'', v.direccion||''
  ].map(c=>`"${(c+'').replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_${fechaHoy()}.csv`;
  a.click();
  toast('✅ CSV descargado');
}

/* ===================== MODALES UTILS ===================== */
function cerrarModal(id){ document.getElementById(id).classList.remove('open'); editandoId=null; }

/* ===================== INIT ===================== */
window.onload = ()=>{
  // Poblar selects de filtros
  poblarSelect('f_estado',    ESTADOS.map(e=>e.id), 'Todos los estados');
  poblarSelect('f_canal',     CANALES, 'Todos los canales');

  // Poblar selects del modal editar
  poblarSelect('e_tipoVenta',         TIPO_VENTA);
  poblarSelect('e_tecnologia',        TECNOLOGIAS);
  poblarSelect('e_paquete',           PAQUETES);
  poblarSelect('e_claroHogar',        CLARO_HOGAR);
  poblarSelect('e_relacionPredio',    RELACION_PREDIO);
  poblarSelect('e_cuotasInstalacion', CUOTAS_INST);
  poblarSelect('e_canal',             CANALES);
  poblarSelect('e_estado',            ESTADOS.map(e=>e.id));
  poblarSelect('e_fullClaro',         ['Si','No']);

  // Poblar selects de nueva venta
  poblarSelect('nv_estado',            ESTADOS.map(e=>e.id));
  poblarSelect('nv_tipoVenta',         TIPO_VENTA);
  poblarSelect('nv_tecnologia',        TECNOLOGIAS);
  poblarSelect('nv_paquete',           PAQUETES);
  poblarSelect('nv_claroHogar',        CLARO_HOGAR);
  poblarSelect('nv_relacionPredio',    RELACION_PREDIO);
  poblarSelect('nv_cuotasInstalacion', CUOTAS_INST);
  poblarSelect('nv_canal',             CANALES);
  poblarSelect('nv_fullClaro',         ['Si','No']);

  // Poblar labels de estados en el select del modal estado
  const selRE = document.getElementById('re_nuevoEstado');
  if(selRE){
    selRE.innerHTML = ESTADOS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  }
  // Mismo para los selects del modal editar que usan id como valor
  const selEE = document.getElementById('e_estado');
  if(selEE){
    selEE.innerHTML = `<option value="">— Estado —</option>`+ESTADOS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  }

  // Render inicial
  aplicarFiltros();

  // Cerrar modales al hacer click fuera
  ['modalEditar','modalEstado','modalObs'].forEach(id=>{
    document.getElementById(id).addEventListener('click', e=>{
      if(e.target===document.getElementById(id)) cerrarModal(id);
    });
  });

  // Tamaño de página
  document.getElementById('selectPorPagina')?.addEventListener('change', e=>{
    porPagina = parseInt(e.target.value)||18;
    paginaActual = 1;
    renderTabla();
  });
};

/* ===================== EXPORTAR ===================== */
function exportarExcel(){ toast('📊 Exportación a Excel — próximamente'); }
function exportarPDF()  { toast('📄 Exportación a PDF — próximamente'); }

function exportarCSV(){
  if(!ventasFiltradas.length){ toast('⚠️ Sin datos para exportar'); return; }
  const headers=['Estado','Fecha Ingreso','Nombre y Apellidos','DNI','Tel. Contacto','Vendedor','Supervisor','Canal','Distrito','Provincia','Departamento','Dirección','Estado Venta'];
  const rows = ventasFiltradas.map(v=>[
    estadoObj(v.estado).label, formatF(v.fechaIngreso), v.nombreApellidos||'',
    v.dni||'', v.telefonoContacto||'', v.vendedor||'', v.supervisor||'',
    v.canal||'', v.distrito||'', v.provincia||'', v.departamento||'', v.direccion||''
  ].map(c=>`"${(c+'').replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_${fechaHoy()}.csv`;
  a.click();
  toast('✅ CSV descargado');
}

/* ===================== MODALES UTILS ===================== */
function cerrarModal(id){ document.getElementById(id).classList.remove('open'); editandoId=null; }

/* ===================== INIT ===================== */
window.onload = ()=>{
  // Poblar selects de filtros
  poblarSelect('f_estado',    ESTADOS.map(e=>e.id), 'Todos los estados');
  poblarSelect('f_canal',     CANALES, 'Todos los canales');

  // Poblar selects del modal editar
  poblarSelect('e_tipoVenta',         TIPO_VENTA);
  poblarSelect('e_tecnologia',        TECNOLOGIAS);
  poblarSelect('e_paquete',           PAQUETES);
  poblarSelect('e_claroHogar',        CLARO_HOGAR);
  poblarSelect('e_relacionPredio',    RELACION_PREDIO);
  poblarSelect('e_cuotasInstalacion', CUOTAS_INST);
  poblarSelect('e_canal',             CANALES);
  poblarSelect('e_estado',            ESTADOS.map(e=>e.id));
  poblarSelect('e_fullClaro',         ['Si','No']);

  // Poblar selects de nueva venta
  poblarSelect('nv_estado',            ESTADOS.map(e=>e.id));
  poblarSelect('nv_tipoVenta',         TIPO_VENTA);
  poblarSelect('nv_tecnologia',        TECNOLOGIAS);
  poblarSelect('nv_paquete',           PAQUETES);
  poblarSelect('nv_claroHogar',        CLARO_HOGAR);
  poblarSelect('nv_relacionPredio',    RELACION_PREDIO);
  poblarSelect('nv_cuotasInstalacion', CUOTAS_INST);
  poblarSelect('nv_canal',             CANALES);
  poblarSelect('nv_fullClaro',         ['Si','No']);

  // Poblar labels de estados en el select del modal estado
  const selRE = document.getElementById('re_nuevoEstado');
  if(selRE){
    selRE.innerHTML = ESTADOS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  }
  // Mismo para los selects del modal editar que usan id como valor
  const selEE = document.getElementById('e_estado');
  if(selEE){
    selEE.innerHTML = `<option value="">— Estado —</option>`+ESTADOS.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  }

  // Render inicial
  aplicarFiltros();

  // Cerrar modales al hacer click fuera
  ['modalEditar','modalEstado','modalObs'].forEach(id=>{
    document.getElementById(id).addEventListener('click', e=>{
      if(e.target===document.getElementById(id)) cerrarModal(id);
    });
  });

  // Tamaño de página
  document.getElementById('selectPorPagina')?.addEventListener('change', e=>{
    porPagina = parseInt(e.target.value)||18;
    paginaActual = 1;
    renderTabla();
  });
};