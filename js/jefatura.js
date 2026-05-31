/* ================================================
   JEFATURA.JS — Panel de Jefatura Netcontact
   ================================================ */

const API = 'http://127.0.0.1:3000/api';

const CARGOS = [
  { id:'asesor',      label:'Asesor',         cls:'bc-asesor',      modulo:'dashboard.html',   color:'#2563eb' },
  { id:'supervisor',  label:'Supervisor',     cls:'bc-supervisor',  modulo:'supervisor.html',  color:'#7C3AED' },
  { id:'backoffice',  label:'Back Office',    cls:'bc-backoffice',  modulo:'backoffice.html',  color:'#374151' },
  { id:'validacion',  label:'Validación',     cls:'bc-validacion',  modulo:'validacion.html',  color:'#d97706' },
  { id:'grabaciones', label:'Grabaciones',    cls:'bc-grabaciones', modulo:'grabaciones.html', color:'#16a34a' },
  { id:'seguimiento', label:'Seguimiento',    cls:'bc-seguimiento', modulo:'seguimiento.html', color:'#0891b2' },
  { id:'jefatura',    label:'Jefatura',       cls:'bc-jefatura',    modulo:'jefatura.html',    color:'#111827' },
  { id:'usuarios',    label:'Usuarios',       cls:'bc-usuarios',    modulo:'usuarios.html',    color:'#db2777' },
  { id:'programacion', label:'Programación',  cls:'bc-programacion', modulo:'programacion.html', color:'#7C3AED' },
  { id:'supgrabaciones', label:'Sup. Grabaciones', cls:'bc-supgrabaciones', modulo:'supgrabaciones.html', color:'#16a34a' },
];

const SALAS = ['SALA 1','SALA 2','SALA 3','SIN SALA'];

let usuarios     = [];
let logs         = [];
let usuariosCnt  = 1;
let editandoId   = null;
let busqUsuarios = '';
let salaReporte  = 'todas';
const ADMIN      = 'Jefatura';

function fechaHoy(){ return new Date().toISOString().split('T')[0]; }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}); }
function formatF(f){ if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function cargoObj(id){ return CARGOS.find(c=>c.id===id)||CARGOS[0]; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3200); }
function cerrarModal(id){ document.getElementById(id)?.classList.remove('open'); editandoId=null; }

function colorAvatar(nombre){
  const cols=["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899","#f59e0b"];
  let s=0; for(const c of nombre) s+=c.charCodeAt(0);
  return cols[s%cols.length];
}
function iniciales(n){ return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }

function agregarLog(accion, detalle=''){
  logs.unshift({ id:Date.now(), fecha:fechaHoy(), hora:horaAhora(), usuario:ADMIN, accion, detalle, color:'#7C3AED' });
  if(logs.length>200) logs=logs.slice(0,200);
  try{ localStorage.setItem('jef_logs', JSON.stringify(logs.slice(0,100))); }catch(e){}
}
function cargarLogs(){
  try{ const r=localStorage.getItem('jef_logs'); if(r) logs=JSON.parse(r); }catch(e){}
}

function getVentas(){
  try{ const r=localStorage.getItem('val_ventas'); return r?JSON.parse(r):[]; }catch(e){ return []; }
}

async function cargarUsuarios(){
  try {
    const res  = await fetch(`${API}/usuarios`, { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      usuarios    = data.data;
      usuariosCnt = usuarios.length ? Math.max(...usuarios.map(u=>u.id))+1 : 1;
    } else {
      toast('❌ ' + data.mensaje);
    }
  } catch(e) {
    toast('❌ Error conectando al servidor');
  }
}

function showSection(id, btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+id)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='dashboard')  renderDashboard();
  if(id==='usuarios')   renderUsuarios();
  if(id==='reportes')   renderReportes();
  if(id==='logs')       renderLogs();
  if(id==='accesos')    renderAccesos();
}

function renderDashboard(){
  const ventas   = getVentas();
  const total    = ventas.length;
  const validados= ventas.filter(v=>['validado','instalado','programado'].includes(v.estado)).length;
  const caidas   = ventas.filter(v=>v.estado==='caida').length;
  const hoy      = fechaHoy();
  const hoyCount = ventas.filter(v=>v.fechaIngreso===hoy||v._fecha===hoy).length;
  const totalUs  = usuarios.length;
  const activos  = usuarios.filter(u=>u.activo).length;
  const asesores = usuarios.filter(u=>u.cargo==='asesor'&&u.activo).length;

  document.getElementById('kpi-ventas').textContent    = total;
  document.getElementById('kpi-validados').textContent = validados;
  document.getElementById('kpi-caidas').textContent    = caidas;
  document.getElementById('kpi-hoy').textContent       = hoyCount;
  document.getElementById('kpi-usuarios').textContent  = totalUs;
  document.getElementById('kpi-activos').textContent   = activos;
  document.getElementById('kpi-asesores').textContent  = asesores;

  const conv = total ? Math.round(validados/total*100) : 0;
  document.getElementById('kpi-conv').textContent = conv+'%';
  renderChartsDash(ventas);
}

function renderChartsDash(ventas){
  destroyChart('chEstados');
  const ctx1=document.getElementById('chEstados');
  if(ctx1){
    const estados=[
      {label:'Validado',  val:ventas.filter(v=>v.estado==='validado').length,   color:'#7C3AED'},
      {label:'Instalado', val:ventas.filter(v=>v.estado==='instalado').length,  color:'#0891b2'},
      {label:'En ejec.',  val:ventas.filter(v=>v.estado==='programado').length, color:'#16a34a'},
      {label:'Caída',     val:ventas.filter(v=>v.estado==='caida').length,      color:'#dc2626'},
      {label:'Pendiente', val:ventas.filter(v=>v.estado==='pendiente'||v.estado==='venta').length, color:'#d97706'},
    ].filter(e=>e.val>0);
    chartInstances.chEstados=new Chart(ctx1,{
      type:'doughnut',
      data:{labels:estados.map(e=>e.label),datasets:[{data:estados.map(e=>e.val),backgroundColor:estados.map(e=>e.color),borderWidth:2,borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11},boxWidth:12}}}}
    });
  }

  destroyChart('chSalas');
  const ctx2=document.getElementById('chSalas');
  if(ctx2){
    const porSala = SALAS.slice(0,3).map(s=>{
      const asesoresSala = usuarios.filter(u=>u.sala===s).map(u=>u.nombre);
      return {sala:s, cnt:ventas.filter(v=>asesoresSala.includes(v.asesor||v.vendedor||'')).length};
    });
    chartInstances.chSalas=new Chart(ctx2,{
      type:'bar',
      data:{labels:porSala.map(s=>s.sala),datasets:[{label:'Ventas',data:porSala.map(s=>s.cnt),backgroundColor:['#3b82f6','#8b5cf6','#22c55e'],borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}}
    });
  }

  destroyChart('chDiario');
  const ctx3=document.getElementById('chDiario');
  if(ctx3){
    const dias=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dias.push(d.toISOString().split('T')[0]);}
    chartInstances.chDiario=new Chart(ctx3,{
      type:'line',
      data:{
        labels:dias.map(d=>{const p=d.split('-');return `${p[2]}/${p[1]}`;}),
        datasets:[
          {label:'Total ventas',data:dias.map(d=>ventas.filter(v=>(v.fechaIngreso||v._fecha||'')===d).length),borderColor:'#3b82f6',backgroundColor:'#3b82f622',fill:true,tension:.4,borderWidth:2,pointRadius:4},
          {label:'Validadas',data:dias.map(d=>ventas.filter(v=>(v.fechaIngreso||v._fecha||'')===d&&['validado','instalado','programado'].includes(v.estado)).length),borderColor:'#16a34a',backgroundColor:'#16a34a22',fill:true,tension:.4,borderWidth:2,pointRadius:4},
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}}
    });
  }
}

let chartInstances={};
function destroyChart(id){ if(chartInstances[id]){ try{chartInstances[id].destroy();}catch(e){} delete chartInstances[id]; } }

function renderUsuarios(){
  const tbody=document.getElementById('tablaUsuariosBody');
  let lista=[...usuarios];
  if(busqUsuarios){ const b=busqUsuarios.toLowerCase(); lista=lista.filter(u=>(u.nombre||'').toLowerCase().includes(b)||(u.usuario||'').toLowerCase().includes(b)||(u.sala||'').toLowerCase().includes(b)); }
  document.getElementById('usuariosCount').textContent=`${lista.length} usuarios`;

  if(!lista.length){
    tbody.innerHTML=`<tr><td colspan="7" class="tabla-empty">No hay usuarios. Crea el primero.</td></tr>`; return;
  }
  tbody.innerHTML=lista.map(u=>{
    const c=cargoObj(u.cargo);
    const col=colorAvatar(u.nombre);
    const fecha = u.created_at ? u.created_at.split(' ')[0] : (u.fechaCreacion||'');
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
      <td>
        <div class="acc-cell">
          <button class="btn-edit" onclick="abrirModalEditar(${u.id})">✏️ Editar</button>
          <button class="btn-toggle-activo ${u.activo?'btn-desactivar':'btn-activar'}" onclick="toggleActivo(${u.id})">
            ${u.activo?'Desactivar':'Activar'}
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalNuevo(){
  editandoId=null;
  document.getElementById('mod_titulo').textContent='Nuevo usuario';
  document.getElementById('mod_sub').textContent='Completa todos los campos para crear el usuario.';
  ['mod_nombre','mod_usuario','mod_pass','mod_pass2'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mod_cargo').value='';
  document.getElementById('mod_sala').value='';
  document.getElementById('passWrap').style.display='';
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
  document.getElementById('passWrap').style.display='';
  document.getElementById('modalUsuario').classList.add('open');
}

async function guardarUsuario(){
  const nombre  = document.getElementById('mod_nombre').value.trim();
  const usuario = document.getElementById('mod_usuario').value.trim().toLowerCase().replace(/\s+/g,'.');
  const cargo   = document.getElementById('mod_cargo').value;
  const sala    = document.getElementById('mod_sala').value;
  const pass    = document.getElementById('mod_pass').value;
  const pass2   = document.getElementById('mod_pass2').value;

  let errores=[];
  if(!nombre)              errores.push('mod_nombre');
  if(!usuario)             errores.push('mod_usuario');
  if(!cargo)               errores.push('mod_cargo');
  if(!editandoId && !pass) errores.push('mod_pass');
  if(pass && pass!==pass2) errores.push('mod_pass2');

  ['mod_nombre','mod_usuario','mod_cargo','mod_pass','mod_pass2'].forEach(id=>document.getElementById(id).classList.remove('error'));
  if(errores.length){ errores.forEach(id=>document.getElementById(id).classList.add('error')); toast('⚠️ Completa los campos requeridos'); return; }

  try {
    if(editandoId){
      const body = { nombre, usuario, cargo, sala };
      if(pass) body.password = pass;
      const res  = await fetch(`${API}/usuarios/${editandoId}`, {
        method:'PATCH', headers:ncHeaders(), body:JSON.stringify(body),
      });
      const data = await res.json();
      if(!data.ok){
        if(res.status===409){ document.getElementById('mod_usuario').classList.add('error'); toast('⚠️ Ese nombre de usuario ya existe'); }
        else toast('❌ ' + data.mensaje);
        return;
      }
      agregarLog('Usuario editado', `${nombre} (${cargoObj(cargo).label})`);
      toast(`✅ Usuario actualizado: ${nombre}`);
    } else {
      const res  = await fetch(`${API}/usuarios`, {
        method:'POST', headers:ncHeaders(),
        body:JSON.stringify({ nombre, usuario, password:pass, cargo, sala, activo:true }),
      });
      const data = await res.json();
      if(!data.ok){
        if(res.status===409){ document.getElementById('mod_usuario').classList.add('error'); toast('⚠️ Ese nombre de usuario ya existe'); }
        else toast('❌ ' + data.mensaje);
        return;
      }
      agregarLog('Usuario creado', `${nombre} — ${cargoObj(cargo).label} — ${sala}`);
      toast(`✅ Usuario creado: ${nombre}`);
    }
    await cargarUsuarios();
    cerrarModal('modalUsuario');
    renderUsuarios();
  } catch(e) {
    toast('❌ Error conectando al servidor');
  }
}

async function toggleActivo(id){
  const u=usuarios.find(x=>x.id===id); if(!u) return;
  const nuevoEstado = !u.activo;
  try {
    const res  = await fetch(`${API}/usuarios/${id}/estado`, {
      method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ activo:nuevoEstado }),
    });
    const data = await res.json();
    if(!data.ok){ toast('❌ ' + data.mensaje); return; }
    u.activo = nuevoEstado;
    agregarLog(nuevoEstado?'Usuario activado':'Usuario desactivado', `${u.nombre} (${cargoObj(u.cargo).label})`);
    renderUsuarios();
    toast(`${nuevoEstado?'✅ Activado':'🔴 Desactivado'}: ${u.nombre}`);
  } catch(e) {
    toast('❌ Error conectando al servidor');
  }
}

function renderReportes(){
  const ventas=getVentas();
  const sel=salaReporte;
  let ventasFiltradas=ventas;
  if(sel!=='todas'){
    const asesoresSala=usuarios.filter(u=>u.sala===sel).map(u=>u.nombre);
    ventasFiltradas=ventas.filter(v=>asesoresSala.includes(v.asesor||v.vendedor||''));
  }
  const total    = ventasFiltradas.length;
  const validados= ventasFiltradas.filter(v=>['validado','instalado','programado'].includes(v.estado)).length;
  const caidas   = ventasFiltradas.filter(v=>v.estado==='caida').length;
  const conv     = total?Math.round(validados/total*100):0;
  document.getElementById('rep-total').textContent    = total;
  document.getElementById('rep-valid').textContent    = validados;
  document.getElementById('rep-caidas').textContent   = caidas;
  document.getElementById('rep-conv').textContent     = conv+'%';

  const ases = usuarios.filter(u=>sel==='todas'||u.sala===sel);
  const tbody=document.getElementById('tablaReporteBody');
  if(!ases.length){ tbody.innerHTML=`<tr><td colspan="6" class="tabla-empty">Sin asesores${sel!=='todas'?' en '+sel:''}.</td></tr>`; return; }

  const rendData=ases.map(a=>{
    const mis=ventasFiltradas.filter(v=>(v.asesor||v.vendedor||'')===a.nombre);
    const vents=mis.filter(v=>['validado','instalado','programado'].includes(v.estado)).length;
    const cai=mis.filter(v=>v.estado==='caida').length;
    const conv=mis.length?Math.round(vents/mis.length*100):0;
    return {...a,leads:mis.length,ventas:vents,caidas:cai,conv};
  }).sort((a,b)=>b.ventas-a.ventas);

  const max=Math.max(...rendData.map(r=>r.ventas),1);
  const pc=['🥇','🥈','🥉'];
  tbody.innerHTML=rendData.map((r,i)=>`<tr>
    <td><span style="font-size:16px">${pc[i]||i+1}</span></td>
    <td><div style="display:flex;align-items:center;gap:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:${colorAvatar(r.nombre)};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">${iniciales(r.nombre)}</div>
      <div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.sala||'—'}</div></div>
    </div></td>
    <td style="font-weight:700">${r.leads}</td>
    <td style="font-size:18px;font-weight:800;color:#111827">${r.ventas}</td>
    <td style="color:#dc2626;font-weight:600">${r.caidas}</td>
    <td><div style="display:flex;align-items:center;gap:8px;">
      <div style="height:5px;background:#e5e7eb;border-radius:99px;overflow:hidden;width:60px;"><div style="height:100%;background:#7C3AED;border-radius:99px;width:${Math.round(r.ventas/max*100)}%"></div></div>
      <span style="font-size:11px;color:#9ca3af">${r.conv}%</span>
    </div></td>
  </tr>`).join('');
}

function cambiarSalaReporte(sala, btn){
  salaReporte=sala;
  document.querySelectorAll('.sala-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderReportes();
}

function renderLogs(){
  const cont=document.getElementById('logsContainer');
  if(!logs.length){ cont.innerHTML=`<div style="text-align:center;color:#9ca3af;padding:32px;font-size:13px;">Sin actividad registrada.</div>`; return; }
  cont.innerHTML=logs.slice(0,50).map(l=>`
    <div class="log-item">
      <div class="log-dot" style="background:${l.color||'#7C3AED'}"></div>
      <div class="log-content">
        <div class="log-accion">${l.accion}${l.detalle?` <span style="color:#6b7280;font-weight:400">— ${l.detalle}</span>`:''}</div>
        <div class="log-meta"><span class="log-user">${l.usuario}</span> · ${formatF(l.fecha)} ${l.hora}</div>
      </div>
    </div>`).join('');
}

function renderAccesos(){
  const grid=document.getElementById('accesosGrid');
  const modulos=[
    {nombre:'Back Office',      desc:'Gestión de leads y asesores',  icon:'📋', url:'backoffice.html',  color:'#111827'},
    {nombre:'Validación',       desc:'Validar ventas del sistema',   icon:'✅', url:'validacion.html',  color:'#d97706'},
    {nombre:'Grabaciones',      desc:'Control de grabaciones',       icon:'🎙️',url:'grabaciones.html', color:'#16a34a'},
    {nombre:'Seguimiento',      desc:'Post-venta y estados',         icon:'📡', url:'seguimiento.html', color:'#0891b2'},
    {nombre:'Supervisor',       desc:'Portal de supervisores',       icon:'👔', url:'supervisor.html',  color:'#7C3AED'},
    {nombre:'Dashboard CRM',    desc:'Vista del asesor',             icon:'📊', url:'dashboard.html',   color:'#2563eb'},
    {nombre:'Gestión Usuarios', desc:'Crear y administrar usuarios', icon:'👥', url:'usuarios.html',    color:'#db2777'},
    {nombre:'Programación',     desc:'Ventas aprobadas por grabaciones', icon:'📅', url:'programacion.html', color:'#7C3AED'},
  ];
  grid.innerHTML=modulos.map(m=>`
    <a class="acceso-card" href="${m.url}">
      <div class="acceso-icon" style="background:${m.color}22">${m.icon}</div>
      <div class="acceso-nombre">${m.nombre}</div>
      <div class="acceso-desc">${m.desc}</div>
    </a>`).join('');
}

window.onload = async () => {
  await cargarUsuarios();
  cargarLogs();

  const selCargo=document.getElementById('mod_cargo');
  if(selCargo) selCargo.innerHTML='<option value="">— Seleccionar cargo —</option>'+CARGOS.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');

  const selSala=document.getElementById('mod_sala');
  if(selSala) selSala.innerHTML='<option value="">— Sin sala —</option>'+SALAS.map(s=>`<option value="${s}">${s}</option>`).join('');

  document.getElementById('modalUsuario')?.addEventListener('click',e=>{ if(e.target===document.getElementById('modalUsuario')) cerrarModal('modalUsuario'); });
  document.getElementById('busqUsuarios')?.addEventListener('input',e=>{ busqUsuarios=e.target.value; renderUsuarios(); });

  renderDashboard();
  agregarLog('Sesión iniciada','Panel de Jefatura');
};

/* ===== PERMISOS EXTRA (se inyecta en el modal via JS) ===== */
const PERMISOS_DISPONIBLES = [
  { id:'usuarios',    label:'Gestión de Usuarios' },
  { id:'backoffice',  label:'Back Office' },
  { id:'validacion',  label:'Validación' },
  { id:'grabaciones', label:'Grabaciones' },
  { id:'seguimiento', label:'Seguimiento' },
  { id:'supervisor',  label:'Supervisor' },
  { id:'jefatura',    label:'Jefatura' },
];

function renderPermisosModal(permisosActuales = []){
  const wrap = document.getElementById('permisosWrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <label style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;display:block;">
      Accesos adicionales
    </label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${PERMISOS_DISPONIBLES.map(p => `
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;
          background:#f9fafb;border:1px solid #e5e7eb;padding:4px 10px;border-radius:99px;">
          <input type="checkbox" value="${p.id}"
            ${permisosActuales.includes(p.id) ? 'checked' : ''}
            style="accent-color:#7C3AED;">
          ${p.label}
        </label>`).join('')}
    </div>`;
}

function getPermisosSeleccionados(){
  const checks = document.querySelectorAll('#permisosWrap input[type=checkbox]:checked');
  return Array.from(checks).map(c => c.value);
}