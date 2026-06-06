/* ================================================
   SUPERVISOR.JS — Módulo de Supervisores Netcontact
   Conectado a Node.js backend
   ================================================ */

const API_SUP = 'http://127.0.0.1:3000/api';

const ESTADOS_VENTA = [
  { id:'instalado',   label:'Instalado',     cls:'be-instalado',   color:'#16a34a', dot:'#16a34a' },
  { id:'programado',  label:'Programado',    cls:'be-programado',  color:'#2563eb', dot:'#2563eb' },
  { id:'noinstalado', label:'No instalado',  cls:'be-noinstalado', color:'#dc2626', dot:'#dc2626' },
  { id:'caida',       label:'Caida',         cls:'be-caida',       color:'#7f1d1d', dot:'#b91c1c' },
  { id:'pendiente',   label:'Pendiente',     cls:'be-pendiente',   color:'#d97706', dot:'#d97706' },
  { id:'ejecucion',   label:'En ejecucion',  cls:'be-ejecucion',   color:'#7C3AED', dot:'#7C3AED' },
  { id:'observado',   label:'Observado',     cls:'be-observado',   color:'#0891b2', dot:'#0891b2' },
  { id:'otro',        label:'Otro',          cls:'be-otro',        color:'#6b7280', dot:'#9ca3af' },
];

const TIPIF_COLORS = {
  'VENTA CERRADA':      '#16a34a',
  'PREVENTA':           '#2563eb',
  'AGENDADO':           '#7C3AED',
  'NO CONTESTA':        '#9ca3af',
  'CORTA LLAMADA':      '#f97316',
  'NO DESEA':           '#ef4444',
  'BUZON DE VOZ':       '#6b7280',
  'SERVICIO ACTIVO':    '#0891b2',
  'SIN COBERTURA':      '#dc2626',
  'NO CALIFICA':        '#d97706',
};

let salaActual       = 'SALA 1';
let supervisorNom    = '';
let periodoActual    = 'mes';
let frasesHoy        = [];
let chartInstances   = {};
let asesoresCache    = [];
let ventasCache      = [];
let ventasSupervisor = {};
let ventasIdCnt      = 1;

const COLORES_AV = ["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899","#f59e0b"];
function colorFor(name){ let s=0; for(const c of name) s+=c.charCodeAt(0); return COLORES_AV[s%COLORES_AV.length]; }
function iniciales(n){ return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function fechaHoy()  { return new Date().toISOString().split('T')[0]; }
function mesActual() { return new Date().toISOString().slice(0,7); }
function horaAhora() { return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); }
function formatF(f)  { if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function getMesLabel(offset=0){ const d=new Date(); d.setMonth(d.getMonth()-offset); return d.toLocaleString('es-PE',{month:'long',year:'numeric'}); }
function getMesClave(offset=0){ const d=new Date(); d.setMonth(d.getMonth()-offset); return d.toISOString().slice(0,7); }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3200); }
function estadoObj(id){ return ESTADOS_VENTA.find(e=>e.id===id)||ESTADOS_VENTA[ESTADOS_VENTA.length-1]; }
function badgeEstado(id){ const e=estadoObj(id); return `<span class="badge-estado ${e.cls}">${e.label}</span>`; }

function mapearEstadoSup(estado) {
  const e = (estado||'').toLowerCase();
  const map = {
    'venta':'pendiente','validado':'pendiente','grabado':'pendiente',
    'aprobado':'programado','programado':'programado','instalado':'instalado',
    'caida':'caida','rechazado':'noinstalado','observado':'observado',
  };
  return map[e] || 'otro';
}

async function cargarDatosBackend() {
  try {
    const [resU, resV] = await Promise.all([
      fetch(API_SUP + '/usuarios', { headers: ncHeaders() }),
      fetch(API_SUP + '/ventas',   { headers: ncHeaders() }),
    ]);
    const [dataU, dataV] = await Promise.all([resU.json(), resV.json()]);
    if (dataU.ok) asesoresCache = dataU.data.filter(u => u.cargo === 'asesor' && u.activo);
    if (dataV.ok) {
      ventasCache = dataV.data
        .filter(v => (v.estado||'').toLowerCase() !== '')
        .map(v => ({
          ...v,
          asesor:   v.asesor_nombre || '',
          n1:       v.telefono1     || '',
          n2:       v.telefono2     || '',
          campana:  v.paquete       || v.claro_hogar || '',
          distrito: v.distrito      || '',
          _fecha:   v.created_at ? v.created_at.split(' ')[0] : '',
          _hora:    v.created_at ? v.created_at.split(' ')[1] : '',
          horaAsig: v.created_at ? v.created_at.split(' ')[1] : '',
          _estado:  mapearEstadoSup(v.estado),
          _fuente:  'backend',
        }));
    }
  } catch(e) { console.error('Error cargando datos:', e); }
}

function getAllVentas() {
  return ventasCache.filter(v => !salaActual || (v.sala||'').toUpperCase() === salaActual.toUpperCase());
}
function getVentasBO()  { return []; }
function getVentasSup() { return []; }
function getAsesores(){ return asesoresCache; }
function getAsesoresSala(){ return getAsesores().filter(a=>!salaActual||a.sala===salaActual); }

function getUltimos7Dias(){
  const dias=[];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); dias.push(d.toISOString().split('T')[0]); }
  return dias;
}

function filtrarPeriodo(ventas){
  const hoy=fechaHoy(), mes=mesActual();
  const lun=(()=>{ const d=new Date(); const day=d.getDay(); const diff=d.getDate()-day+(day===0?-6:1); return new Date(d.setDate(diff)).toISOString().split('T')[0]; })();
  return ventas.filter(v=>{
    const f=v._fecha||'';
    if(periodoActual==='dia')    return f===hoy;
    if(periodoActual==='semana') return f>=lun&&f<=hoy;
    if(periodoActual==='mes')    return f.startsWith(mes);
    return true;
  });
}

function iniciarApp(){
  const sesion = ncGetSesion();
  salaActual    = sesion?.sala || 'SALA 1';
  supervisorNom = sesion?.nombre || 'Supervisor';
  document.getElementById('topbarSala').textContent = salaActual;
  document.getElementById('topbarUser').textContent = supervisorNom;
  poblarFiltros();
  poblarAgregarVentaSelects();
  renderSeccion('dashboard');
}

function showSection(id, btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  renderSeccion(id);
}

function renderSeccion(id){
  if(id==='dashboard')   renderDashboard();
  if(id==='ventas')      renderVentas();
  if(id==='rendimiento') renderRendimiento();
  if(id==='frases')      renderFrases();
  if(id==='equipo')      renderEquipo();
}

function setPeriodo(p, btn){
  periodoActual=p;
  document.querySelectorAll('.periodo-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderDashboard();
}

function renderDashboard(){
  const ventas  = filtrarPeriodo(getAllVentas());
  const asesores= getAsesoresSala();
  const total   = ventas.length;
  const porEstado = {};
  ESTADOS_VENTA.forEach(e=>{ porEstado[e.id]=ventas.filter(v=>(v._estado||'otro')===e.id).length; });
  const instalados=porEstado['instalado'], programados=porEstado['programado'], caidas=porEstado['caida'];
  const conv = total ? Math.round(instalados/total*100) : 0;

  document.getElementById('dashKpis').innerHTML = [
    {label:'Total ventas',val:total,cls:'k-blue',sub:periodoLabel()},
    {label:'Instaladas',val:instalados,cls:'k-green',sub:'completadas'},
    {label:'Programadas',val:programados,cls:'k-orange',sub:'por instalar'},
    {label:'Caidas',val:caidas,cls:'k-red',sub:'fallidas'},
    {label:'Conversion inst.',val:conv+'%',cls:'k-purple',sub:'instalado/total'},
    {label:'Asesores sala',val:asesores.length,cls:'k-teal',sub:salaActual},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');

  document.getElementById('estadosChips').innerHTML = ESTADOS_VENTA.map(e=>{
    const cnt=ventas.filter(v=>(v._estado||'otro')===e.id).length;
    return `<div class="estado-chip"><div class="chip-dot" style="background:${e.dot}"></div><span>${e.label}</span><span class="chip-num" style="color:${e.dot}">${cnt}</span></div>`;
  }).join('');

  const rendData = asesores.map(a=>{
    const mis=ventas.filter(v=>v.asesor===a.nombre);
    const inst=mis.filter(v=>(v._estado||'otro')==='instalado').length;
    return {nombre:a.nombre,usuario:a.usuario||'',total:mis.length,inst,conv:mis.length?Math.round(inst/mis.length*100):0};
  }).sort((a,b)=>b.total-a.total);

  const pc=['p1','p2','p3'];
  const tbody=document.getElementById('dashTablaBody');
  if(!asesores.length){ tbody.innerHTML=`<tr class="tabla-empty"><td colspan="5">No hay asesores en ${salaActual}.</td></tr>`; }
  else { tbody.innerHTML=rendData.map((r,i)=>`<tr>
    <td><div class="pos-badge ${pc[i]||''}">${i+1}</div></td>
    <td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>
    <td style="font-weight:700">${r.total}</td>
    <td style="color:#16a34a;font-weight:700">${r.inst}</td>
    <td><div class="bar-mini-wrap"><div class="bar-mini"><div class="bar-mini-fill" style="width:${r.conv}%"></div></div><span style="font-size:11px;color:#9ca3af">${r.conv}%</span></div></td>
  </tr>`).join(''); }

  const allVentas=getAllVentas();
  document.getElementById('comparativoGrid').innerHTML = [0,1,2].map(offset=>{
    const clave=getMesClave(offset);
    const cnt=allVentas.filter(v=>v._fecha&&v._fecha.startsWith(clave)).length;
    const prev=allVentas.filter(v=>v._fecha&&v._fecha.startsWith(getMesClave(offset+1))).length;
    const diff=cnt-prev;
    const diffClass=diff>0?'up':diff<0?'down':'eq';
    return `<div class="comp-card"><div class="comp-mes">${getMesLabel(offset)}</div><div class="comp-val">${cnt}</div><div class="comp-diff ${diffClass}">${diff>0?'↑':diff<0?'↓':'→'} ${Math.abs(diff)} vs mes anterior</div></div>`;
  }).join('');

  renderChartsDash(rendData, ventas);
}

function periodoLabel(){ if(periodoActual==='dia')return'hoy'; if(periodoActual==='semana')return'esta semana'; if(periodoActual==='mes')return'este mes'; return'historico'; }
function destroyChart(id){ if(chartInstances[id]){ chartInstances[id].destroy(); delete chartInstances[id]; } }

function renderChartsDash(rendData, ventas){
  const nombres=rendData.map(r=>r.nombre.split(' ')[0]);
  const colores=rendData.map(r=>colorFor(r.nombre));
  destroyChart('ch1');
  const c1=document.getElementById('ch1');
  if(c1) chartInstances.ch1=new Chart(c1,{type:'bar',data:{labels:nombres,datasets:[{label:'Ventas',data:rendData.map(r=>r.total),backgroundColor:colores,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}}});
  destroyChart('ch2');
  const c2=document.getElementById('ch2');
  if(c2){ const ed=ESTADOS_VENTA.map(e=>({label:e.label,cnt:ventas.filter(v=>(v._estado||'otro')===e.id).length,color:e.dot})).filter(e=>e.cnt>0); if(ed.length) chartInstances.ch2=new Chart(c2,{type:'doughnut',data:{labels:ed.map(e=>e.label),datasets:[{data:ed.map(e=>e.cnt),backgroundColor:ed.map(e=>e.color),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11},boxWidth:12}}}}}); }
  destroyChart('ch3');
  const c3=document.getElementById('ch3');
  if(c3){ const dias7=getUltimos7Dias(); const allV=getAllVentas(); const asesores=getAsesoresSala(); const datasets=asesores.map(a=>({label:a.nombre.split(' ')[0],data:dias7.map(d=>allV.filter(v=>v.asesor===a.nombre&&v._fecha===d).length),borderColor:colorFor(a.nombre),backgroundColor:colorFor(a.nombre)+'22',fill:true,tension:0.4,borderWidth:2,pointRadius:4})); chartInstances.ch3=new Chart(c3,{type:'line',data:{labels:dias7.map(d=>formatF(d)),datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}}}); }
  destroyChart('ch4');
  const c4=document.getElementById('ch4');
  if(c4&&rendData.length) chartInstances.ch4=new Chart(c4,{type:'bar',data:{labels:nombres,datasets:[{label:'Conversion %',data:rendData.map(r=>r.conv),backgroundColor:rendData.map(r=>colorFor(r.nombre)+'aa'),borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#f3f4f6'}},y:{grid:{display:false}}}}});
}

function poblarFiltros(){
  const selA=document.getElementById('filtroAsesor');
  if(selA){ selA.innerHTML='<option value="">Todos</option>'; getAsesoresSala().forEach(a=>selA.innerHTML+=`<option value="${a.nombre}">${a.nombre}</option>`); }
  const selE=document.getElementById('filtroEstado');
  if(selE){ selE.innerHTML='<option value="">Todos</option>'; ESTADOS_VENTA.forEach(e=>selE.innerHTML+=`<option value="${e.id}">${e.label}</option>`); }
}

function poblarAgregarVentaSelects(){
  const selA=document.getElementById('nv_asesor');
  if(selA){ selA.innerHTML='<option value="">— Seleccionar asesor —</option>'; getAsesoresSala().forEach(a=>selA.innerHTML+=`<option value="${a.nombre}">${a.nombre}</option>`); }
  const selE=document.getElementById('nv_estado');
  if(selE){ selE.innerHTML='<option value="">— Estado —</option>'; ESTADOS_VENTA.forEach(e=>selE.innerHTML+=`<option value="${e.id}">${e.label}</option>`); }
}

let tablaSearchVal = '';

function renderVentas(){
  let ventas=getAllVentas();
  const fa=document.getElementById('filtroAsesor')?.value||'';
  const fe=document.getElementById('filtroEstado')?.value||'';
  const fd=document.getElementById('filtroDesde')?.value||'';
  const fh=document.getElementById('filtroHasta')?.value||'';
  if(fa) ventas=ventas.filter(v=>v.asesor===fa);
  if(fe) ventas=ventas.filter(v=>(v._estado||'otro')===fe);
  if(fd) ventas=ventas.filter(v=>v._fecha>=fd);
  if(fh) ventas=ventas.filter(v=>v._fecha<=fh);
  if(tablaSearchVal) ventas=ventas.filter(v=>v.n1?.includes(tablaSearchVal)||(v.n2||'').includes(tablaSearchVal)||(v.asesor||'').toLowerCase().includes(tablaSearchVal.toLowerCase()));
  if(!fd&&!fh){ const mes=mesActual(); if(!fa&&!fe&&!tablaSearchVal) ventas=ventas.filter(v=>v._fecha&&v._fecha.startsWith(mes)); }
  ventas.sort((a,b)=>(b._fecha+b.horaAsig||'').localeCompare(a._fecha+a.horaAsig||''));
  document.getElementById('ventasCount').textContent=`${ventas.length} registro${ventas.length!==1?'s':''}`;
  document.getElementById('ventasStatTotal').textContent=ventas.length;
  ESTADOS_VENTA.forEach(e=>{ const el=document.getElementById('vstat_'+e.id); if(el) el.textContent=ventas.filter(v=>(v._estado||'otro')===e.id).length; });
  const tbody=document.getElementById('ventasTablaBody');
  if(!ventas.length){ tbody.innerHTML=`<tr class="tabla-empty"><td colspan="9">Sin ventas con esos filtros.</td></tr>`; return; }
  tbody.innerHTML=ventas.map((v,i)=>`<tr>
    <td style="color:#9ca3af;font-size:10px">${i+1}</td>
    <td style="font-weight:600;color:#185FA5;font-size:11px">${formatF(v._fecha)}</td>
    <td style="font-family:monospace;font-weight:700;color:#111827">${v.n1||'—'}</td>
    <td style="font-family:monospace;color:#6b7280">${v.n2||'—'}</td>
    <td><strong>${v.campana||'—'}</strong></td>
    <td style="font-size:11px">${v.distrito||'—'}</td>
    <td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(v.asesor||'X')};width:24px;height:24px;font-size:9px">${iniciales(v.asesor||'?')}</div><span style="font-size:12px;font-weight:600">${v.asesor||'—'}</span></div></td>
    <td>${badgeEstado(v._estado||'otro')}</td>
    <td style="font-size:11px;color:#6b7280">${v.horaAsig||v._hora||'—'}</td>
  </tr>`).join('');
}

function limpiarFiltrosVentas(){
  ['filtroAsesor','filtroEstado','filtroDesde','filtroHasta'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  tablaSearchVal=''; const ts=document.getElementById('tablaSearch'); if(ts) ts.value='';
  renderVentas();
}

function agregarVentaManual(){
  const n1=document.getElementById('nv_n1').value.trim();
  if(!n1){ toast('El N1 es obligatorio'); document.getElementById('nv_n1').style.borderColor='#ef4444'; return; }
  document.getElementById('nv_n1').style.borderColor='';
  const asesor=document.getElementById('nv_asesor').value;
  if(!asesor){ toast('Selecciona un asesor'); return; }
  const estado=document.getElementById('nv_estado').value||'programado';
  const fecha=document.getElementById('nv_fecha').value||fechaHoy();
  const campana=document.getElementById('nv_campana').value.trim()||'—';
  const n2=document.getElementById('nv_n2').value.trim();
  const obs=document.getElementById('nv_obs').value.trim();
  if(!ventasSupervisor[fecha]) ventasSupervisor[fecha]=[];
  ventasSupervisor[fecha].push({id:ventasIdCnt++,n1,n2,campana,asesor,_estado:estado,_hora:horaAhora(),horaAsig:horaAhora(),_obs:obs});
  ['nv_n1','nv_n2','nv_campana','nv_obs'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('nv_fecha').value=fechaHoy();
  document.getElementById('nv_asesor').value='';
  document.getElementById('nv_estado').value='';
  document.getElementById('panelAgregarVenta').style.display='none';
  renderVentas(); renderDashboard();
  toast(`Venta registrada: ${n1}`);
}

function renderRendimiento(){
  const allVentas=getAllVentas(); const asesores=getAsesoresSala();
  document.getElementById('rendAsesoresCards').innerHTML=asesores.length
    ? asesores.map(a=>{ const mv=allVentas.filter(v=>v.asesor===a.nombre); const inst=mv.filter(v=>(v._estado||'otro')==='instalado').length; const prog=mv.filter(v=>(v._estado||'otro')==='programado').length; const conv=mv.length?Math.round(inst/mv.length*100):0; return `<div class="asesor-card"><div class="ac-avatar" style="background:${colorFor(a.nombre)}">${iniciales(a.nombre)}</div><div class="ac-nombre">${a.nombre}</div><div class="ac-sala">${a.sala} - ${a.usuario||''}</div><div class="ac-stats"><div class="ac-stat"><div class="ac-stat-num">${mv.length}</div><div class="ac-stat-label">Total</div></div><div class="ac-stat"><div class="ac-stat-num" style="color:#16a34a">${inst}</div><div class="ac-stat-label">Inst.</div></div><div class="ac-stat"><div class="ac-stat-num" style="color:#2563eb">${prog}</div><div class="ac-stat-label">Prog.</div></div><div class="ac-stat"><div class="ac-stat-num" style="color:#d97706">${mv.filter(v=>(v._estado||'otro')==='caida').length}</div><div class="ac-stat-label">Caidas</div></div></div><div class="ac-conv"><span class="ac-conv-label">Conversion</span><span class="ac-conv-val">${conv}%</span></div></div>`; }).join('')
    : `<div style="text-align:center;color:#9ca3af;padding:40px;grid-column:1/-1">No hay asesores en ${salaActual}.</div>`;
  const meses=[0,1,2].map(o=>getMesClave(o));
  const rendTablaData=asesores.map(a=>({nombre:a.nombre,usuario:a.usuario||'',meses:meses.map(m=>allVentas.filter(v=>v.asesor===a.nombre&&v._fecha&&v._fecha.startsWith(m)).length)}));
  const tbody=document.getElementById('rendTablaBody');
  if(!asesores.length){ tbody.innerHTML=`<tr class="tabla-empty"><td colspan="6">Sin asesores en ${salaActual}</td></tr>`; }
  else{ tbody.innerHTML=rendTablaData.map((r,i)=>{ const pc=['p1','p2','p3']; const total=r.meses.reduce((s,v)=>s+v,0); return `<tr><td><div class="pos-badge ${pc[i]||''}">${i+1}</div></td><td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>${r.meses.map((cnt,mi)=>`<td style="font-weight:${mi===0?800:400};color:${mi===0?'#111827':'#6b7280'}">${cnt}</td>`).join('')}<td style="font-weight:800;color:#7C3AED">${total}</td></tr>`; }).join(''); }
}

async function enviarFrase(){
  const texto=document.getElementById('fraseTexto').value.trim();
  if(!texto){ toast('Escribe una frase primero'); return; }
  try {
    const res=await fetch(API_SUP+'/frases',{method:'POST',headers:ncHeaders(),body:JSON.stringify({texto,sala:salaActual})});
    const data=await res.json();
    if(data.ok){ document.getElementById('fraseTexto').value=''; frasesHoy.unshift({texto,hora:horaAhora(),sala:salaActual}); renderFrasesHistorial(); toast('Frase publicada para '+salaActual); }
    else toast('Error: '+data.mensaje);
  } catch(e){ toast('Error conectando al servidor'); }
}

async function cargarFrasesBackend(){
  try {
    const url=salaActual?`${API_SUP}/frases?sala=${encodeURIComponent(salaActual)}`:`${API_SUP}/frases`;
    const res=await fetch(url,{headers:ncHeaders()});
    const data=await res.json();
    if(data.ok&&data.data?.length){ frasesHoy=data.data.map(f=>({texto:f.texto,hora:f.created_at?.split(' ')[1]||'',sala:f.sala||salaActual})); renderFrasesHistorial(); }
  } catch(e){}
}

function renderFrases(){ cargarFrasesBackend(); renderFrasesHistorial(); }
function renderFrasesHistorial(){
  const cnt=document.getElementById('frasesCount'); if(cnt) cnt.textContent=frasesHoy.length;
  const el=document.getElementById('frasesHistorial'); if(!el) return;
  if(!frasesHoy.length){ el.innerHTML=`<div class="frase-vacia">Aun no publicaste ninguna frase hoy.</div>`; return; }
  el.innerHTML=`<div class="frases-historial">`+frasesHoy.map(f=>`<div class="frase-item"><div class="frase-item-texto">"${f.texto}"</div><div class="frase-item-meta">${f.sala} - ${f.hora}</div></div>`).join('')+`</div>`;
}

/* ===== MI EQUIPO ===== */
function renderEquipo(){
  const asesores=getAsesoresSala();
  const buscar=(document.getElementById('equipoBuscar')?.value||'').toLowerCase();
  const filtroEst=document.getElementById('equipoFiltroEstado')?.value||'';
  const hoy=fechaHoy(); const allV=getAllVentas();
  const activos=asesores.filter(a=>a.activo).length;
  const ventasHoy=allV.filter(v=>v._fecha===hoy).length;
  const kTotal=document.getElementById('equipoTotal');    if(kTotal)  kTotal.textContent=asesores.length;
  const kAct=document.getElementById('equipoActivos');    if(kAct)    kAct.textContent=activos;
  const kInact=document.getElementById('equipoInactivos');if(kInact)  kInact.textContent=asesores.length-activos;
  const kVH=document.getElementById('equipoVentasHoy');  if(kVH)     kVH.textContent=ventasHoy;
  const kSala=document.getElementById('equipoSalaLabel');if(kSala)   kSala.textContent=salaActual;
  const sub=document.getElementById('equipoSubtitle');   if(sub)     sub.textContent='Asesores activos en '+salaActual;

  let lista=asesores.filter(a=>{
    const matchBuscar=!buscar||a.nombre.toLowerCase().includes(buscar)||(a.usuario||'').toLowerCase().includes(buscar);
    const matchEst=filtroEst===''||String(a.activo?1:0)===filtroEst;
    return matchBuscar&&matchEst;
  });

  const cont=document.getElementById('equipoCards'); if(!cont) return;
  if(!lista.length){ cont.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9ca3af;">No hay asesores con esos filtros.</div>'; return; }

  cont.innerHTML=lista.map(a=>{
    const misV=allV.filter(v=>v.asesor===a.nombre);
    const hoyV=misV.filter(v=>v._fecha===hoy).length;
    const mesV=misV.filter(v=>v._fecha&&v._fecha.startsWith(mesActual())).length;
    const inst=misV.filter(v=>(v._estado||'otro')==='instalado').length;
    const conv=misV.length?Math.round(inst/misV.length*100):0;
    const actBadge=a.activo
      ?'<span style="background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;">ACTIVO</span>'
      :'<span style="background:#fee2e2;color:#991b1b;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;">INACTIVO</span>';
    const nombreEsc=a.nombre.replace(/'/g,"\\'");
    const asesorId=a.id||'';
    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:44px;height:44px;border-radius:50%;background:${colorFor(a.nombre)};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;">${iniciales(a.nombre)}</div>
          <div><div style="font-size:13px;font-weight:700;color:#111827;">${a.nombre}</div><div style="font-size:11px;color:#9ca3af;">@${a.usuario||'—'}</div></div>
        </div>${actBadge}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#111827">${hoyV}</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Hoy</div></div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#2563eb">${mesV}</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Mes</div></div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#16a34a">${inst}</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Inst.</div></div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#7C3AED">${conv}%</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Conv.</div></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid #f3f4f6;">
        <span style="font-size:11px;color:#9ca3af;">${a.sala||'—'}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="abrirBaseLlamadas('${nombreEsc}',${asesorId})"
            style="padding:6px 12px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;">
            📞 Base llamadas
          </button>
          <button onclick="abrirDetalleAsesor('${nombreEsc}')"
            style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;">
            Ver detalle
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ===== MODAL BASE DE LLAMADAS ===== */
async function abrirBaseLlamadas(nombre, asesorId){
  // Crear modal si no existe
  let modal = document.getElementById('modalBaseLlamadas');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalBaseLlamadas';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:18px;width:100%;max-width:900px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="padding:20px 24px 16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:16px;font-weight:800;color:#111827;" id="blNombre">Base de llamadas</div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;" id="blSub"></div>
          </div>
          <button onclick="cerrarBaseLlamadas()" style="width:32px;height:32px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <!-- Filtro fecha -->
        <div style="padding:12px 24px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label style="font-size:12px;font-weight:600;color:#374151;">Fecha:</label>
          <input type="date" id="blFecha" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;font-family:inherit;"
            onchange="filtrarBaseLlamadas()">
          <button onclick="blFechaHoy()" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;">Hoy</button>
          <span id="blContador" style="font-size:12px;color:#9ca3af;margin-left:auto;"></span>
        </div>
        <!-- KPIs rápidos -->
        <div id="blKpis" style="padding:12px 24px;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid #f3f4f6;"></div>
        <!-- Tabla -->
        <div style="flex:1;overflow:auto;padding:0 24px 20px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="position:sticky;top:0;background:#f9fafb;z-index:1;">
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">#</th>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">Teléfono N1</th>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">N2</th>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">Zona / Distrito</th>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">Campaña</th>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">Hora asig.</th>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #e5e7eb;">Tipificación</th>
              </tr>
            </thead>
            <tbody id="blTablaBody">
              <tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af;">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) cerrarBaseLlamadas(); });
  }

  // Guardar asesor activo
  modal._asesorId   = asesorId;
  modal._asesorNombre = nombre;

  document.getElementById('blNombre').textContent = '📞 Base de llamadas — ' + nombre;
  document.getElementById('blSub').textContent    = 'Solo lectura — supervisor';

  // Fecha por defecto: hoy
  const fechaInput = document.getElementById('blFecha');
  if (!fechaInput.value) fechaInput.value = fechaHoy();

  modal.style.display = 'flex';
  await cargarLeadsAsesor(asesorId);
}

let _leadsCache = [];

async function cargarLeadsAsesor(asesorId){
  const tbody = document.getElementById('blTablaBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af;">Cargando...</td></tr>';
  try {
    const fecha = document.getElementById('blFecha')?.value || '';
    let url = `${API_SUP}/leads?asesor_id=${asesorId}`;
    if (fecha) url += `&fecha=${fecha}`;
    const res  = await fetch(url, { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      _leadsCache = data.data;
      renderBaseLlamadas(_leadsCache);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444;">Error cargando leads.</td></tr>';
    }
  } catch(e) {
    document.getElementById('blTablaBody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444;">Error conectando al servidor.</td></tr>';
  }
}

function renderBaseLlamadas(leads){
  const tbody = document.getElementById('blTablaBody');
  const cont  = document.getElementById('blContador');
  if(cont) cont.textContent = leads.length + ' registros';

  // KPIs rápidos
  const kpiEl = document.getElementById('blKpis');
  if(kpiEl){
    const tipifs = {};
    leads.forEach(l => {
      const t = (l.tipif_back||l.tipif_vend||'Sin tipificar').toUpperCase();
      tipifs[t] = (tipifs[t]||0)+1;
    });
    const total = leads.length;
    const tipificados = leads.filter(l=>(l.tipif_back||l.tipif_vend||'').trim()!=='').length;
    const ventas = leads.filter(l=>(l.tipif_back||'').toUpperCase().includes('VENTA')).length;
    kpiEl.innerHTML = [
      {label:'Total leads', val:total,        color:'#2563eb'},
      {label:'Tipificados', val:tipificados,   color:'#16a34a'},
      {label:'Sin tipificar',val:total-tipificados, color:'#9ca3af'},
      {label:'Ventas',      val:ventas,        color:'#7C3AED'},
    ].map(k=>`<div style="background:#f9fafb;border-radius:10px;padding:10px 16px;display:flex;flex-direction:column;gap:2px;min-width:100px;">
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.3px;">${k.label}</div>
    </div>`).join('');
  }

  if(!leads.length){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af;">Sin leads para esta fecha.</td></tr>';
    return;
  }

  tbody.innerHTML = leads.map((l,i) => {
    const tipif = (l.tipif_back||l.tipif_vend||'').trim();
    const color = TIPIF_COLORS[tipif.toUpperCase()] || '#9ca3af';
    const tipifBadge = tipif
      ? `<span style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">${tipif}</span>`
      : `<span style="color:#d1d5db;font-size:11px;font-style:italic;">Sin tipificar</span>`;
    const esVenta = tipif.toUpperCase().includes('VENTA');
    return `<tr style="border-bottom:1px solid #f3f4f6;${esVenta?'background:#f0fdf4;':''}">
      <td style="padding:8px;color:#9ca3af;font-size:10px;">${i+1}</td>
      <td style="padding:8px;font-family:monospace;font-weight:700;color:#111827;font-size:13px;">${l.n1||'—'}</td>
      <td style="padding:8px;font-family:monospace;color:#6b7280;font-size:12px;">${l.n2||'—'}</td>
      <td style="padding:8px;font-size:11px;color:#374151;">${l.distrito||l.campana||'—'}</td>
      <td style="padding:8px;font-size:11px;color:#374151;">${l.campana||'—'}</td>
      <td style="padding:8px;font-size:11px;color:#6b7280;font-family:monospace;">${l.hora_asig||'—'}</td>
      <td style="padding:8px;">${tipifBadge}</td>
    </tr>`;
  }).join('');
}

async function filtrarBaseLlamadas(){
  const modal = document.getElementById('modalBaseLlamadas');
  if(!modal) return;
  await cargarLeadsAsesor(modal._asesorId);
}

function blFechaHoy(){
  const inp = document.getElementById('blFecha');
  if(inp){ inp.value = fechaHoy(); filtrarBaseLlamadas(); }
}

function cerrarBaseLlamadas(){
  const modal = document.getElementById('modalBaseLlamadas');
  if(modal) modal.style.display='none';
  _leadsCache = [];
}

/* ===== MODAL DETALLE ASESOR ===== */
function abrirDetalleAsesor(nombre){
  const modal=document.getElementById('modalAsesor');
  const body=document.getElementById('modalAsesorBody');
  if(!modal||!body) return;
  const a=getAsesoresSala().find(x=>x.nombre===nombre); if(!a) return;
  const allV=getAllVentas();
  const misV=allV.filter(v=>v.asesor===nombre);
  const hoy=fechaHoy();
  const hoyV=misV.filter(v=>v._fecha===hoy);
  const mesV=misV.filter(v=>v._fecha&&v._fecha.startsWith(mesActual()));
  const inst=misV.filter(v=>(v._estado||'otro')==='instalado').length;
  const conv=misV.length?Math.round(inst/misV.length*100):0;
  const ultimas=[...misV].sort((a,b)=>b._fecha.localeCompare(a._fecha)).slice(0,5);
  body.innerHTML=
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">'+
      '<div style="width:60px;height:60px;border-radius:50%;background:'+colorFor(nombre)+';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;">'+iniciales(nombre)+'</div>'+
      '<div><div style="font-size:16px;font-weight:800;color:#111827;">'+nombre+'</div><div style="font-size:12px;color:#9ca3af;margin-top:2px;">@'+(a.usuario||'—')+' - '+(a.sala||'—')+'</div>'+
      '<div style="margin-top:6px;">'+(a.activo?'<span style="background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;">ACTIVO</span>':'<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;">INACTIVO</span>')+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">'+
      '<div style="background:#f9fafb;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#111827">'+hoyV.length+'</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-top:3px;">Hoy</div></div>'+
      '<div style="background:#f9fafb;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#2563eb">'+mesV.length+'</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-top:3px;">Este mes</div></div>'+
      '<div style="background:#f9fafb;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#16a34a">'+inst+'</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-top:3px;">Instaladas</div></div>'+
      '<div style="background:#f9fafb;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#7C3AED">'+conv+'%</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-top:3px;">Conversion</div></div>'+
    '</div>'+
    '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.3px;">Ultimas ventas</div>'+
    (ultimas.length
      ?'<div style="display:flex;flex-direction:column;gap:6px;">'+ultimas.map(v=>'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;"><div><span style="font-family:monospace;font-weight:700;font-size:12px;color:#111827;">'+v.n1+'</span><span style="font-size:11px;color:#9ca3af;margin-left:8px;">'+(v.campana||'—')+'</span></div><div style="display:flex;align-items:center;gap:8px;">'+badgeEstado(v._estado||'otro')+'<span style="font-size:11px;color:#9ca3af;">'+formatF(v._fecha)+'</span></div></div>').join('')+'</div>'
      :'<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">Sin ventas registradas.</div>');
  modal.style.display='flex';
}

function cerrarModalAsesor(){ const m=document.getElementById('modalAsesor'); if(m) m.style.display='none'; }
function exportarExcel(){ toast('Exportacion a Excel — proximamente'); }
function exportarPDF(){ toast('Exportacion a PDF — proximamente'); }

window.onload = async ()=>{
  await cargarDatosBackend();
  iniciarApp();
  setInterval(async()=>{
    await cargarDatosBackend();
    const sec=document.querySelector('.section.active');
    if(sec) renderSeccion(sec.id.replace('sec-',''));
  }, 30000);
};