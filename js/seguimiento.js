/* ================================================
   SEGUIMIENTO.JS — Netcontact
   ================================================ */

const API_SEG = window.NC_API + '/api';

const ESTADOS = [
  { id:'ejecucion', label:'EN EJECUCION',      cls:'bs-ejec',    fila:'fila-ejec',    color:'#00cc00' },
  { id:'instalado', label:'INSTALADO',          cls:'bs-inst',    fila:'fila-inst',    color:'#00ccff' },
  { id:'caida',     label:'CAIDA',              cls:'bs-caida',   fila:'fila-caida',   color:'#ff3333' },
  { id:'rechazo',   label:'RECHAZO EN CAMPO',   cls:'bs-rech',    fila:'fila-rech',    color:'#ff9900' },
  { id:'tecnico',   label:'TECNICOS EN CASA',   cls:'bs-tecnico', fila:'fila-tecnico', color:'#ff66cc' },
];

const MOTIVOS_CAIDA = [
  'FRAUDE',
  'EXCESO DE ACOMETIDA',
  'INFRAESTRUCTURA',
  'RED SATURADA',
  'EDIFICIO NO LIBERADO',
];

const MOTIVOS_RECH = [
  'MALA OFERTA',
  'NO DESEA',
  'FALTA DE CONTACTO',
  'SOT CON ERRORES DE SISTEMA',
  'RED SATURADA',
  'FACILIDADES TECNICAS DEL CLIENTE',
  'MAL INGRESO DIRECCION',
];

const TRAMOS   = ['AM 1','AM 2','PM 1','PM 2','PM 3'];
const RESULTADOS = [
  'Contactado -- conforme','Contactado -- con problema',
  'No contesta','Buzon de voz','Numero equivocado',
  'Solicita rellamada','SE LEVANTO','MASIVO ENVIADO',
  'DERIVADO A GRABAR','DERIVADO A AGILIZAR','En Agenda',
];

const ESTADO_BD_MAP = {
  'ejecucion':  'en_ejecucion',
  'instalado':  'instalado',
  'caida':      'caida',
  'rechazo':    'rechazo_campo',
  'tecnico':    'tecnico_casa',
};

let ventas=[], ventasFiltradas=[];
let filtroEstado='', paginaActual=1, porPagina=18;
let editandoId=null, busquedaVal='';
let usuarioActual='Seguimiento';

const fechaHoy = ()=>{ const a=new Date(),u=a.getTime()+a.getTimezoneOffset()*60000,p=new Date(u+(-5*60*60000)); return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0'); };
const horaAhora = ()=>new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false});
const formatF = f=>{ if(!f)return'--'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
const estadoObj = id => ESTADOS.find(e=>e.id===id)||ESTADOS[0];
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); }
function cerrarModal(id){ document.getElementById(id)?.classList.remove('open'); editandoId=null; }

function motivoBadge(motivo){
  if(!motivo||motivo=='--') return '<span style="color:#9ca3af">--</span>';
  const m=motivo.toUpperCase();
  let cls='bm-default';
  if(m.includes('FRAUDE'))                            cls='bm-fraude';
  else if(m.includes('INFRA')||m.includes('EDIFICIO')||m.includes('ACOMETIDA')||m.includes('RED')) cls='bm-infra';
  else if(m.includes('NO DESEA'))                     cls='bm-nodesea';
  else if(m.includes('OFERTA'))                       cls='bm-malaoferta';
  else if(m.includes('CONTACTO')||m.includes('SOT')||m.includes('MAL INGRESO')||m.includes('FACIL')) cls='bm-faltacon';
  return `<span class="badge-motivo ${cls}">${motivo}</span>`;
}

function mapearEstado(e){
  const est = (e||'').toLowerCase();
  const m={
    'aprobado':'ejecucion','programado':'ejecucion','en_ejecucion':'ejecucion',
    'instalado':'instalado','validado':'ejecucion','caida':'caida',
    'observado':'ejecucion','venta':'ejecucion','pendiente':'ejecucion',
    'no_validado':'ejecucion','rechazo_campo':'rechazo','tecnico_casa':'tecnico',
  };
  if(est.includes('tecnico'))   return 'tecnico';
  if(est.includes('rechazo'))   return 'rechazo';
  if(est.includes('ejecucion')) return 'ejecucion';
  return m[est] || 'ejecucion';
}

async function cargarVentas(){
  try {
    const res  = await fetch(`${API_SEG}/ventas`, { headers: ncHeaders() });
    const data = await res.json();
    if (data.ok) {
      ventas = data.data
        .filter(v => { const e=(v.estado||'').toLowerCase(); return e!=='venta'&&e!=='validado'&&e!=='grabado'&&e!==''; })
        .map(v => ({
          ...v,
          nombreApellidos:  v.nombre    || '',
          dniDocumento:     v.dni       || '',
          telefonoContacto: v.telefono1 || '',
          obsBackOffice:    v.obs_backoffice || '',
          fechaIngreso:     v.created_at ? v.created_at.split(' ')[0] : '',
          _estadoSeg:       mapearEstado(v.estado),
          _tramo:           v._tramo      || '',
          _comentario:      v._comentario || '',
          _motivoRech:      v._motivoRech || '',
          _proxSeg:         v._proxSeg    || '',
          _historial:       v._historial  || [],
          
        }));
      return;
    }
  } catch(e) { console.error('Error:', e); }
  ventas = [];
}

async function guardarVentaBackend(id, cambios){
  try {
    await fetch(`${API_SEG}/ventas/${id}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify(cambios) });
  } catch(e) { console.error('Error guardando:', e); }
}

function actualizarKpis(){
  const c=id=>ventas.filter(v=>v._estadoSeg===id).length;
  document.getElementById('kpi-total').textContent  = ventas.length;
  document.getElementById('kpi-ejec').textContent   = c('ejecucion');
  document.getElementById('kpi-inst').textContent   = c('instalado');
  document.getElementById('kpi-rech').textContent   = c('rechazo');
  document.getElementById('kpi-caida').textContent  = c('caida');
  document.getElementById('kpi-tec').textContent    = c('tecnico');
  ESTADOS.forEach(e=>{ const el=document.getElementById('cnt-'+e.id); if(el) el.textContent=c(e.id); });
  const ct=document.getElementById('cnt-todos'); if(ct) ct.textContent=ventas.length;
}

function filtrarPorEstado(id, btn){
  filtroEstado=filtroEstado===id?'':id;
  document.querySelectorAll('.leyenda-item').forEach(b=>b.classList.remove('activo'));
  if(filtroEstado) btn.classList.add('activo');
  aplicarFiltros();
}

function aplicarFiltros(){
  let base=[...ventas];
  const fEst  = filtroEstado || document.getElementById('f_estado')?.value  || '';
  const fVend = (document.getElementById('f_vendedor')?.value||'').toLowerCase();
  const fDist = (document.getElementById('f_distrito')?.value||'').toLowerCase();
  const fDesde= document.getElementById('f_desde')?.value||'';
  const fHasta= document.getElementById('f_hasta')?.value||'';
  const fTramo= document.getElementById('f_tramo')?.value||'';
  base=base.filter(v=>{
    if(fEst   && v._estadoSeg!==fEst) return false;
    if(fVend  && !(v.vendedor||v.asesor_nombre||'').toLowerCase().includes(fVend)) return false;
    if(fDist  && !(v.distrito||'').toLowerCase().includes(fDist)) return false;
    if(fTramo && v._tramo!==fTramo) return false;
    const f=v.fechaIngreso||'';
    if(fDesde&&f<fDesde) return false;
    if(fHasta&&f>fHasta) return false;
    if(busquedaVal){ const b=busquedaVal.toLowerCase(); if(![v.nombreApellidos,v.dni,v.telefonoContacto,v.vendedor,v.distrito,v._comentario].some(x=>(x||'').toLowerCase().includes(b))) return false; }
    return true;
  });
  const ord={caida:0,rechazo:1,tecnico:2,ejecucion:3,instalado:4};
  base.sort((a,b)=>{ const oa=ord[a._estadoSeg]??5,ob=ord[b._estadoSeg]??5; return oa!==ob?oa-ob:(b.fechaIngreso||'').localeCompare(a.fechaIngreso||''); });
  ventasFiltradas=base; paginaActual=1; renderTabla(); actualizarKpis();
}

function limpiarFiltros(){
  ['f_estado','f_vendedor','f_distrito','f_desde','f_hasta','f_tramo'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  filtroEstado=''; busquedaVal='';
  document.querySelectorAll('.leyenda-item').forEach(b=>b.classList.remove('activo'));
  const bs=document.getElementById('busquedaInput'); if(bs) bs.value='';
  aplicarFiltros();
}

function renderTabla(){
  const tbody=document.getElementById('tablaBody');
  const total=ventasFiltradas.length;
  const ini=(paginaActual-1)*porPagina,fin=Math.min(ini+porPagina,total);
  const pag=ventasFiltradas.slice(ini,fin);
  document.getElementById('tablaCount').textContent=`${total} registros`;
  const pit=document.getElementById('pagInfoTop'); if(pit) pit.textContent=total?`Mostrando ${ini+1}-${fin} de ${total}`:'';
  if(!pag.length){ tbody.innerHTML=`<tr><td colspan="17" style="text-align:center;color:#9ca3af;padding:36px;font-size:13px;">Sin registros.</td></tr>`; renderPaginacion(0); return; }
  tbody.innerHTML=pag.map(v=>{
    const est=estadoObj(v._estadoSeg);
    const f=v.fechaIngreso||'';
    const tramo=v._tramo?`<span class="badge-tramo">${v._tramo}</span>`:'--';
    const nombreSeguro=(v.nombreApellidos||'').replace(/'/g,'').substring(0,30);
    return `<tr class="${est.fila}">
      <td style="text-align:center;vertical-align:middle;">
        <div class="acciones-cell">
          <button class="btn-acc btn-acc-obs"    onclick="abrirModalObs(${v.id})"    title="Registrar llamada">Llamada</button>
          <button class="btn-acc btn-acc-agenda" onclick="abrirModalAgenda(${v.id})" title="Agendar">Agenda</button>
          <button class="btn-acc btn-acc-hist"   onclick="hAbrir(${v.id},{nombre:'${nombreSeguro}',dni:'${v.dni||''}',n1:'${v.telefonoContacto||''}'})" title="Historial">Hist.</button>
          <button class="btn-fotos" onclick="abrirModalFotos(${v.id}, '${nombreSeguro}')" title="Ver fotos">📷</button>
        </div>
      </td>
      <td class="td-estado">
        <span class="badge-seg ${est.cls}" onclick="abrirModalEstado(${v.id})" style="cursor:pointer;" title="Click para cambiar estado">${est.label}</span>
      </td>
      <td style="font-weight:700;color:#185FA5;font-size:10px">${formatF(f)}</td>
      <td style="font-weight:600">${v.nombreApellidos||'--'}</td>
      <td style="font-family:monospace;font-size:10px">${v.dni||'--'}</td>
      <td style="font-size:10px">${v.distrito||'--'}</td>
      <td class="td-wrap" style="font-size:10px">${v.direccion||'--'}</td>
      <td style="font-size:9px;color:#6b7280">${v.coordenadas||'--'}</td>
      <td style="font-weight:600;color:#7C3AED;font-size:10px">${v.asesor_nombre||v.vendedor||'--'}</td>
      <td style="font-size:10px">${v.supervisor||'--'}</td>
      <td style="font-size:10px">${v.claro_hogar||'--'}</td>
      <td style="font-size:10px">${v.tecnologia||'--'}</td>
      <td class="td-wrap" style="font-size:10px">${v.paquete||'--'}</td>
      <td style="font-family:monospace;font-size:10px">${v.telefonoContacto||'--'}</td>
      <td style="text-align:center">${tramo}</td>
      <td class="td-wrap" style="font-size:10px;background:rgba(255,255,200,.4)">${v._comentario||'--'}</td>
      <td>${motivoBadge(v._motivoRech)}</td>
    </tr>`;
  }).join('');
  renderPaginacion(total);
}

function renderPaginacion(total){
  const tp=Math.max(1,Math.ceil(total/porPagina));
  const cont=document.getElementById('paginacionBtns');
  let html=`<button class="pag-btn" onclick="irPagina(${paginaActual-1})" ${paginaActual===1?'disabled':''}>&#8249;</button>`;
  let ini=Math.max(1,paginaActual-3),fin2=Math.min(tp,ini+6);
  if(fin2-ini<6) ini=Math.max(1,fin2-6);
  if(ini>1) html+=`<button class="pag-btn" onclick="irPagina(1)">1</button>${ini>2?'<span style="padding:0 3px;color:#9ca3af">...</span>':''}`;
  for(let i=ini;i<=fin2;i++) html+=`<button class="pag-btn ${i===paginaActual?'active':''}" onclick="irPagina(${i})">${i}</button>`;
  if(fin2<tp) html+=`${fin2<tp-1?'<span style="padding:0 3px;color:#9ca3af">...</span>':''}<button class="pag-btn" onclick="irPagina(${tp})">${tp}</button>`;
  html+=`<button class="pag-btn" onclick="irPagina(${paginaActual+1})" ${paginaActual===tp?'disabled':''}>&#8250;</button>`;
  cont.innerHTML=html;
}
function irPagina(p){ paginaActual=Math.max(1,Math.min(p,Math.ceil(ventasFiltradas.length/porPagina)||1)); renderTabla(); document.querySelector('.tabla-scroll')?.scrollTo(0,0); }

function abrirModalEstado(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id;
  document.getElementById('est_nombre').textContent=v.nombreApellidos||'--';
  document.getElementById('est_actual').textContent=estadoObj(v._estadoSeg).label;
  document.getElementById('est_nuevo').value=v._estadoSeg||'';
  document.getElementById('est_tramo').value=v._tramo||'';
  document.getElementById('est_obs_general').value=v._comentario||'';
  actualizarCamposEstado(v._estadoSeg, v._motivoRech||'');
  document.getElementById('modalEstado').classList.add('open');
}

function actualizarCamposEstado(estado, valMotivo){
  const motivoWrap = document.getElementById('motivoWrap');
  const sel        = document.getElementById('est_motivo');
  motivoWrap.style.display = 'none';
  if (estado === 'caida' || estado === 'rechazo') {
    motivoWrap.style.display = '';
    const lista = estado === 'caida' ? MOTIVOS_CAIDA : MOTIVOS_RECH;
    sel.innerHTML = '<option value="">-- Seleccionar motivo --</option>' +
      lista.map(m=>`<option value="${m}" ${m===valMotivo?'selected':''}>${m}</option>`).join('');
  }
}

async function guardarEstado(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const nuevoEstado = document.getElementById('est_nuevo').value;
  v._estadoSeg  = nuevoEstado;
  v._tramo      = document.getElementById('est_tramo').value;
  v._comentario = document.getElementById('est_obs_general').value.trim() || v._comentario;
  if (nuevoEstado === 'caida' || nuevoEstado === 'rechazo') {
    v._motivoRech = document.getElementById('est_motivo').value;
  }
  const estadoBD = ESTADO_BD_MAP[v._estadoSeg] || 'aprobado';
  await guardarVentaBackend(v.id, { estado: estadoBD, observacion: v._comentario||'' });
  cerrarModal('modalEstado');
  aplicarFiltros();
  toast(`Estado: ${estadoObj(v._estadoSeg).label}`);
}

function abrirModalObs(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id;
  document.getElementById('obs_nombre').textContent=v.nombreApellidos||'--';
  const h=v._historial||[];
  document.getElementById('obs_historial').textContent=h.length?h.map(x=>`[${formatF(x.fecha)} ${x.hora} - ${x.user}] ${x.resultado} -- ${x.obs}`).join('\n'):'Sin historial.';
  document.getElementById('obs_resultado').value='';
  document.getElementById('obs_nueva').value='';
  document.getElementById('obs_comentario').value=v._comentario||'';
  document.getElementById('modalObs').classList.add('open');
}

async function guardarObservacion(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const obs=document.getElementById('obs_nueva').value.trim();
  if(!obs){ toast('Escribe una observacion'); return; }
  if(!v._historial) v._historial=[];
  const resultado=document.getElementById('obs_resultado').value||'Sin resultado';
  v._historial.push({fecha:fechaHoy(),hora:horaAhora(),user:usuarioActual,resultado,obs});
  v._comentario=document.getElementById('obs_comentario').value.trim()||v._comentario;
  hRegistrar(v.id,v,'Llamada registrada',resultado,obs.substring(0,60),'Seguimiento');
  await guardarVentaBackend(v.id, { observacion: v._comentario });
  cerrarModal('modalObs');
  aplicarFiltros();
  toast('Llamada registrada');
}

function abrirModalAgenda(id){
  const v=ventas.find(x=>x.id===id); if(!v) return;
  editandoId=id;
  document.getElementById('ag_nombre').textContent=v.nombreApellidos||'--';
  document.getElementById('ag_fecha').value=v._proxSeg||'';
  document.getElementById('ag_nota').value='';
  document.getElementById('modalAgenda').classList.add('open');
}

async function guardarAgenda(){
  const v=ventas.find(x=>x.id===editandoId); if(!v) return;
  const f=document.getElementById('ag_fecha').value;
  if(!f){ toast('Selecciona una fecha'); return; }
  v._proxSeg=f;
  const nota=document.getElementById('ag_nota').value.trim();
  if(nota){ if(!v._historial)v._historial=[]; v._historial.push({fecha:fechaHoy(),hora:horaAhora(),user:usuarioActual,resultado:'Agendado',obs:`Prox: ${formatF(f)}. ${nota}`}); }
  cerrarModal('modalAgenda');
  aplicarFiltros();
  toast(`Agendado: ${formatF(f)}`);
}

window.onload = async ()=>{
  const sesion=ncGetSesion(); if(sesion) usuarioActual=sesion.nombre||'Seguimiento';
  const topU=document.getElementById('topbarUser'); if(topU&&sesion) topU.textContent=sesion.nombre||'Seguimiento';
  ['f_estado','est_nuevo'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.innerHTML=`<option value="">${id==='f_estado'?'Todos los estados':'-- Estado --'}</option>`+ESTADOS.map(e=>`<option value="${e.id}">${e.label}</option>`).join(''); });
  ['f_tramo','est_tramo'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.innerHTML=`<option value="">Todos</option>`+TRAMOS.map(t=>`<option value="${t}">${t}</option>`).join(''); });
  const selR=document.getElementById('obs_resultado'); if(selR) selR.innerHTML='<option value="">-- Resultado --</option>'+RESULTADOS.map(r=>`<option value="${r}">${r}</option>`).join('');
  document.getElementById('est_nuevo')?.addEventListener('change', e=>{ const v=ventas.find(x=>x.id===editandoId); actualizarCamposEstado(e.target.value, v?._motivoRech||''); });
  await cargarVentas(); aplicarFiltros();
  ['modalEstado','modalObs','modalAgenda'].forEach(id=>{ document.getElementById(id)?.addEventListener('click',e=>{ if(e.target===document.getElementById(id)) cerrarModal(id); }); });
  document.getElementById('selectPorPagina')?.addEventListener('change',e=>{ porPagina=parseInt(e.target.value)||18; paginaActual=1; renderTabla(); });
  setInterval(async()=>{ await cargarVentas(); aplicarFiltros(); },60000);
};