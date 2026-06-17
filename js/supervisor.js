/* ================================================
   SUPERVISOR.JS — Conectado en tiempo real
   ================================================ */
const API_SUP = window.NC_API + '/api';
const SUP_APARTADO_KEY = 'nc_supervisor_apartado';

// Estados reales del flujo completo
const ESTADOS_VENTA = [
  { id:'venta',        label:'Venta',          cls:'be-venta',      color:'#2563eb', dot:'#2563eb' },
  { id:'validado',     label:'Validado',        cls:'be-validado',   color:'#7c3aed', dot:'#7c3aed' },
  { id:'no_validado',  label:'No Validado',     cls:'be-caida',      color:'#dc2626', dot:'#dc2626' },
  { id:'grabado',      label:'Grabado',         cls:'be-grabado',    color:'#d97706', dot:'#d97706' },
  { id:'no_grabado',   label:'No Grabado',      cls:'be-pendiente',  color:'#9ca3af', dot:'#9ca3af' },
  { id:'en_ejecucion', label:'En Ejecución',    cls:'be-ejecucion',  color:'#0891b2', dot:'#0891b2' },
  { id:'instalado',    label:'Instalado',       cls:'be-instalado',  color:'#16a34a', dot:'#16a34a' },
  { id:'caida',        label:'Caída',           cls:'be-caida',      color:'#b91c1c', dot:'#b91c1c' },
  { id:'rechazo_campo',label:'Rechazo Campo',   cls:'be-caida',      color:'#ea580c', dot:'#ea580c' },
  { id:'tecnico_casa', label:'Técnico en Casa', cls:'be-observado',  color:'#7c3aed', dot:'#7c3aed' },
  { id:'no_instalado', label:'No Instalado',    cls:'be-caida',      color:'#991b1b', dot:'#991b1b' },
];

function mapearEstado(e) {
  const s = (e||'').toLowerCase().trim();
  if (s === 'venta' || s === '')  return 'venta';
  if (s === 'validado')           return 'validado';
  if (s === 'no_validado')        return 'no_validado';
  if (s === 'grabado')            return 'grabado';
  if (s === 'pendiente')          return 'no_grabado';
  if (s === 'aprobado' || s === 'programado' || s === 'en_ejecucion' || s === 'en ejecucion') return 'en_ejecucion';
  if (s === 'instalado')          return 'instalado';
  if (s === 'caida')              return 'caida';
  if (s === 'rechazo_campo')      return 'rechazo_campo';
  if (s === 'tecnico_casa')       return 'tecnico_casa';
  if (s === 'no_validado')        return 'no_validado';
  if (s === 'observado')          return 'no_validado';
  return 'venta';
}

const COLORES_AV = ["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899","#f59e0b"];
function colorFor(n){ let s=0; for(const c of (n||'')) s+=c.charCodeAt(0); return COLORES_AV[s%COLORES_AV.length]; }
function iniciales(n){ return (n||'?').trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function fechaHoy(){ const a=new Date(),u=a.getTime()+a.getTimezoneOffset()*60000,p=new Date(u+(-5*60*60000)); return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0'); }
function mesActual(){ return fechaHoy().slice(0,7); }
function getMesLabel(o=0){ const d=new Date(); d.setMonth(d.getMonth()-o); return d.toLocaleString('es-PE',{month:'long',year:'numeric'}); }
function getMesClave(o=0){ const d=new Date(); d.setMonth(d.getMonth()-o); return d.toISOString().slice(0,7); }
function formatF(f){ if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3200); }
function estadoObj(id){ return ESTADOS_VENTA.find(e=>e.id===id)||ESTADOS_VENTA[0]; }
function badgeE(id){ const e=estadoObj(id); return `<span style="display:inline-flex;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;background:${e.dot}22;color:${e.dot};border:1px solid ${e.dot}44">${e.label}</span>`; }

let salaActual='SALA 1', supervisorNom='', periodoActual='mes';
let asesoresCache=[], ventasCache=[], frasesHoy=[];
let chartInstances={};
let _leadsCache=[];
let tablaSearchVal='';

async function cargarDatos(){
  try {
    const [rU,rV] = await Promise.all([
      fetch(API_SUP+'/usuarios',{headers:ncHeaders()}),
      fetch(API_SUP+'/ventas',  {headers:ncHeaders()}),
    ]);
    const [dU,dV] = await Promise.all([rU.json(),rV.json()]);
    if(dU.ok) asesoresCache = dU.data.filter(u=>u.cargo==='asesor'&&u.activo);
    if(dV.ok) ventasCache = dV.data.map(v=>({
      ...v,
      asesor:   v.asesor_nombre||'',
      n1:       v.telefono1||'',
      n2:       v.telefono2||'',
      campana:  v.claro_hogar||v.paquete||'',
      distrito: v.distrito||'',
      _fecha:   (v.created_at||'').split(' ')[0],
      _hora:    (v.created_at||'').split(' ')[1]||'',
      _estado:  mapearEstado(v.estado),
    }));
  } catch(e){ console.error(e); }
}

function getAllVentas(){
  // Solo ventas formalmente subidas (tabla ventas en el backend)
  // Filtra por sala del asesor que la subió
  if(!salaActual) return ventasCache;
  const asesoresSala = getAsesoresSala().map(a=>a.nombre);
  // Fallback: si no cargaron asesores aún, mostrar todo
  if(!asesoresSala.length) return ventasCache;
  return ventasCache.filter(v => {
    // Coincidir por nombre del asesor en la sala
    if(asesoresSala.includes(v.asesor)) return true;
    // O por sala directa si la venta tiene el campo sala
    if(v.sala && v.sala === salaActual) return true;
    return false;
  });
}
function getAsesores(){ return asesoresCache; }
function getAsesoresSala(){ return asesoresCache.filter(a=>!salaActual||a.sala===salaActual); }
function getUltimos7Dias(){ const dias=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); dias.push(d.toISOString().split('T')[0]); } return dias; }

function filtrarPeriodo(ventas){
  const hoy=fechaHoy(),mes=mesActual();
  const lun=(()=>{ const d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1); return new Date(d.setDate(diff)).toISOString().split('T')[0]; })();
  return ventas.filter(v=>{
    const f=v._fecha||'';
    if(periodoActual==='dia')    return f===hoy;
    if(periodoActual==='semana') return f>=lun&&f<=hoy;
    if(periodoActual==='mes')    return f.startsWith(mes);
    return true;
  });
}

function iniciarApp(){
  const s=ncGetSesion();
  salaActual=s?.sala||'SALA 1';
  supervisorNom=s?.nombre||'Supervisor';
  document.getElementById('topbarSala').textContent=salaActual;
  document.getElementById('topbarUser').textContent=supervisorNom;
  poblarFiltros();
  poblarAgregarVentaSelects();
  renderSeccion('dashboard');
}

function showSection(id,btn){
  try{ sessionStorage.setItem(SUP_APARTADO_KEY,id); }catch(e){}
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
function restaurarSeccionSupervisor(){
  let id='';
  try{ id=sessionStorage.getItem(SUP_APARTADO_KEY)||''; }catch(e){}
  if(!id || !document.getElementById('sec-'+id)) return false;
  const btn=document.querySelector('.nav-btn[onclick*="' + id + '"]');
  showSection(id,btn);
  return true;
}
function setPeriodo(p,btn){
  periodoActual=p;
  document.querySelectorAll('.periodo-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderDashboard();
}

/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
function renderDashboard(){
  const ventas=filtrarPeriodo(getAllVentas());
  const asesores=getAsesoresSala();
  const cnt=id=>ventas.filter(v=>v._estado===id).length;
  const total=ventas.length;
  const instalados=cnt('instalado');

  document.getElementById('dashKpis').innerHTML=[
    {label:'Total ventas',    val:total,                cls:'k-blue',   sub:periodoLabel()},
    {label:'Validadas',       val:cnt('validado'),      cls:'k-purple', sub:'pasaron validación'},
    {label:'No Validadas',    val:cnt('no_validado'),   cls:'k-red',    sub:'rechazadas'},
    {label:'Grabadas',        val:cnt('grabado'),       cls:'k-orange', sub:'con audio'},
    {label:'En Ejecución',    val:cnt('en_ejecucion'),  cls:'k-teal',   sub:'programadas'},
    {label:'Instaladas',      val:instalados,           cls:'k-green',  sub:'completadas'},
    {label:'Caídas',          val:cnt('caida'),         cls:'k-red',    sub:'fallidas'},
    {label:'Asesores',        val:asesores.length,      cls:'k-blue',   sub:salaActual},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');

  document.getElementById('estadosChips').innerHTML=ESTADOS_VENTA.map(e=>{
    const c=ventas.filter(v=>v._estado===e.id).length;
    return `<div class="estado-chip"><div class="chip-dot" style="background:${e.dot}"></div><span>${e.label}</span><span class="chip-num" style="color:${e.dot}">${c}</span></div>`;
  }).join('');

  const rendData=asesores.map(a=>{
    const mis=ventas.filter(v=>v.asesor===a.nombre);
    const inst=mis.filter(v=>v._estado==='instalado').length;
    return {nombre:a.nombre,usuario:a.usuario||'',total:mis.length,inst,conv:mis.length?Math.round(inst/mis.length*100):0};
  }).sort((a,b)=>b.total-a.total);

  const tbody=document.getElementById('dashTablaBody');
  const pc=['p1','p2','p3'];
  tbody.innerHTML=rendData.length
    ? rendData.map((r,i)=>`<tr>
        <td><div class="pos-badge ${pc[i]||''}">${i+1}</div></td>
        <td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>
        <td style="font-weight:700">${r.total}</td>
        <td style="color:#16a34a;font-weight:700">${r.inst}</td>
        <td><div class="bar-mini-wrap"><div class="bar-mini"><div class="bar-mini-fill" style="width:${r.conv}%"></div></div><span style="font-size:11px;color:#9ca3af">${r.conv}%</span></div></td>
      </tr>`).join('')
    : `<tr class="tabla-empty"><td colspan="5">Sin asesores en ${salaActual}</td></tr>`;

  const allV=getAllVentas();
  document.getElementById('comparativoGrid').innerHTML=[0,1,2].map(o=>{
    const cl=getMesClave(o), cnt2=allV.filter(v=>v._fecha&&v._fecha.startsWith(cl)).length;
    const prev=allV.filter(v=>v._fecha&&v._fecha.startsWith(getMesClave(o+1))).length;
    const diff=cnt2-prev, dc=diff>0?'up':diff<0?'down':'eq';
    return `<div class="comp-card"><div class="comp-mes">${getMesLabel(o)}</div><div class="comp-val">${cnt2}</div><div class="comp-diff ${dc}">${diff>0?'↑':diff<0?'↓':'→'} ${Math.abs(diff)} vs mes anterior</div></div>`;
  }).join('');

  renderChartsDash(rendData,ventas);
}
function periodoLabel(){ if(periodoActual==='dia')return'hoy'; if(periodoActual==='semana')return'semana'; if(periodoActual==='mes')return'mes actual'; return'histórico'; }
function destroyChart(id){ if(chartInstances[id]){ chartInstances[id].destroy(); delete chartInstances[id]; } }

function renderChartsDash(rendData,ventas){
  const nombres=rendData.map(r=>r.nombre.split(' ')[0]);
  const colores=rendData.map(r=>colorFor(r.nombre));
  destroyChart('ch1');
  const c1=document.getElementById('ch1');
  if(c1) chartInstances.ch1=new Chart(c1,{type:'bar',data:{labels:nombres,datasets:[{label:'Ventas',data:rendData.map(r=>r.total),backgroundColor:colores,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{grid:{display:false}}}}});
  destroyChart('ch2');
  const c2=document.getElementById('ch2');
  if(c2){
    const ed=ESTADOS_VENTA.map(e=>({label:e.label,cnt:ventas.filter(v=>v._estado===e.id).length,color:e.dot}));
    const edConDatos=ed.filter(e=>e.cnt>0);
    if(edConDatos.length){
      chartInstances.ch2=new Chart(c2,{
        type:'doughnut',
        data:{
          labels:edConDatos.map(e=>e.label),
          datasets:[{data:edConDatos.map(e=>e.cnt),backgroundColor:edConDatos.map(e=>e.color),borderWidth:2,borderColor:'#fff',hoverOffset:8}]
        },
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{
            legend:{position:'right',labels:{font:{size:11},boxWidth:10,padding:10,
              generateLabels: function(chart){
                // Show ALL states in legend, gray out those with 0
                return ed.map((e,i)=>({
                  text: e.label+' ('+e.cnt+')',
                  fillStyle: e.cnt>0 ? e.color : '#e5e7eb',
                  strokeStyle: '#fff',
                  fontColor: e.cnt>0 ? '#374151' : '#9ca3af',
                  hidden: false,
                  index: edConDatos.findIndex(x=>x.label===e.label)
                }));
              }
            }}
          },
          cutout:'65%'
        }
      });
    } else {
      // No data — show empty state
      const ctx=c2.getContext('2d');
      ctx.clearRect(0,0,c2.width,c2.height);
      ctx.fillStyle='#f3f4f6'; ctx.beginPath();
      ctx.arc(c2.width/2,c2.height/2,80,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#9ca3af'; ctx.font='12px Inter,sans-serif';
      ctx.textAlign='center'; ctx.fillText('Sin datos',c2.width/2,c2.height/2+4);
    }
  }
  destroyChart('ch3');
  const c3=document.getElementById('ch3');
  if(c3){ const dias7=getUltimos7Dias(),allV=getAllVentas(),asesores=getAsesoresSala(); const datasets=asesores.map(a=>({label:a.nombre.split(' ')[0],data:dias7.map(d=>allV.filter(v=>v.asesor===a.nombre&&v._fecha===d).length),borderColor:colorFor(a.nombre),backgroundColor:colorFor(a.nombre)+'22',fill:true,tension:0.4,borderWidth:2,pointRadius:4})); chartInstances.ch3=new Chart(c3,{type:'line',data:{labels:dias7.map(d=>formatF(d)),datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{grid:{display:false}}}}}); }
  destroyChart('ch4');
  const c4=document.getElementById('ch4');
  if(c4&&rendData.length) chartInstances.ch4=new Chart(c4,{type:'bar',data:{labels:nombres,datasets:[{label:'Conversión %',data:rendData.map(r=>r.conv),backgroundColor:colores.map(c=>c+'aa'),borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'}},y:{grid:{display:false}}}}});
}

/* ══════════════════════════════════════════
   VENTAS
══════════════════════════════════════════ */
function poblarFiltros(){
  const selA=document.getElementById('filtroAsesor');
  if(selA){ selA.innerHTML='<option value="">Todos</option>'; getAsesoresSala().forEach(a=>selA.innerHTML+=`<option value="${a.nombre}">${a.nombre}</option>`); }
  const selE=document.getElementById('filtroEstado');
  if(selE){ selE.innerHTML='<option value="">Todos</option>'; ESTADOS_VENTA.forEach(e=>selE.innerHTML+=`<option value="${e.id}">${e.label}</option>`); }
}
function poblarAgregarVentaSelects(){
  const selA=document.getElementById('nv_asesor');
  if(selA){ selA.innerHTML='<option value="">— Asesor —</option>'; getAsesoresSala().forEach(a=>selA.innerHTML+=`<option value="${a.nombre}">${a.nombre}</option>`); }
  const selE=document.getElementById('nv_estado');
  if(selE){ selE.innerHTML='<option value="">— Estado —</option>'; ESTADOS_VENTA.forEach(e=>selE.innerHTML+=`<option value="${e.id}">${e.label}</option>`); }
}

function renderVentas(){
  let ventas=getAllVentas();
  const fa=(document.getElementById('filtroAsesor')?.value||'');
  const fe=(document.getElementById('filtroEstado')?.value||'');
  const fd=(document.getElementById('filtroDesde')?.value||'');
  const fh=(document.getElementById('filtroHasta')?.value||'');
  if(fa) ventas=ventas.filter(v=>v.asesor===fa);
  if(fe) ventas=ventas.filter(v=>v._estado===fe);
  if(fd) ventas=ventas.filter(v=>v._fecha>=fd);
  if(fh) ventas=ventas.filter(v=>v._fecha<=fh);
  if(!fd&&!fh&&!fa&&!fe&&!tablaSearchVal) ventas=ventas.filter(v=>v._fecha&&v._fecha.startsWith(mesActual()));
  if(tablaSearchVal){ const q=tablaSearchVal.toLowerCase(); ventas=ventas.filter(v=>v.n1?.includes(tablaSearchVal)||(v.asesor||'').toLowerCase().includes(q)||(v.nombre||'').toLowerCase().includes(q)||(v.dni||'').includes(tablaSearchVal)); }
  ventas.sort((a,b)=>(b._fecha+b._hora).localeCompare(a._fecha+a._hora));

  document.getElementById('ventasCount').textContent=ventas.length+' registros';
  document.getElementById('ventasStatTotal').textContent=ventas.length;
  ESTADOS_VENTA.forEach(e=>{ const el=document.getElementById('vstat_'+e.id); if(el) el.textContent=ventas.filter(v=>v._estado===e.id).length; });

  const tbody=document.getElementById('ventasTablaBody');
  if(!ventas.length){ tbody.innerHTML='<tr class="tabla-empty"><td colspan="14">Sin ventas con esos filtros.</td></tr>'; return; }
  tbody.innerHTML=ventas.map((v,i)=>`<tr>
    <td style="color:#9ca3af;font-size:10px">${i+1}</td>
    <td style="font-weight:700;color:#185FA5;font-size:11px">${formatF(v._fecha)}</td>
    <td style="font-weight:600;min-width:140px">${v.nombre||'—'}</td>
    <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
    <td style="font-family:monospace;font-weight:700;color:#111827">${v.n1||'—'}</td>
    <td style="font-family:monospace;color:#6b7280">${v.n2||'—'}</td>
    <td style="font-size:11px">${v.departamento||'—'}</td>
    <td style="font-size:11px">${v.distrito||'—'}</td>
    <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis">${v.paquete||'—'}</td>
    <td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(v.asesor||'X')};width:24px;height:24px;font-size:9px">${iniciales(v.asesor||'?')}</div><span style="font-size:11px;font-weight:600">${v.asesor||'—'}</span></div></td>
    <td>${badgeE(v._estado||'venta')}</td>
    <td style="font-size:11px;color:#6b7280">${v._hora||'—'}</td>
    <td style="font-size:11px;color:#6b7280;max-width:120px;overflow:hidden;text-overflow:ellipsis">${v.observacion||v.obs_backoffice||'—'}</td>
<td style="display:flex;gap:6px;align-items:center;padding:6px 4px;">
      <button class="btn-fotos" onclick="abrirModalFotos(${v.id}, '${(v.nombre||'').replace(/'/g,'').substring(0,30)}')">📷</button>
      <button onclick="eliminarVenta(${v.id})" style="padding:4px 10px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:#fff5f5;color:#dc2626;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .16s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fff5f5'">Eliminar</button>
    </td>  </tr>`).join('');
}

async function eliminarVenta(id){
  if(!confirm('¿Seguro que deseas eliminar esta venta?')) return;
  try {
    const res=await fetch(API_SUP+'/ventas/'+id,{method:'DELETE',headers:ncHeaders()});
    const data=await res.json();
    if(data.ok){ ventasCache=ventasCache.filter(v=>v.id!==id); renderVentas(); renderDashboard(); toast('Venta eliminada'); }
    else toast('Error: '+(data.mensaje||'no se pudo eliminar'));
  } catch(e){ toast('Error de conexión'); }
}

function limpiarFiltrosVentas(){
  ['filtroAsesor','filtroEstado','filtroDesde','filtroHasta'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  tablaSearchVal=''; const ts=document.getElementById('tablaSearch'); if(ts) ts.value='';
  renderVentas();
}

function agregarVentaManual(){}

/* ══════════════════════════════════════════
   MI EQUIPO
══════════════════════════════════════════ */
function renderEquipo(){
  const asesores=getAsesoresSala();
  const buscar=(document.getElementById('equipoBuscar')?.value||'').toLowerCase();
  const filtEst=document.getElementById('equipoFiltroEstado')?.value||'';
  const hoy=fechaHoy(),allV=getAllVentas();
  const activos=asesores.filter(a=>a.activo).length;
  const ventasHoy=allV.filter(v=>v._fecha===hoy).length;
  const kTotal=document.getElementById('equipoTotal');    if(kTotal)  kTotal.textContent=asesores.length;
  const kAct=document.getElementById('equipoActivos');    if(kAct)    kAct.textContent=activos;
  const kInact=document.getElementById('equipoInactivos');if(kInact)  kInact.textContent=asesores.length-activos;
  const kVH=document.getElementById('equipoVentasHoy');  if(kVH)     kVH.textContent=ventasHoy;
  const kSala=document.getElementById('equipoSalaLabel');if(kSala)   kSala.textContent=salaActual;
  const sub=document.getElementById('equipoSubtitle');   if(sub)     sub.textContent='Asesores activos en '+salaActual;

  let lista=asesores.filter(a=>{
    const mb=!buscar||a.nombre.toLowerCase().includes(buscar)||(a.usuario||'').toLowerCase().includes(buscar);
    const me=filtEst===''||String(a.activo?1:0)===filtEst;
    return mb&&me;
  });

  const cont=document.getElementById('equipoCards'); if(!cont) return;
  if(!lista.length){ cont.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9ca3af;">Sin asesores.</div>'; return; }

  cont.innerHTML=lista.map(a=>{
    const mis=allV.filter(v=>v.asesor===a.nombre);
    const hoyV=mis.filter(v=>v._fecha===hoy).length;
    const mesV=mis.filter(v=>v._fecha&&v._fecha.startsWith(mesActual())).length;
    const inst=mis.filter(v=>v._estado==='instalado').length;
    const conv=mis.length?Math.round(inst/mis.length*100):0;
    const actB=a.activo
      ?'<span style="background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;">ACTIVO</span>'
      :'<span style="background:#fee2e2;color:#991b1b;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;">INACTIVO</span>';
    const nom=a.nombre.replace(/'/g,"\\'"), aid=a.id||0;
    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:44px;height:44px;border-radius:50%;background:${colorFor(a.nombre)};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;">${iniciales(a.nombre)}</div>
          <div><div style="font-size:13px;font-weight:700;">${a.nombre}</div><div style="font-size:11px;color:#9ca3af;">@${a.usuario||'—'}</div></div>
        </div>${actB}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#111827">${hoyV}</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Hoy</div></div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#2563eb">${mesV}</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Mes</div></div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#16a34a">${inst}</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Inst.</div></div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#7c3aed">${conv}%</div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-top:2px">Conv.</div></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid #f3f4f6;">
        <span style="font-size:11px;color:#9ca3af;">${a.sala||'—'}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="abrirBaseLlamadas('${nom}',${aid})" style="padding:6px 12px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;">Base llamadas</button>
          <button onclick="abrirDetalleAsesor('${nom}')" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;">Ver detalle</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   MODAL BASE LLAMADAS — tiempo real
══════════════════════════════════════════ */
async function abrirBaseLlamadas(nombre, asesorId){
  let modal=document.getElementById('modalBaseLlamadas');
  if(!modal){
    modal=document.createElement('div');
    modal.id='modalBaseLlamadas';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    modal.innerHTML=`<div style="background:#fff;border-radius:18px;width:100%;max-width:960px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="padding:18px 24px 14px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
        <div><div style="font-size:15px;font-weight:800;color:#111827;" id="blNombre">Base de llamadas</div><div style="font-size:12px;color:#9ca3af;margin-top:2px;" id="blSub"></div></div>
        <button onclick="cerrarBaseLlamadas()" style="width:32px;height:32px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;font-size:18px;cursor:pointer;">×</button>
      </div>
      <div style="padding:10px 24px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <label style="font-size:12px;font-weight:600;">Fecha:</label>
        <input type="date" id="blFecha" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;font-family:inherit;" onchange="filtrarBaseLlamadas()">
        <button onclick="blFechaHoy()" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;">Hoy</button>
        <span id="blContador" style="font-size:12px;color:#9ca3af;margin-left:auto;"></span>
      </div>
      <div id="blKpis" style="padding:10px 24px;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid #f3f4f6;"></div>
      <div style="flex:1;overflow:auto;padding:0 24px 20px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="position:sticky;top:0;background:#f9fafb;z-index:1;">
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">#</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Teléfono N1</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">N2</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Zona</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Campaña</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Hora asig.</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Tipificación</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Observación</th>
          </tr></thead>
          <tbody id="blTablaBody"><tr><td colspan="8" style="text-align:center;padding:40px;color:#9ca3af;">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) cerrarBaseLlamadas(); });
  }
  modal._asesorId=asesorId; modal._asesorNombre=nombre;
  document.getElementById('blNombre').textContent='Base de llamadas — '+nombre;
  document.getElementById('blSub').textContent='Solo lectura · Supervisor';
  const fi=document.getElementById('blFecha'); if(!fi.value) fi.value=fechaHoy();
  modal.style.display='flex';
  await cargarLeadsAsesor(asesorId);
}

async function cargarLeadsAsesor(asesorId){
  const tbody=document.getElementById('blTablaBody');
  tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:#9ca3af;">Cargando...</td></tr>';
  try {
    const fecha=document.getElementById('blFecha')?.value||'';
    let url=`${API_SUP}/leads?asesor_id=${asesorId}`;
    if(fecha) url+=`&fecha=${fecha}`;
    const res=await fetch(url,{headers:ncHeaders()});
    const data=await res.json();
    if(data.ok){ _leadsCache=data.data; renderBaseLlamadas(_leadsCache); }
    else tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:#ef4444;">Error cargando leads.</td></tr>';
  } catch(e){ document.getElementById('blTablaBody').innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:#ef4444;">Error de conexión.</td></tr>'; }
}

const TIPIF_COLORS={'VENTA CERRADA':'#16a34a','PREVENTA':'#2563eb','AGENDADO':'#7c3aed','NO CONTESTA':'#9ca3af','CORTA LLAMADA':'#f97316','NO DESEA':'#ef4444','BUZON DE VOZ':'#6b7280','SERVICIO ACTIVO':'#0891b2','SIN COBERTURA':'#dc2626','NO CALIFICA':'#d97706'};

function renderBaseLlamadas(leads){
  const tbody=document.getElementById('blTablaBody');
  const cont=document.getElementById('blContador');
  if(cont) cont.textContent=leads.length+' registros';
  const kpiEl=document.getElementById('blKpis');
  if(kpiEl){
    const total=leads.length;
    const tipif=leads.filter(l=>(l.tipif_vend||'').trim()!=='').length;
    const ventas=leads.filter(l=>(l.tipif_vend||'').toUpperCase()==='VENTA CERRADA').length;
    const nc=leads.filter(l=>['NO CONTESTA','BUZON DE VOZ'].includes((l.tipif_vend||'').toUpperCase())).length;
    kpiEl.innerHTML=[{label:'Leads',val:total,color:'#2563eb'},{label:'Tipificados',val:tipif,color:'#16a34a'},{label:'VENTA CERRADA',val:ventas,color:'#7c3aed'},{label:'NC/Buzón',val:nc,color:'#d97706'}]
      .map(k=>`<div style="background:#f9fafb;border-radius:10px;padding:8px 14px;display:flex;flex-direction:column;gap:2px;min-width:100px;"><div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;">${k.label}</div></div>`).join('');
  }
  if(!leads.length){ tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:#9ca3af;">Sin leads para esta fecha.</td></tr>'; return; }
  tbody.innerHTML=leads.map((l,i)=>{
    const t=(l.tipif_vend||'').trim(), color=TIPIF_COLORS[t.toUpperCase()]||'#9ca3af';
    const badge=t?`<span style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">${t}</span>`:'<span style="color:#d1d5db;font-style:italic;font-size:11px;">Sin tipif.</span>';
    return `<tr style="border-bottom:1px solid #f3f4f6;${t.toUpperCase()==='VENTA CERRADA'?'background:#f0fdf4;':''}">
      <td style="padding:8px;color:#9ca3af;font-size:10px;">${i+1}</td>
      <td style="padding:8px;font-family:monospace;font-weight:700;color:#111827;">${l.n1||'—'}</td>
      <td style="padding:8px;font-family:monospace;color:#6b7280;">${l.n2||'—'}</td>
      <td style="padding:8px;font-size:11px;">${l.distrito||l.campana||'—'}</td>
      <td style="padding:8px;font-size:11px;">${l.campana||'—'}</td>
      <td style="padding:8px;font-size:11px;font-family:monospace;">${l.hora_asig||'—'}</td>
      <td style="padding:8px;">${badge}</td>
      <td style="padding:8px;font-size:11px;color:#6b7280;">${l.obs_asesor||'—'}</td>
    </tr>`;
  }).join('');
}
async function filtrarBaseLlamadas(){ const m=document.getElementById('modalBaseLlamadas'); if(m) await cargarLeadsAsesor(m._asesorId); }
function blFechaHoy(){ const i=document.getElementById('blFecha'); if(i){ i.value=fechaHoy(); filtrarBaseLlamadas(); } }
function cerrarBaseLlamadas(){ const m=document.getElementById('modalBaseLlamadas'); if(m) m.style.display='none'; _leadsCache=[]; }

/* ══════════════════════════════════════════
   RENDIMIENTO — solo cuenta INSTALADAS
══════════════════════════════════════════ */
function renderRendimiento(){
  const allV=getAllVentas(), asesores=getAsesoresSala();
  document.getElementById('rendAsesoresCards').innerHTML=asesores.length
    ? asesores.map(a=>{
        const mis=allV.filter(v=>v.asesor===a.nombre);
        const inst=mis.filter(v=>v._estado==='instalado').length;
        const noVal=mis.filter(v=>v._estado==='no_validado').length;
        const noGrab=mis.filter(v=>v._estado==='no_grabado'||v._estado==='venta'||v._estado==='validado').length;
        const caida=mis.filter(v=>v._estado==='caida'||v._estado==='rechazo_campo').length;
        const conv=mis.length?Math.round(inst/mis.length*100):0;
        return `<div class="asesor-card">
          <div class="ac-avatar" style="background:${colorFor(a.nombre)}">${iniciales(a.nombre)}</div>
          <div class="ac-nombre">${a.nombre}</div>
          <div class="ac-sala">${a.sala} - ${a.usuario||''}</div>
          <div class="ac-stats">
            <div class="ac-stat"><div class="ac-stat-num">${mis.length}</div><div class="ac-stat-label">Total</div></div>
            <div class="ac-stat"><div class="ac-stat-num" style="color:#16a34a">${inst}</div><div class="ac-stat-label">Inst.</div></div>
            <div class="ac-stat"><div class="ac-stat-num" style="color:#dc2626">${noVal}</div><div class="ac-stat-label">No Val.</div></div>
            <div class="ac-stat"><div class="ac-stat-num" style="color:#b91c1c">${caida}</div><div class="ac-stat-label">Caídas</div></div>
          </div>
          <div class="ac-conv"><span class="ac-conv-label">Conversión (inst.)</span><span class="ac-conv-val">${conv}%</span></div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;color:#9ca3af;padding:40px;grid-column:1/-1">Sin asesores en ${salaActual}.</div>`;

  // Tabla de caídas / no validadas / no grabadas
  const problemas=allV.filter(v=>['no_validado','caida','rechazo_campo'].includes(v._estado));
  const meses=[0,1,2].map(o=>getMesClave(o));
  const rendTablaData=asesores.map(a=>({nombre:a.nombre,usuario:a.usuario||'',meses:meses.map(m=>allV.filter(v=>v.asesor===a.nombre&&v._estado==='instalado'&&v._fecha&&v._fecha.startsWith(m)).length)}));
  const tbody=document.getElementById('rendTablaBody');
  tbody.innerHTML=rendTablaData.length
    ? rendTablaData.map((r,i)=>{
        const pc=['p1','p2','p3']; const total=r.meses.reduce((s,v)=>s+v,0);
        return `<tr><td><div class="pos-badge ${pc[i]||''}">${i+1}</div></td><td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(r.nombre)}">${iniciales(r.nombre)}</div><div><div style="font-weight:700;font-size:12px">${r.nombre}</div><div style="font-size:10px;color:#9ca3af">${r.usuario}</div></div></div></td>${r.meses.map((cnt,mi)=>`<td style="font-weight:${mi===0?800:400};color:${mi===0?'#111827':'#6b7280'}">${cnt}</td>`).join('')}<td style="font-weight:800;color:#16a34a">${total}</td></tr>`;
      }).join('')
    : `<tr class="tabla-empty"><td colspan="6">Sin datos</td></tr>`;

  // Panel de problemas
  let panelProb=document.getElementById('panelProblemas');
  if(!panelProb){
    panelProb=document.createElement('div');
    panelProb.id='panelProblemas';
    document.getElementById('sec-rendimiento').appendChild(panelProb);
  }
  panelProb.innerHTML=`<div class="tabla-wrap" style="margin-top:16px;">
    <div class="tabla-header"><span class="tabla-title">Ventas con problemas — No validadas · No grabadas · Caídas</span><span class="tabla-count">${problemas.length} registros</span></div>
    <table class="tabla">
      <thead><tr><th>Fecha</th><th>Nombre</th><th>DNI</th><th>N1</th><th>Asesor</th><th>Estado</th><th>Motivo / Obs.</th></tr></thead>
      <tbody>${problemas.length
        ? problemas.map(v=>`<tr>
            <td style="font-size:11px;color:#185FA5;font-weight:700">${formatF(v._fecha)}</td>
            <td style="font-weight:600">${v.nombre||'—'}</td>
            <td style="font-family:monospace;font-size:11px">${v.dni||'—'}</td>
            <td style="font-family:monospace;font-weight:700">${v.n1||'—'}</td>
            <td><div class="asesor-cell"><div class="av-circle" style="background:${colorFor(v.asesor||'X')};width:22px;height:22px;font-size:9px">${iniciales(v.asesor||'?')}</div><span style="font-size:11px">${v.asesor||'—'}</span></div></td>
            <td>${badgeE(v._estado)}</td>
            <td style="font-size:11px;color:#6b7280">${v.obs_validacion||v.obs_backoffice||v.observacion||'—'}</td>
          </tr>`).join('')
        : '<tr class="tabla-empty"><td colspan="7">Sin ventas con problemas</td></tr>'
      }</tbody>
    </table>
  </div>`;
}

/* ══════════════════════════════════════════
   FRASES
══════════════════════════════════════════ */
async function enviarFrase(){
  const texto=document.getElementById('fraseTexto').value.trim();
  if(!texto){ toast('Escribe una frase primero'); return; }
  try {
    const res=await fetch(API_SUP+'/frases',{method:'POST',headers:ncHeaders(),body:JSON.stringify({texto,sala:salaActual})});
    const data=await res.json();
    if(data.ok){ document.getElementById('fraseTexto').value=''; frasesHoy.unshift({texto,hora:new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),sala:salaActual}); renderFrasesHistorial(); toast('Frase publicada'); }
    else toast('Error: '+data.mensaje);
  } catch(e){ toast('Error conectando'); }
}
async function cargarFrasesBackend(){
  try {
    const url=salaActual?`${API_SUP}/frases?sala=${encodeURIComponent(salaActual)}`:`${API_SUP}/frases`;
    const res=await fetch(url,{headers:ncHeaders()});
    const data=await res.json();
    if(data.ok&&data.data?.length){ frasesHoy=data.data.map(f=>({texto:f.texto,hora:(f.created_at||'').split(' ')[1]||'',sala:f.sala||salaActual})); renderFrasesHistorial(); }
  } catch(e){}
}
function renderFrases(){ cargarFrasesBackend(); renderFrasesHistorial(); }
function renderFrasesHistorial(){
  const cnt=document.getElementById('frasesCount'); if(cnt) cnt.textContent=frasesHoy.length;
  const el=document.getElementById('frasesHistorial'); if(!el) return;
  if(!frasesHoy.length){ el.innerHTML='<div class="frase-vacia">Aún no publicaste ninguna frase.</div>'; return; }
  el.innerHTML=frasesHoy.map(f=>`<div class="frase-item"><div class="frase-item-texto">"${f.texto}"</div><div class="frase-item-meta">${f.sala} · ${f.hora}</div></div>`).join('');
}

function abrirDetalleAsesor(nombre){
  const modal=document.getElementById('modalAsesor'), body=document.getElementById('modalAsesorBody');
  if(!modal||!body) return;
  const a=getAsesoresSala().find(x=>x.nombre===nombre); if(!a) return;
  const allV=getAllVentas(), mis=allV.filter(v=>v.asesor===nombre);
  const hoy=fechaHoy(), hoyV=mis.filter(v=>v._fecha===hoy);
  const mesV=mis.filter(v=>v._fecha&&v._fecha.startsWith(mesActual()));
  const inst=mis.filter(v=>v._estado==='instalado').length;
  const conv=mis.length?Math.round(inst/mis.length*100):0;
  body.innerHTML=
    `<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;"><div style="width:60px;height:60px;border-radius:50%;background:${colorFor(nombre)};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;">${iniciales(nombre)}</div><div><div style="font-size:16px;font-weight:800;">${nombre}</div><div style="font-size:12px;color:#9ca3af;">@${a.usuario||'—'} · ${a.sala||'—'}</div></div></div>`+
    `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">${[['Hoy',hoyV.length,'#111827'],['Este mes',mesV.length,'#2563eb'],['Instaladas',inst,'#16a34a'],['Conv.',conv+'%','#7c3aed']].map(([l,v,c])=>`<div style="background:#f9fafb;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-top:3px">${l}</div></div>`).join('')}</div>`+
    `<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;text-transform:uppercase;letter-spacing:.3px;">Últimas 5 ventas</div>`+
    (mis.length?`<div style="display:flex;flex-direction:column;gap:6px;">${[...mis].sort((a,b)=>b._fecha.localeCompare(a._fecha)).slice(0,5).map(v=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;"><div><span style="font-family:monospace;font-weight:700;font-size:12px;">${v.n1}</span><span style="font-size:11px;color:#9ca3af;margin-left:8px;">${v.campana||'—'}</span></div><div style="display:flex;align-items:center;gap:8px;">${badgeE(v._estado)}<span style="font-size:11px;color:#9ca3af;">${formatF(v._fecha)}</span></div></div>`).join('')}</div>`:'<div style="text-align:center;padding:20px;color:#9ca3af;">Sin ventas.</div>');
  modal.style.display='flex';
}
function cerrarModalAsesor(){ const m=document.getElementById('modalAsesor'); if(m) m.style.display='none'; }
function exportarExcel(){ toast('Excel — próximamente'); }
function exportarPDF(){ toast('PDF — próximamente'); }
function getMesLabel(o=0){ const d=new Date(); d.setMonth(d.getMonth()-o); return d.toLocaleString('es-PE',{month:'long',year:'numeric'}); }

window.onload=async()=>{
  await cargarDatos();
  iniciarApp();
  restaurarSeccionSupervisor();
  [0,1,2].forEach(i=>{ const el=document.getElementById('thMes'+i); if(el) el.textContent=getMesLabel(i)+' (instaladas)'; });
  const el=document.getElementById('ventasEstadoStats');
  if(el) el.innerHTML=ESTADOS_VENTA.map(e=>`<div style="background:#fff;border:1px solid ${e.dot}33;border-radius:8px;padding:6px 12px;display:flex;align-items:center;gap:6px;"><div style="width:7px;height:7px;border-radius:50%;background:${e.dot}"></div><span style="font-size:11px;font-weight:600;">${e.label}</span><span id="vstat_${e.id}" style="font-size:14px;font-weight:800;color:${e.dot}">0</span></div>`).join('');
  // Recargar cada 30s
  setInterval(async()=>{
    await cargarDatos();
    const sec=document.querySelector('.section.active');
    if(sec) renderSeccion(sec.id.replace('sec-',''));
  },30000);
};
