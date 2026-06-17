/* ================================================
   JEFATURA.JS — Panel de Jefatura Netcontact
   ================================================ */

const API = window.NC_API + '/api';
const JEF_APARTADO_KEY = 'nc_jefatura_apartado';

const CARGOS = [
  { id:'asesor',         label:'Asesor',           cls:'bc-asesor',         color:'#2563eb' },
  { id:'supervisor',     label:'Supervisor',       cls:'bc-supervisor',     color:'#7C3AED' },
  { id:'backoffice',     label:'Back Office',      cls:'bc-backoffice',     color:'#374151' },
  { id:'validacion',     label:'Validación',       cls:'bc-validacion',     color:'#d97706' },
  { id:'grabaciones',    label:'Grabaciones',      cls:'bc-grabaciones',    color:'#16a34a' },
  { id:'seguimiento',    label:'Seguimiento',      cls:'bc-seguimiento',    color:'#0891b2' },
  { id:'jefatura',       label:'Jefatura',         cls:'bc-jefatura',       color:'#111827' },
  { id:'usuarios',       label:'Usuarios',         cls:'bc-usuarios',       color:'#db2777' },
  { id:'programacion',   label:'Programación',     cls:'bc-programacion',   color:'#7C3AED' },
  { id:'supgrabaciones', label:'Sup. Grabaciones', cls:'bc-supgrabaciones', color:'#16a34a' },
];

const SALAS = ['SALA 1','SALA 2','SALA 3','SIN SALA'];

let usuarios    = [];
let logs        = [];
let editandoId  = null;
let busqUsuarios= '';
let salaReporte = 'todas';
let mesReporte  = '';        // '' = mes actual
let ventasSeg   = [];
let filtroSeg   = '';
let ventasCache = [];
let chartInstances = {};
const ADMIN = 'Jefatura';

/* ── utilidades ── */
function fechaHoy(){ return new Date().toISOString().split('T')[0]; }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}); }
function formatF(f){ if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function mesActual(){ return fechaHoy().slice(0,7); }
function cargoObj(id){ return CARGOS.find(c=>c.id===id)||{label:id,cls:'bc-default'}; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3200); }
function cerrarModal(id){ document.getElementById(id)?.classList.remove('open'); editandoId=null; }
function colorAvatar(n){ const c=["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899","#f59e0b"]; let s=0; for(const ch of n) s+=ch.charCodeAt(0); return c[s%c.length]; }
function iniciales(n){ return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function destroyChart(id){ if(chartInstances[id]){ try{chartInstances[id].destroy();}catch(e){} delete chartInstances[id]; } }

function agregarLog(accion,detalle=''){
  logs.unshift({id:Date.now(),fecha:fechaHoy(),hora:horaAhora(),usuario:ADMIN,accion,detalle,color:'#7C3AED'});
  if(logs.length>200) logs=logs.slice(0,200);
  try{ localStorage.setItem('jef_logs',JSON.stringify(logs.slice(0,100))); }catch(e){}
}
function cargarLogs(){ try{ const r=localStorage.getItem('jef_logs'); if(r) logs=JSON.parse(r); }catch(e){} }

/* ══════════════════════════════════════════
   CARGA DE DATOS
══════════════════════════════════════════ */
async function cargarUsuarios(){
  try{
    const res=await fetch(`${API}/usuarios`,{headers:ncHeaders()});
    const data=await res.json();
    if(data.ok) usuarios=data.data;
  }catch(e){ toast('❌ Error conectando al servidor'); }
}

async function cargarVentasCache(){
  try{
    const res=await fetch(`${API}/ventas`,{headers:ncHeaders()});
    const data=await res.json();
    if(data.ok) ventasCache=data.data.map(v=>({...v, _fecha:(v.created_at||'').split(' ')[0]}));
  }catch(e){ console.error('Error cargando ventas',e); }
}

/* ══════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════ */
function showSection(id,btn){
  try{ sessionStorage.setItem(JEF_APARTADO_KEY,id); }catch(e){}
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+id)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='dashboard')   renderDashboard();
  if(id==='usuarios')    renderUsuarios();
  if(id==='reportes')    renderReportes();
  if(id==='logs')        renderLogs();
  if(id==='accesos')     renderAccesos();
  if(id==='seguimiento') cargarSeguimiento();
}

function restaurarSeccionJefatura(){
  let id='';
  try{ id=sessionStorage.getItem(JEF_APARTADO_KEY)||''; }catch(e){}
  if(!id || !document.getElementById('sec-'+id)) return false;
  const btn=document.querySelector('.nav-btn[onclick*="' + id + '"]');
  showSection(id,btn);
  return true;
}

/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
function renderDashboard(){
  const ventas  = ventasCache;
  const hoy     = fechaHoy();
  const mes     = mesActual();
  const totalUs = usuarios.length;
  const activos = usuarios.filter(u=>u.activo).length;
  const asesores    = usuarios.filter(u=>u.cargo==='asesor'&&u.activo).length;
  const supervisores= usuarios.filter(u=>u.cargo==='supervisor'&&u.activo).length;

  const e = s => (s||'').toLowerCase();

  // Ventas del día
  const ventasHoy     = ventas.filter(v=>v._fecha===hoy);
  // Validadas = pasaron validación (estado != venta)
  const validadas     = ventas.filter(v=>!['venta',''].includes(e(v.estado)));
  // No validadas = se quedaron en venta o rechazadas en validación
  const noValidadas   = ventas.filter(v=>['venta','corta_llamada','fraude','no_desea','no_contesta','servicio_activo','no_validado'].includes(e(v.estado)));
  // Grabadas
  const grabadas      = ventas.filter(v=>['grabado','aprobado','en_ejecucion','instalado','caida','rechazo_campo','tecnico_casa','programado'].includes(e(v.estado)));
  // No grabadas = validado (esperando grabación)
  const noGrabadas    = ventas.filter(v=>e(v.estado)==='validado');
  // En ejecución = programadas/aprobadas
  const enEjecucion   = ventas.filter(v=>['aprobado','programado','en_ejecucion','tecnico_casa'].includes(e(v.estado)));
  // No programadas = grabado (esperando programación)
  const noProgramadas = ventas.filter(v=>['bloqueado','sin_agenda','caracter_especial','fraude','zona_restringida'].includes(e(v.estado)));
  // Instaladas
  const instaladas    = ventas.filter(v=>e(v.estado)==='instalado');
  // Caídas = caída + rechazo en campo
  const caidas        = ventas.filter(v=>['caida','rechazo_campo'].includes(e(v.estado)));
  // Efectividad del mes: instaladas mes / (instaladas+caidas) mes
  const instMes  = ventas.filter(v=>v._fecha&&v._fecha.startsWith(mes)&&e(v.estado)==='instalado').length;
  const caidaMes = ventas.filter(v=>v._fecha&&v._fecha.startsWith(mes)&&['caida','rechazo_campo'].includes(e(v.estado))).length;
  const efect    = (instMes+caidaMes)>0 ? Math.round(instMes/(instMes+caidaMes)*100) : 0;

  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('kpi-ventas-hoy',   ventasHoy.length);
  set('kpi-validadas',    validadas.length);
  set('kpi-novalidadas',  noValidadas.length);
  set('kpi-grabadas',     grabadas.length);
  set('kpi-nograbadas',   noGrabadas.length);
  set('kpi-ejecucion',    enEjecucion.length);
  set('kpi-noprogramadas',noProgramadas.length);
  set('kpi-instaladas',   instaladas.length);
  set('kpi-caidas',       caidas.length);
  set('kpi-conv',         efect+'%');
  set('kpi-usuarios',     totalUs);
  set('kpi-activos',      activos);
  set('kpi-asesores',     asesores);
  set('kpi-supervisores', supervisores);

  renderChartEstados(ventas);
  renderChartSalas(ventas, mes);
  renderChartDiario(ventas);
}

/* Chart 1 — Ventas por estado */
function renderChartEstados(ventas){
  destroyChart('chEstados');
  const ctx=document.getElementById('chEstados'); if(!ctx) return;
  const e=s=>(s||'').toLowerCase();

  const estados=[
    {label:'Validadas',    val:ventas.filter(v=>!['venta','',  'corta_llamada','fraude','no_desea','no_contesta','servicio_activo','no_validado'].includes(e(v.estado))).length, color:'#7C3AED'},
    {label:'No validadas', val:ventas.filter(v=>['venta','corta_llamada','fraude','no_desea','no_contesta','servicio_activo','no_validado'].includes(e(v.estado))).length,        color:'#ef4444'},
    {label:'Grabadas',     val:ventas.filter(v=>['grabado','aprobado','en_ejecucion','instalado','caida','rechazo_campo','tecnico_casa','programado'].includes(e(v.estado))).length, color:'#d97706'},
    {label:'No grabadas',    val:ventas.filter(v=>e(v.estado)==='validado').length,                                                                                              color:'#9ca3af'},
    {label:'No programadas', val:ventas.filter(v=>['bloqueado','sin_agenda','caracter_especial','fraude','zona_restringida'].includes(e(v.estado))).length,                                  color:'#6366f1'},
    {label:'Instaladas',   val:ventas.filter(v=>e(v.estado)==='instalado').length,                                                                                               color:'#16a34a'},
    {label:'Caídas',       val:ventas.filter(v=>e(v.estado)==='caida').length,                                                                                                   color:'#dc2626'},
    {label:'Rechazos',     val:ventas.filter(v=>e(v.estado)==='rechazo_campo').length,                                                                                           color:'#f97316'},
  ].filter(e=>e.val>0);

  if(!estados.length){
    const ctx2=ctx.getContext('2d');
    ctx2.clearRect(0,0,ctx.width,ctx.height);
    ctx2.fillStyle='#f3f4f6'; ctx2.beginPath(); ctx2.arc(ctx.width/2,ctx.height/2,60,0,Math.PI*2); ctx2.fill();
    ctx2.fillStyle='#9ca3af'; ctx2.font='12px Inter,sans-serif'; ctx2.textAlign='center'; ctx2.fillText('Sin datos',ctx.width/2,ctx.height/2+4);
    return;
  }

  chartInstances.chEstados=new Chart(ctx,{
    type:'doughnut',
    data:{
      labels:estados.map(e=>e.label),
      datasets:[{data:estados.map(e=>e.val),backgroundColor:estados.map(e=>e.color),borderWidth:2,borderColor:'#fff',hoverOffset:6}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'60%',
      plugins:{
        legend:{position:'right',labels:{font:{size:11},boxWidth:12,padding:10}},
        tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw}`}}
      }
    }
  });
}

/* Chart 2 — Instaladas y Caídas por sala del mes */
function renderChartSalas(ventas, mes){
  destroyChart('chSalas');
  const ctx=document.getElementById('chSalas'); if(!ctx) return;

  // Si mesReporte está definido, usarlo; si no usar mes actual
  const mesUsar = mesReporte || mes;
  const ventasMes = ventas.filter(v=>v._fecha&&v._fecha.startsWith(mesUsar));

  const salas=['SALA 1','SALA 2','SALA 3'];
  const instaladas = salas.map(s=>{
    const nombres=usuarios.filter(u=>u.sala===s).map(u=>u.nombre);
    return ventasMes.filter(v=>nombres.includes(v.asesor_nombre||'')&&(v.estado||'').toLowerCase()==='instalado').length;
  });
  const caidas = salas.map(s=>{
    const nombres=usuarios.filter(u=>u.sala===s).map(u=>u.nombre);
    return ventasMes.filter(v=>nombres.includes(v.asesor_nombre||'')&&(v.estado||'').toLowerCase()==='caida').length;
  });

  chartInstances.chSalas=new Chart(ctx,{
    type:'bar',
    data:{
      labels:salas,
      datasets:[
        {label:'Instaladas',data:instaladas,backgroundColor:'#16a34a',borderRadius:6},
        {label:'Caídas',    data:caidas,    backgroundColor:'#ef4444',borderRadius:6},
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},
      scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}
    }
  });
}

/* Chart 3 — Ventas diarias por sala (tiempo real) */
function renderChartDiario(ventas){
  destroyChart('chDiario');
  const ctx=document.getElementById('chDiario'); if(!ctx) return;

  const dias=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dias.push(d.toISOString().split('T')[0]);}

  const salas=['SALA 1','SALA 2','SALA 3'];
  const colors=['#3b82f6','#8b5cf6','#22c55e'];

  const datasets=salas.map((s,i)=>{
    const nombres=usuarios.filter(u=>u.sala===s).map(u=>u.nombre);
    return {
      label: s,
      data: dias.map(d=>ventas.filter(v=>v._fecha===d&&nombres.includes(v.asesor_nombre||'')).length),
      borderColor: colors[i],
      backgroundColor: colors[i]+'22',
      fill: true, tension:.4, borderWidth:2, pointRadius:4,
    };
  });

  chartInstances.chDiario=new Chart(ctx,{
    type:'line',
    data:{labels:dias.map(d=>{const p=d.split('-');return `${p[2]}/${p[1]}`;}),datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}},
      scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}
    }
  });
}

/* Filtro mes en chart salas */
function cambiarMesSalas(val){
  mesReporte=val;
  renderChartSalas(ventasCache, mesActual());
}

/* ══════════════════════════════════════════
   USUARIOS
══════════════════════════════════════════ */
function renderUsuarios(){
  const tbody=document.getElementById('tablaUsuariosBody');
  let lista=[...usuarios];
  if(busqUsuarios){ const b=busqUsuarios.toLowerCase(); lista=lista.filter(u=>(u.nombre||'').toLowerCase().includes(b)||(u.usuario||'').toLowerCase().includes(b)||(u.sala||'').toLowerCase().includes(b)); }
  document.getElementById('usuariosCount').textContent=`${lista.length} usuarios`;
  if(!lista.length){ tbody.innerHTML=`<tr><td colspan="7" class="tabla-empty">No hay usuarios.</td></tr>`; return; }
  tbody.innerHTML=lista.map(u=>{
    const c=cargoObj(u.cargo),col=colorAvatar(u.nombre);
    const fecha=u.created_at?u.created_at.split(' ')[0]:'';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:9px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${iniciales(u.nombre)}</div>
        <div><div style="font-weight:700;font-size:13px">${u.nombre}</div><div style="font-size:11px;color:#9ca3af">${u.usuario}</div></div>
      </div></td>
      <td><span class="badge-cargo ${c.cls}">${c.label}</span></td>
      <td style="font-size:12px">${u.sala||'—'}</td>
      <td style="font-family:monospace;font-size:12px;color:#6b7280">${u.usuario}</td>
      <td style="font-size:11px;color:#9ca3af">${formatF(fecha)}</td>
      <td><span class="badge-estado-user ${u.activo?'bu-activo':'bu-inactivo'}">${u.activo?'Activo':'Inactivo'}</span></td>
      <td><div class="acc-cell">
        <button class="btn-edit" onclick="abrirModalEditar(${u.id})">✏️ Editar</button>
        <button class="btn-toggle-activo ${u.activo?'btn-desactivar':'btn-activar'}" onclick="toggleActivo(${u.id})">${u.activo?'Desactivar':'Activar'}</button>
      </div></td>
    </tr>`;
  }).join('');
}

function abrirModalNuevo(){
  editandoId=null;
  document.getElementById('mod_titulo').textContent='Nuevo usuario';
  document.getElementById('mod_sub').textContent='Completa todos los campos.';
  ['mod_nombre','mod_usuario','mod_pass','mod_pass2'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mod_cargo').value='';
  document.getElementById('mod_sala').value='';
  document.getElementById('modalUsuario').classList.add('open');
}

function abrirModalEditar(id){
  const u=usuarios.find(x=>x.id===id); if(!u) return;
  editandoId=id;
  document.getElementById('mod_titulo').textContent='Editar usuario';
  document.getElementById('mod_sub').textContent=`Editando: ${u.nombre}`;
  document.getElementById('mod_nombre').value=u.nombre||'';
  document.getElementById('mod_usuario').value=u.usuario||'';
  document.getElementById('mod_cargo').value=u.cargo||'';
  document.getElementById('mod_sala').value=u.sala||'';
  document.getElementById('mod_pass').value='';
  document.getElementById('mod_pass2').value='';
  document.getElementById('modalUsuario').classList.add('open');
}

async function guardarUsuario(){
  const nombre=document.getElementById('mod_nombre').value.trim();
  const usuario=document.getElementById('mod_usuario').value.trim().toLowerCase().replace(/\s+/g,'.');
  const cargo=document.getElementById('mod_cargo').value;
  const sala=document.getElementById('mod_sala').value;
  const pass=document.getElementById('mod_pass').value;
  const pass2=document.getElementById('mod_pass2').value;
  let errores=[];
  if(!nombre) errores.push('mod_nombre');
  if(!usuario) errores.push('mod_usuario');
  if(!cargo) errores.push('mod_cargo');
  if(!editandoId&&!pass) errores.push('mod_pass');
  if(pass&&pass!==pass2) errores.push('mod_pass2');
  ['mod_nombre','mod_usuario','mod_cargo','mod_pass','mod_pass2'].forEach(id=>document.getElementById(id).classList.remove('error'));
  if(errores.length){ errores.forEach(id=>document.getElementById(id).classList.add('error')); toast('⚠️ Completa los campos requeridos'); return; }
  try{
    if(editandoId){
      const body={nombre,usuario,cargo,sala}; if(pass) body.password=pass;
      const res=await fetch(`${API}/usuarios/${editandoId}`,{method:'PATCH',headers:ncHeaders(),body:JSON.stringify(body)});
      const data=await res.json();
      if(!data.ok){ toast('❌ '+(data.mensaje||'Error')); return; }
      agregarLog('Usuario editado',nombre);
      toast(`✅ Usuario actualizado: ${nombre}`);
    } else {
      const res=await fetch(`${API}/usuarios`,{method:'POST',headers:ncHeaders(),body:JSON.stringify({nombre,usuario,password:pass,cargo,sala,activo:true})});
      const data=await res.json();
      if(!data.ok){ toast('❌ '+(data.mensaje||'Error')); return; }
      agregarLog('Usuario creado',`${nombre} — ${cargo}`);
      toast(`✅ Usuario creado: ${nombre}`);
    }
    await cargarUsuarios();
    cerrarModal('modalUsuario');
    renderUsuarios();
  }catch(e){ toast('❌ Error conectando'); }
}

async function toggleActivo(id){
  const u=usuarios.find(x=>x.id===id); if(!u) return;
  const nuevo=!u.activo;
  try{
    const res=await fetch(`${API}/usuarios/${id}/estado`,{method:'PATCH',headers:ncHeaders(),body:JSON.stringify({activo:nuevo})});
    const data=await res.json();
    if(!data.ok){ toast('❌ '+data.mensaje); return; }
    u.activo=nuevo;
    agregarLog(nuevo?'Activado':'Desactivado',u.nombre);
    renderUsuarios();
    toast(`${nuevo?'✅ Activado':'🔴 Desactivado'}: ${u.nombre}`);
  }catch(e){ toast('❌ Error'); }
}

/* ══════════════════════════════════════════
   REPORTES — solo asesores
══════════════════════════════════════════ */
function renderReportes(){
  const sel=salaReporte;
  let asesores=usuarios.filter(u=>u.cargo==='asesor');
  if(sel!=='todas') asesores=asesores.filter(u=>u.sala===sel);

  let ventas=ventasCache;
  if(sel!=='todas'){
    const nombres=asesores.map(a=>a.nombre);
    ventas=ventas.filter(v=>nombres.includes(v.asesor_nombre||''));
  }

  const inst  = ventas.filter(v=>(v.estado||'').toLowerCase()==='instalado').length;
  const caidas= ventas.filter(v=>(v.estado||'').toLowerCase()==='caida').length;
  const efect = ventas.length?Math.round(inst/ventas.length*100):0;

  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('rep-total', ventas.length);
  set('rep-valid', inst);
  set('rep-caidas',caidas);
  set('rep-conv',  efect+'%');

  const tbody=document.getElementById('tablaReporteBody');
  const count=document.getElementById('repCount');
  if(!asesores.length){ tbody.innerHTML=`<tr><td colspan="7" class="tabla-empty">Sin asesores.</td></tr>`; return; }

  const rendData=asesores.map(a=>{
    const mis  =ventasCache.filter(v=>(v.asesor_nombre||'')===a.nombre);
    const inst2=mis.filter(v=>(v.estado||'').toLowerCase()==='instalado').length;
    const caid =mis.filter(v=>(v.estado||'').toLowerCase()==='caida').length;
    const ef   =mis.length?Math.round(inst2/mis.length*100):0;
    return {...a,totalVentas:mis.length,instaladas:inst2,caidas:caid,efectividad:ef};
  }).sort((a,b)=>b.instaladas-a.instaladas);

  if(count) count.textContent=rendData.length+' asesores';

  const efColor=e=>e>=70?'#16a34a':e>=40?'#d97706':'#dc2626';
  const efBg   =e=>e>=70?'#d1fae5':e>=40?'#fef3c7':'#fee2e2';
  const medals =['🥇','🥈','🥉'];

  tbody.innerHTML=rendData.map((r,i)=>`<tr>
    <td style="text-align:center;font-size:${i<3?'18':'13'}px;font-weight:700">${i<3?medals[i]:i+1}</td>
    <td><div style="display:flex;align-items:center;gap:9px;">
      <div style="width:32px;height:32px;border-radius:50%;background:${colorAvatar(r.nombre)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;">${iniciales(r.nombre)}</div>
      <div><div style="font-weight:700;font-size:13px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario||''}</div></div>
    </div></td>
    <td style="font-size:12px;color:#6b7280">${r.sala||'—'}</td>
    <td style="font-size:24px;font-weight:900;color:#16a34a;text-align:center">${r.instaladas}</td>
    <td style="font-weight:700;text-align:center">${r.totalVentas}</td>
    <td style="color:#dc2626;font-weight:600;text-align:center">${r.caidas}</td>
    <td><div style="display:flex;align-items:center;gap:8px;">
      <div style="height:7px;background:#e5e7eb;border-radius:99px;overflow:hidden;width:70px;">
        <div style="height:100%;background:${efColor(r.efectividad)};border-radius:99px;width:${r.efectividad}%"></div>
      </div>
      <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;background:${efBg(r.efectividad)};color:${efColor(r.efectividad)};">${r.efectividad}%</span>
    </div></td>
  </tr>`).join('');
}

function cambiarSalaReporte(sala,btn){
  salaReporte=sala;
  document.querySelectorAll('.sala-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderReportes();
}

/* ══════════════════════════════════════════
   SEGUIMIENTO EN CAMPO
══════════════════════════════════════════ */
const SEG_MAP={
  'aprobado':'ejecucion','programado':'ejecucion','en_ejecucion':'ejecucion',
  'instalado':'instalado','caida':'caida','rechazo_campo':'rechazo','tecnico_casa':'tecnico',
  'validado':'ejecucion','observado':'ejecucion',
};
function mapSeg(e){
  const s=(e||'').toLowerCase();
  if(s.includes('tecnico'))   return 'tecnico';
  if(s.includes('rechazo'))   return 'rechazo';
  if(s.includes('ejecucion')) return 'ejecucion';
  return SEG_MAP[s]||null;
}
const SEG_BADGES={
  ejecucion:{label:'EN EJECUCIÓN',    bg:'#cffafe',color:'#155e75'},
  instalado:{label:'INSTALADO',       bg:'#d1fae5',color:'#065f46'},
  rechazo:  {label:'RECHAZO CAMPO',   bg:'#ffedd5',color:'#9a3412'},
  caida:    {label:'CAÍDA',           bg:'#fee2e2',color:'#991b1b'},
  tecnico:  {label:'TÉCNICO EN CASA', bg:'#f3e8ff',color:'#6b21a8'},
};

async function cargarSeguimiento(){
  try{
    const res=await fetch(`${API}/ventas`,{headers:ncHeaders()});
    const data=await res.json();
    if(data.ok){
      ventasSeg=data.data.filter(v=>mapSeg(v.estado)!==null).map(v=>({...v,_seg:mapSeg(v.estado),_fecha:(v.created_at||'').split(' ')[0]}));
      actualizarKpisSeg();
      renderSeg();
    }
  }catch(e){ console.error(e); }
}

function actualizarKpisSeg(){
  const c=id=>ventasSeg.filter(v=>v._seg===id).length;
  ['ejecucion','instalado','rechazo','caida','tecnico'].forEach(id=>{
    const el=document.getElementById('seg-'+id); if(el) el.textContent=c(id);
  });
}

function filtrarSeg(estado,btn){
  filtroSeg=estado;
  document.querySelectorAll('.seg-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSeg();
}

function renderSeg(){
  const tbody=document.getElementById('tablaSegBody');
  const count=document.getElementById('segCount');
  let lista=filtroSeg?ventasSeg.filter(v=>v._seg===filtroSeg):[...ventasSeg];
  const ord={caida:0,rechazo:1,tecnico:2,ejecucion:3,instalado:4};
  lista.sort((a,b)=>(ord[a._seg]??5)-(ord[b._seg]??5));
  if(count) count.textContent=lista.length+' registros';
  if(!lista.length){ tbody.innerHTML='<tr><td colspan="10" class="tabla-empty">Sin registros.</td></tr>'; return; }
  tbody.innerHTML=lista.map(v=>{
    const b=SEG_BADGES[v._seg]||SEG_BADGES.ejecucion;
    const motivo=v.obs_backoffice||v.observacion||'—';
    return `<tr>
      <td><span style="display:inline-block;padding:4px 12px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.3px;background:${b.bg};color:${b.color};white-space:nowrap">${b.label}</span></td>
      <td style="font-size:11px;color:#185FA5;font-weight:700;white-space:nowrap">${formatF(v._fecha)}</td>
      <td style="font-weight:600;font-size:12px">${v.nombre||'—'}</td>
      <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
      <td style="font-size:11px">${v.distrito||'—'}</td>
      <td style="font-weight:600;color:#7C3AED;font-size:11px">${v.asesor_nombre||'—'}</td>
      <td style="font-size:11px;color:#9ca3af">${v.sala||'—'}</td>
      <td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.paquete||'—'}</td>
      <td style="font-size:11px;text-align:center">${v._tramo||'—'}</td>
      <td style="font-size:10px;color:#6b7280;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${motivo}">${motivo}</td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════
   LOGS
══════════════════════════════════════════ */
function renderLogs(){
  const cont=document.getElementById('logsContainer');
  if(!logs.length){ cont.innerHTML='<div style="text-align:center;color:#9ca3af;padding:32px;font-size:13px;">Sin actividad.</div>'; return; }
  cont.innerHTML=logs.slice(0,50).map(l=>`
    <div class="log-item">
      <div class="log-dot" style="background:${l.color||'#7C3AED'}"></div>
      <div class="log-content">
        <div class="log-accion">${l.accion}${l.detalle?` <span style="color:#6b7280;font-weight:400">— ${l.detalle}</span>`:''}</div>
        <div class="log-meta"><span class="log-user">${l.usuario}</span> · ${formatF(l.fecha)} ${l.hora}</div>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   ACCESOS
══════════════════════════════════════════ */
function renderAccesos(){
  const grid=document.getElementById('accesosGrid');
  const modulos=[
    {nombre:'Back Office',      desc:'Gestión de leads',              icon:'📋',url:'backoffice.html',     color:'#111827'},
    {nombre:'Validación',       desc:'Validar ventas',                icon:'✅',url:'validacion.html',     color:'#d97706'},
    {nombre:'Grabaciones',      desc:'Control de grabaciones',        icon:'🎙️',url:'grabaciones.html',   color:'#16a34a'},
    {nombre:'Seguimiento',      desc:'Post-venta y estados',          icon:'📡',url:'seguimiento.html',    color:'#0891b2'},
    {nombre:'Supervisor',       desc:'Portal supervisores',           icon:'👔',url:'supervisor.html',     color:'#7C3AED'},
    {nombre:'Dashboard CRM',    desc:'Vista del asesor',              icon:'📊',url:'dashboard.html',      color:'#2563eb'},
    {nombre:'Gestión Usuarios', desc:'Administrar usuarios',          icon:'👥',url:'usuarios.html',       color:'#db2777'},
    {nombre:'Programación',     desc:'Ventas aprobadas grabaciones',  icon:'📅',url:'programacion.html',   color:'#7C3AED'},
    {nombre:'Sup. Grabaciones', desc:'Supervisor grabaciones',        icon:'🎧',url:'supgrabaciones.html', color:'#16a34a'},
  ];
  grid.innerHTML=modulos.map(m=>`
    <a class="acceso-card" href="${m.url}">
      <div class="acceso-icon" style="background:${m.color}22">${m.icon}</div>
      <div class="acceso-nombre">${m.nombre}</div>
      <div class="acceso-desc">${m.desc}</div>
    </a>`).join('');
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
window.onload = async () => {
  const u=ncGetSesion();
  if(u){ const el=document.getElementById('topbarUser'); if(el) el.textContent=u.nombre||'Jefatura'; }

  // Poblar selects del modal
  const selCargo=document.getElementById('mod_cargo');
  if(selCargo) selCargo.innerHTML='<option value="">— Seleccionar cargo —</option>'+CARGOS.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  const selSala=document.getElementById('mod_sala');
  if(selSala) selSala.innerHTML='<option value="">— Sin sala —</option>'+SALAS.map(s=>`<option value="${s}">${s}</option>`).join('');

  // Generar opciones de meses para el filtro del chart salas
  const selMes=document.getElementById('filtroMesSalas');
  if(selMes){
    selMes.innerHTML='<option value="">Mes actual</option>';
    for(let i=1;i<=11;i++){
      const d=new Date(); d.setMonth(d.getMonth()-i);
      const clave=d.toISOString().slice(0,7);
      const label=d.toLocaleString('es-PE',{month:'long',year:'numeric'});
      selMes.innerHTML+=`<option value="${clave}">${label}</option>`;
    }
  }

  document.getElementById('modalUsuario')?.addEventListener('click',e=>{ if(e.target===document.getElementById('modalUsuario')) cerrarModal('modalUsuario'); });
  document.getElementById('busqUsuarios')?.addEventListener('input',e=>{ busqUsuarios=e.target.value; renderUsuarios(); });

  await cargarUsuarios();
  await cargarVentasCache();
  cargarLogs();
  if(!restaurarSeccionJefatura()) renderDashboard();
  agregarLog('Sesión iniciada','Panel de Jefatura');

  // Refresh automático cada 60s para ventas diarias
  setInterval(async()=>{
    await cargarVentasCache();
    if(document.getElementById('sec-dashboard')?.classList.contains('active')) renderDashboard();
    if(document.getElementById('sec-seguimiento')?.classList.contains('active')) cargarSeguimiento();
  }, 60000);
};
