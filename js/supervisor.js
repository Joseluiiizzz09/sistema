/* ================================================
   SUPERVISOR.JS — Módulo de Supervisores Netcontact
   Conectado a Node.js backend
   ================================================ */

const API_SUP = 'http://127.0.0.1:3000/api';

const ESTADOS_VENTA = [
  { id:'instalado',   label:'Instalado',     cls:'be-instalado',   color:'#16a34a', dot:'#16a34a' },
  { id:'programado',  label:'Programado',    cls:'be-programado',  color:'#2563eb', dot:'#2563eb' },
  { id:'noinstalado', label:'No instalado',  cls:'be-noinstalado', color:'#dc2626', dot:'#dc2626' },
  { id:'caida',       label:'Caída',         cls:'be-caida',       color:'#7f1d1d', dot:'#b91c1c' },
  { id:'pendiente',   label:'Pendiente',     cls:'be-pendiente',   color:'#d97706', dot:'#d97706' },
  { id:'ejecucion',   label:'En ejecución',  cls:'be-ejecucion',   color:'#7C3AED', dot:'#7C3AED' },
  { id:'observado',   label:'Observado',     cls:'be-observado',   color:'#0891b2', dot:'#0891b2' },
  { id:'otro',        label:'Otro',          cls:'be-otro',        color:'#6b7280', dot:'#9ca3af' },
];

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

async function cargarDatosBackend() {
  try {
    const [resU, resV] = await Promise.all([
      fetch(API_SUP + '/usuarios', { headers: ncHeaders() }),
      fetch(API_SUP + '/ventas',   { headers: ncHeaders() }),
    ]);
    const [dataU, dataV] = await Promise.all([resU.json(), resV.json()]);
    if (dataU.ok) asesoresCache = dataU.data.filter(u => u.cargo === 'asesor' && u.activo);
    if (dataV.ok) ventasCache   = dataV.data;
  } catch(e) { console.error('Error cargando datos:', e); }
}

function getBaseData(){
  try{ const r=localStorage.getItem('bo_baseData'); if(r) return JSON.parse(r); }catch(e){}
  return {};
}
function getAsesores(){ return asesoresCache.length ? asesoresCache : []; }
function getAsesoresSala(){ return getAsesores().filter(a=>!salaActual||a.sala===salaActual); }

function getVentasBO(){
  const asNombres=getAsesoresSala().map(a=>a.nombre);
  const bd=getBaseData(); const lista=[];
  for(const f in bd){
    (bd[f]||[]).forEach(r=>{
      if(asNombres.includes(r.asesor) && (r.tipifBack||'').toUpperCase().includes('VENTA'))
        lista.push({...r, _fecha:f, _fuente:'bo'});
    });
  }
  return lista;
}

function getVentasSup(){
  const lista=[];
  for(const f in ventasSupervisor){ (ventasSupervisor[f]||[]).forEach(v=>lista.push({...v,_fecha:f,_fuente:'sup'})); }
  return lista;
}

function getAllVentas(){ return [...getVentasBO(), ...getVentasSup()]; }

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
    if(periodoActual==='semana') return f>=lun && f<=hoy;
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
  const maxVentas = Math.max(...asesores.map(a=>ventas.filter(v=>v.asesor===a.nombre).length),1);

  const porEstado = {};
  ESTADOS_VENTA.forEach(e=>{ porEstado[e.id]=ventas.filter(v=>(v._estado||'otro')===e.id).length; });
  const instalados  = porEstado['instalado'];
  const programados = porEstado['programado'];
  const caidas      = porEstado['caida'];
  const conv = total ? Math.round(instalados/total*100) : 0;

  document.getElementById('dashKpis').innerHTML = [
    {label:'Total ventas',val:total,cls:'k-blue',sub:periodoLabel()},
    {label:'Instaladas',val:instalados,cls:'k-green',sub:'completadas'},
    {label:'Programadas',val:programados,cls:'k-orange',sub:'por instalar'},
    {label:'Caídas',val:caidas,cls:'k-red',sub:'fallidas'},
    {label:'Conversión inst.',val:conv+'%',cls:'k-purple',sub:'instalado/total'},
    {label:'Asesores sala',val:asesores.length,cls:'k-teal',sub:salaActual},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');

  document.getElementById('estadosChips').innerHTML = ESTADOS_VENTA.map(e=>{
    const cnt = ventas.filter(v=>(v._estado||'otro')===e.id).length;
    return `<div class="estado-chip"><div class="chip-dot" style="background:${e.dot}"></div><span>${e.label}</span><span class="chip-num" style="color:${e.dot}">${cnt}</span></div>`;
  }).join('');

  const rendData = asesores.map(a=>{
    const mis = ventas.filter(v=>v.asesor===a.nombre);
    const inst = mis.filter(v=>(v._estado||'otro')==='instalado').length;
    return {nombre:a.nombre, usuario:a.usuario||'', total:mis.length, inst, conv:mis.length?Math.round(inst/mis.length*100):0};
  }).sort((a,b)=>b.total-a.total);

  const pc=['p1','p2','p3'];
  const tbody=document.getElementById('dashTablaBody');
  if(!asesores.length){
    tbody.innerHTML=`<tr class="tabla-empty"><td colspan="5">No hay asesores en ${salaActual}.</td></tr>`;
  } else {
    tbody.innerHTML=rendData.map((r,i)=>`<tr>
      <td><div class="pos-badge ${pc[i]||''}">${i+1}</div></td>
      <td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>
      <td style="font-weight:700">${r.total}</td>
      <td style="color:#16a34a;font-weight:700">${r.inst}</td>
      <td><div class="bar-mini-wrap"><div class="bar-mini"><div class="bar-mini-fill" style="width:${r.conv}%"></div></div><span style="font-size:11px;color:#9ca3af">${r.conv}%</span></div></td>
    </tr>`).join('');
  }

  const allVentas=getAllVentas();
  document.getElementById('comparativoGrid').innerHTML = [0,1,2].map(offset=>{
    const clave=getMesClave(offset);
    const cnt=allVentas.filter(v=>v._fecha&&v._fecha.startsWith(clave)).length;
    const prev=allVentas.filter(v=>v._fecha&&v._fecha.startsWith(getMesClave(offset+1))).length;
    const diff=cnt-prev;
    const diffClass=diff>0?'up':diff<0?'down':'eq';
    const diffIcon=diff>0?'↑':diff<0?'↓':'→';
    return `<div class="comp-card"><div class="comp-mes">${getMesLabel(offset)}</div><div class="comp-val">${cnt}</div><div class="comp-diff ${diffClass}">${diffIcon} ${Math.abs(diff)} vs mes anterior</div></div>`;
  }).join('');

  renderChartsDash(rendData, ventas);
}

function periodoLabel(){ if(periodoActual==='dia')return'hoy'; if(periodoActual==='semana')return'esta semana'; if(periodoActual==='mes')return'este mes'; return'histórico'; }

function destroyChart(id){ if(chartInstances[id]){ chartInstances[id].destroy(); delete chartInstances[id]; } }

function renderChartsDash(rendData, ventas){
  const nombres = rendData.map(r=>r.nombre.split(' ')[0]);
  const colores = rendData.map(r=>colorFor(r.nombre));

  destroyChart('ch1');
  const c1=document.getElementById('ch1');
  if(c1) chartInstances.ch1=new Chart(c1,{ type:'bar', data:{labels:nombres,datasets:[{label:'Ventas',data:rendData.map(r=>r.total),backgroundColor:colores,borderRadius:6}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}} });

  destroyChart('ch2');
  const c2=document.getElementById('ch2');
  if(c2){
    const estadoData=ESTADOS_VENTA.map(e=>({label:e.label,cnt:ventas.filter(v=>(v._estado||'otro')===e.id).length,color:e.dot})).filter(e=>e.cnt>0);
    if(estadoData.length){ chartInstances.ch2=new Chart(c2,{ type:'doughnut', data:{labels:estadoData.map(e=>e.label),datasets:[{data:estadoData.map(e=>e.cnt),backgroundColor:estadoData.map(e=>e.color),borderWidth:2,borderColor:'#fff'}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11},boxWidth:12}}}} }); }
  }

  destroyChart('ch3');
  const c3=document.getElementById('ch3');
  if(c3){
    const dias7=getUltimos7Dias();
    const allVentas=getAllVentas();
    const asesores=getAsesoresSala();
    const datasets=asesores.map(a=>({label:a.nombre.split(' ')[0],data:dias7.map(d=>allVentas.filter(v=>v.asesor===a.nombre&&v._fecha===d).length),borderColor:colorFor(a.nombre),backgroundColor:colorFor(a.nombre)+'22',fill:true,tension:0.4,borderWidth:2,pointRadius:4}));
    chartInstances.ch3=new Chart(c3,{ type:'line', data:{labels:dias7.map(d=>formatF(d)),datasets}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}} });
  }

  destroyChart('ch4');
  const c4=document.getElementById('ch4');
  if(c4&&rendData.length){ chartInstances.ch4=new Chart(c4,{ type:'bar', data:{labels:nombres,datasets:[{label:'Conversión %',data:rendData.map(r=>r.conv),backgroundColor:rendData.map(r=>colorFor(r.nombre)+'aa'),borderRadius:6}]}, options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#f3f4f6'}},y:{grid:{display:false}}}} }); }
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
  if(!n1){ toast('⚠️ El N1 es obligatorio'); document.getElementById('nv_n1').style.borderColor='#ef4444'; return; }
  document.getElementById('nv_n1').style.borderColor='';
  const asesor=document.getElementById('nv_asesor').value;
  if(!asesor){ toast('⚠️ Selecciona un asesor'); return; }
  const estado=document.getElementById('nv_estado').value||'programado';
  const fecha=document.getElementById('nv_fecha').value||fechaHoy();
  const campana=document.getElementById('nv_campana').value.trim()||'—';
  const n2=document.getElementById('nv_n2').value.trim();
  const obs=document.getElementById('nv_obs').value.trim();
  if(!ventasSupervisor[fecha]) ventasSupervisor[fecha]=[];
  ventasSupervisor[fecha].push({ id:ventasIdCnt++, n1, n2, campana, asesor, _estado:estado, _hora:horaAhora(), horaAsig:horaAhora(), tipifBack:'VENTA CERRADA', _obs:obs, sinAsignar:false, rotaciones:0 });
  ['nv_n1','nv_n2','nv_campana','nv_obs'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('nv_fecha').value=fechaHoy();
  document.getElementById('nv_asesor').value='';
  document.getElementById('nv_estado').value='';
  document.getElementById('panelAgregarVenta').style.display='none';
  renderVentas(); renderDashboard();
  toast(`✅ Venta registrada: ${n1} → ${asesor}`);
}

function renderRendimiento(){
  const allVentas=getAllVentas();
  const asesores=getAsesoresSala();
  document.getElementById('rendAsesoresCards').innerHTML=asesores.length
    ? asesores.map(a=>{ const mv=allVentas.filter(v=>v.asesor===a.nombre); const inst=mv.filter(v=>(v._estado||'otro')==='instalado').length; const prog=mv.filter(v=>(v._estado||'otro')==='programado').length; const conv=mv.length?Math.round(inst/mv.length*100):0; return `<div class="asesor-card"><div class="ac-avatar" style="background:${colorFor(a.nombre)}">${iniciales(a.nombre)}</div><div class="ac-nombre">${a.nombre}</div><div class="ac-sala">${a.sala} · ${a.usuario||''}</div><div class="ac-stats"><div class="ac-stat"><div class="ac-stat-num">${mv.length}</div><div class="ac-stat-label">Total</div></div><div class="ac-stat"><div class="ac-stat-num" style="color:#16a34a">${inst}</div><div class="ac-stat-label">Inst.</div></div><div class="ac-stat"><div class="ac-stat-num" style="color:#2563eb">${prog}</div><div class="ac-stat-label">Prog.</div></div><div class="ac-stat"><div class="ac-stat-num" style="color:#d97706">${mv.filter(v=>(v._estado||'otro')==='caida').length}</div><div class="ac-stat-label">Caídas</div></div></div><div class="ac-conv"><span class="ac-conv-label">Conversión</span><span class="ac-conv-val">${conv}%</span></div></div>`; }).join('')
    : `<div style="text-align:center;color:#9ca3af;padding:40px;grid-column:1/-1">No hay asesores en ${salaActual}.</div>`;

  const meses=[0,1,2].map(o=>getMesClave(o));
  const rendTablaData=asesores.map(a=>({ nombre:a.nombre, usuario:a.usuario||'', meses:meses.map(m=>allVentas.filter(v=>v.asesor===a.nombre&&v._fecha&&v._fecha.startsWith(m)).length) }));
  const tbody=document.getElementById('rendTablaBody');
  if(!asesores.length){ tbody.innerHTML=`<tr class="tabla-empty"><td colspan="6">Sin asesores en ${salaActual}</td></tr>`; }
  else { tbody.innerHTML=rendTablaData.map((r,i)=>{ const pc=['p1','p2','p3']; const total=r.meses.reduce((s,v)=>s+v,0); return `<tr><td><div class="pos-badge ${pc[i]||''}">${i+1}</div></td><td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>${r.meses.map((cnt,mi)=>`<td style="font-weight:${mi===0?800:400};color:${mi===0?'#111827':'#6b7280'}">${cnt}</td>`).join('')}<td style="font-weight:800;color:#7C3AED">${total}</td></tr>`; }).join(''); }
}

/* ===================== FRASES — conectado a backend ===================== */
async function enviarFrase(){
  const texto=document.getElementById('fraseTexto').value.trim();
  if(!texto){ toast('⚠️ Escribe una frase primero'); return; }
  try {
    const sesion = ncGetSesion();
    const res = await fetch(API_SUP + '/frases', {
      method: 'POST',
      headers: ncHeaders(),
      body: JSON.stringify({ texto, sala: salaActual }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('fraseTexto').value='';
      frasesHoy.unshift({texto, hora:horaAhora(), sala:salaActual});
      renderFrasesHistorial();
      toast('✅ Frase publicada para '+salaActual);
    } else {
      toast('❌ ' + data.mensaje);
    }
  } catch(e) {
    toast('❌ Error conectando al servidor');
  }
}

async function cargarFrasesBackend(){
  try {
    const url = salaActual ? `${API_SUP}/frases?sala=${encodeURIComponent(salaActual)}` : `${API_SUP}/frases`;
    const res  = await fetch(url, { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok && data.data?.length) {
      frasesHoy = data.data.map(f=>({texto:f.texto, hora:f.created_at?.split(' ')[1]||'', sala:f.sala||salaActual}));
      renderFrasesHistorial();
    }
  } catch(e) {}
}

function renderFrases(){ cargarFrasesBackend(); renderFrasesHistorial(); }

function renderFrasesHistorial(){
  const cnt=document.getElementById('frasesCount'); if(cnt) cnt.textContent=frasesHoy.length;
  const el=document.getElementById('frasesHistorial'); if(!el) return;
  if(!frasesHoy.length){ el.innerHTML=`<div class="frase-vacia"><div style="font-size:28px;margin-bottom:8px;">💬</div>Aún no publicaste ninguna frase hoy.</div>`; return; }
  el.innerHTML=`<div class="frases-historial">`+frasesHoy.map(f=>`<div class="frase-item"><div class="frase-item-texto">"${f.texto}"</div><div class="frase-item-meta">📍 ${f.sala} · 🕐 ${f.hora}</div></div>`).join('')+`</div>`;
}

function exportarExcel(){ toast('📊 Exportación a Excel — próximamente'); }
function exportarPDF(){ toast('📄 Exportación a PDF — próximamente'); }

window.onload = async ()=>{
  await cargarDatosBackend();
  iniciarApp();
  setInterval(async ()=>{
    await cargarDatosBackend();
    const sec=document.querySelector('.section.active');
    if(sec) renderSeccion(sec.id.replace('sec-',''));
  }, 30000);
};