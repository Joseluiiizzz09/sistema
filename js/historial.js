/* ================================================
   HISTORIAL.JS — Netcontact
   ================================================ */

function hGetAll(){
  try{ const r=localStorage.getItem('nc_historial'); return r?JSON.parse(r):[]; }catch(e){ return []; }
}
function hSave(data){
  try{ localStorage.setItem('nc_historial', JSON.stringify(data.slice(0,2000))); }catch(e){}
}

function hRegistrar(ventaId, ventaInfo, campo, anterior, nuevo, modulo){
  const sesion = (() => {
    try{ return typeof ncGetSesion==='function' ? (ncGetSesion()||{}) : JSON.parse(sessionStorage.getItem('nc_usuario')||'{}'); }catch(e){ return {}; }
  })();
  const ahora = new Date();
  const registro = {
    id: Date.now(), ventaId,
    nombre: ventaInfo?.nombre || '—',
    dni:    ventaInfo?.dni    || '—',
    n1:     ventaInfo?.n1     || ventaInfo?.telefonoContacto || '—',
    campo, anterior: anterior||'—', nuevo: nuevo||'—', modulo,
    usuario: sesion.nombre || 'Sistema',
    cargo:   sesion.cargo  || '—',
    fecha: ahora.toISOString().split('T')[0],
    hora:  ahora.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}),
  };
  const todos = hGetAll();
  todos.unshift(registro);
  hSave(todos);
}

function hGetVenta(ventaId){ return hGetAll().filter(r=>r.ventaId===ventaId); }

function hInyectarModal(){
  if(document.getElementById('modalHistorial')) return;
  const css=`<style id="historial-css">
  .h-modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:500;align-items:center;justify-content:center;}
  .h-modal-bg.open{display:flex;}
  .h-modal-box{background:#fff;border-radius:16px;padding:24px 26px;width:min(620px,94vw);max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:hAparecer .2s ease;}
  @keyframes hAparecer{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
  .h-title{font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;}
  .h-sub{font-size:12px;color:#9ca3af;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;}
  .h-empty{text-align:center;color:#9ca3af;padding:32px;font-size:13px;}
  .h-item{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6;}
  .h-item:last-child{border-bottom:none;}
  .h-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:4px;}
  .h-content{flex:1;}
  .h-campo{font-size:13px;font-weight:700;color:#111827;}
  .h-cambio{font-size:12px;margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .h-ant{background:#fee2e2;color:#7f1d1d;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:600;text-decoration:line-through;}
  .h-arr{font-size:12px;color:#9ca3af;}
  .h-nvo{background:#dcfce7;color:#14532d;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:600;}
  .h-meta{font-size:10px;color:#9ca3af;margin-top:4px;}
  .h-meta strong{color:#7C3AED;}
  .h-modulo{display:inline-block;padding:1px 7px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;}
  .hm-val{background:#fef3c7;color:#78350f;} .hm-seg{background:#e0f2fe;color:#0c4a6e;} .hm-grab{background:#dcfce7;color:#14532d;} .hm-otro{background:#f3f4f6;color:#374151;}
  .h-close{float:right;background:none;border:none;cursor:pointer;font-size:18px;color:#9ca3af;padding:0;line-height:1;transition:color .15s;}
  .h-close:hover{color:#374151;}
  .h-filtros{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap;}
  .h-filtro-btn{padding:4px 12px;border:1px solid #e5e7eb;border-radius:99px;background:#fff;color:#6b7280;font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;}
  .h-filtro-btn:hover{border-color:#111827;color:#111827;}
  .h-filtro-btn.active{background:#111827;color:#fff;border-color:#111827;}
  </style>`;
  const html=`<div class="h-modal-bg" id="modalHistorial"><div class="h-modal-box"><button class="h-close" onclick="hCerrar()">✕</button><div class="h-title" id="hModalTitulo">Historial de cambios</div><div class="h-sub" id="hModalSub"></div><div class="h-filtros" id="hFiltros"></div><div id="hLista"></div></div></div>`;
  document.head.insertAdjacentHTML('beforeend',css);
  document.body.insertAdjacentHTML('beforeend',html);
  document.getElementById('modalHistorial').addEventListener('click',e=>{ if(e.target===document.getElementById('modalHistorial')) hCerrar(); });
}

let hVentaActual=null, hFiltroActivo='todos';

function hAbrir(ventaId, ventaInfo){
  hInyectarModal();
  hVentaActual=ventaId; hFiltroActivo='todos';
  document.getElementById('hModalTitulo').textContent=`Historial — ${ventaInfo?.nombre||'Venta #'+ventaId}`;
  document.getElementById('hModalSub').textContent=`DNI: ${ventaInfo?.dni||'—'} · Tel: ${ventaInfo?.n1||ventaInfo?.telefonoContacto||'—'}`;
  hRenderFiltros(ventaId); hRenderLista(ventaId);
  document.getElementById('modalHistorial').classList.add('open');
}

function hCerrar(){ document.getElementById('modalHistorial')?.classList.remove('open'); }

function hRenderFiltros(ventaId){
  const registros=hGetVenta(ventaId);
  const modulos=[...new Set(registros.map(r=>r.modulo))];
  const cont=document.getElementById('hFiltros');
  let html=`<button class="h-filtro-btn active" onclick="hSetFiltro('todos',this)">Todos (${registros.length})</button>`;
  modulos.forEach(m=>{ const cnt=registros.filter(r=>r.modulo===m).length; html+=`<button class="h-filtro-btn" onclick="hSetFiltro('${m}',this)">${m} (${cnt})</button>`; });
  cont.innerHTML=html;
}

function hSetFiltro(filtro,btn){
  hFiltroActivo=filtro;
  document.querySelectorAll('#hFiltros .h-filtro-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  hRenderLista(hVentaActual);
}

function hColorDot(modulo){ const m={'Validación':'#d97706','Seguimiento':'#0891b2','Grabaciones':'#16a34a'}; return m[modulo]||'#7C3AED'; }
function hClsModulo(modulo){ const m={'Validación':'hm-val','Seguimiento':'hm-seg','Grabaciones':'hm-grab'}; return m[modulo]||'hm-otro'; }

function hRenderLista(ventaId){
  let registros=hGetVenta(ventaId);
  if(hFiltroActivo!=='todos') registros=registros.filter(r=>r.modulo===hFiltroActivo);
  const cont=document.getElementById('hLista');
  if(!registros.length){ cont.innerHTML=`<div class="h-empty">Sin cambios registrados${hFiltroActivo!=='todos'?' en '+hFiltroActivo:''}.</div>`; return; }
  cont.innerHTML=registros.map(r=>`<div class="h-item"><div class="h-dot" style="background:${hColorDot(r.modulo)}"></div><div class="h-content"><div class="h-campo">${r.campo}<span class="h-modulo ${hClsModulo(r.modulo)}">${r.modulo}</span></div><div class="h-cambio"><span class="h-ant">${r.anterior}</span><span class="h-arr">→</span><span class="h-nvo">${r.nuevo}</span></div><div class="h-meta"><strong>${r.usuario}</strong> · ${r.cargo} · ${r.fecha} ${r.hora}</div></div></div>`).join('');
}
