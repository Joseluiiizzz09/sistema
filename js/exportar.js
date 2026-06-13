/* ================================================
   EXPORTAR.JS — Netcontact Jefatura
   Conectado a Node.js backend
   ================================================ */

const API_EXP = window.NC_API + '/api';

function cargarScript(src, cb){
  if(document.querySelector(`script[src="${src}"]`)){ cb(); return; }
  const s=document.createElement('script'); s.src=src; s.onload=cb;
  document.head.appendChild(s);
}

async function expGetVentasAPI(){
  try { const res=await fetch(API_EXP+'/ventas',{headers:ncHeaders()}); const d=await res.json(); return d.ok?d.data:[]; } catch(e){ return []; }
}
async function expGetUsuariosAPI(){
  try { const res=await fetch(API_EXP+'/usuarios',{headers:ncHeaders()}); const d=await res.json(); return d.ok?d.data:[]; } catch(e){ return []; }
}
function expGetHistorial(){ try{ const r=localStorage.getItem('nc_historial'); return r?JSON.parse(r):[]; }catch(e){ return []; } }
function formatFExp(f){ if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

function expInyectarModal(){
  if(document.getElementById('modalExportar')) return;
  const css=`<style id="exp-css">
  .exp-modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:600;align-items:center;justify-content:center;}
  .exp-modal-bg.open{display:flex;}
  .exp-box{background:#fff;border-radius:18px;padding:26px 28px;width:min(480px,94vw);max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:expAp .2s ease;}
  @keyframes expAp{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
  .exp-title{font-size:16px;font-weight:700;margin-bottom:4px;color:#111827;}
  .exp-sub{font-size:12px;color:#9ca3af;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #e5e7eb;}
  .exp-section{margin-bottom:18px;}
  .exp-section-title{font-size:10px;font-weight:700;color:#ff2d2d;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;}
  .exp-opciones{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .exp-opcion{border:1.5px solid #e5e7eb;border-radius:12px;padding:14px 16px;cursor:pointer;transition:all .18s;text-align:center;background:#fafafa;}
  .exp-opcion:hover{border-color:#111827;background:#f3f4f6;transform:translateY(-1px);}
  .exp-opcion.selected{border-color:#111827;background:#111827;color:#fff;}
  .exp-opcion .exp-ico{font-size:24px;margin-bottom:6px;}
  .exp-opcion .exp-nom{font-size:13px;font-weight:700;}
  .exp-opcion .exp-desc{font-size:10px;color:#9ca3af;margin-top:2px;}
  .exp-opcion.selected .exp-desc{color:rgba(255,255,255,.6);}
  .exp-filtros{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
  .exp-fg{display:flex;flex-direction:column;gap:4px;}
  .exp-fg label{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.3px;}
  .exp-fg select,.exp-fg input{padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:#fafafa;color:#111827;}
  .exp-preview{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;font-size:12px;color:#6b7280;margin-bottom:14px;display:none;}
  .exp-preview.show{display:block;}
  .exp-preview strong{color:#111827;}
  .exp-btns{display:flex;gap:8px;justify-content:flex-end;padding-top:14px;border-top:1px solid #e5e7eb;}
  .exp-btn-go{padding:10px 22px;background:#111827;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:background .18s;display:flex;align-items:center;gap:7px;}
  .exp-btn-go:hover{background:#1f2937;}
  .exp-btn-go:disabled{background:#9ca3af;cursor:not-allowed;}
  .exp-btn-cancel{padding:10px 14px;background:#fff;color:#6b7280;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;}
  .exp-btn-cancel:hover{background:#f3f4f6;}
  .exp-progress{height:3px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-top:8px;display:none;}
  .exp-progress.show{display:block;}
  .exp-progress-fill{height:100%;background:#ff2d2d;border-radius:99px;width:0%;transition:width .4s;}
  </style>`;

  const html=`<div class="exp-modal-bg" id="modalExportar"><div class="exp-box">
    <div class="exp-title">📊 Exportar datos</div>
    <div class="exp-sub">Selecciona qué exportar y en qué formato.</div>
    <div class="exp-section">
      <div class="exp-section-title">¿Qué quieres exportar?</div>
      <div class="exp-opciones">
        <div class="exp-opcion selected" id="expTipoVentas" onclick="expSelTipo('ventas')"><div class="exp-ico">📋</div><div class="exp-nom">Ventas</div><div class="exp-desc">Todos los registros de ventas</div></div>
        <div class="exp-opcion" id="expTipoUsuarios" onclick="expSelTipo('usuarios')"><div class="exp-ico">👥</div><div class="exp-nom">Usuarios</div><div class="exp-desc">Lista de usuarios del sistema</div></div>
        <div class="exp-opcion" id="expTipoHistorial" onclick="expSelTipo('historial')"><div class="exp-ico">📜</div><div class="exp-nom">Historial</div><div class="exp-desc">Log de cambios por venta</div></div>
      </div>
    </div>
    <div class="exp-section" id="expFiltrosSection">
      <div class="exp-section-title">Filtros (opcional)</div>
      <div class="exp-filtros">
        <div class="exp-fg"><label>Estado</label><select id="expFEstado"><option value="">Todos</option><option value="VENTA">Venta</option><option value="validado">Validado</option><option value="instalado">Instalado</option><option value="programado">Programado</option><option value="caida">Caída</option></select></div>
        <div class="exp-fg"><label>Desde</label><input type="date" id="expFDesde"></div>
        <div class="exp-fg"><label>Hasta</label><input type="date" id="expFHasta"></div>
      </div>
    </div>
    <div class="exp-section">
      <div class="exp-section-title">Formato de exportación</div>
      <div class="exp-opciones">
        <div class="exp-opcion selected" id="expFmtExcel" onclick="expSelFmt('excel')"><div class="exp-ico">📗</div><div class="exp-nom">Excel (.xlsx)</div><div class="exp-desc">Abre en Microsoft Excel</div></div>
        <div class="exp-opcion" id="expFmtCSV" onclick="expSelFmt('csv')"><div class="exp-ico">📃</div><div class="exp-nom">CSV</div><div class="exp-desc">Compatible con cualquier app</div></div>
      </div>
    </div>
    <div class="exp-preview" id="expPreview"></div>
    <div class="exp-progress" id="expProgress"><div class="exp-progress-fill" id="expProgressFill"></div></div>
    <div class="exp-btns">
      <button class="exp-btn-cancel" onclick="expCerrar()">Cancelar</button>
      <button class="exp-btn-go" id="expBtnGo" onclick="expEjecutar()"><span>⬇️</span> Exportar</button>
    </div>
  </div></div>`;

  document.head.insertAdjacentHTML('beforeend',css);
  document.body.insertAdjacentHTML('beforeend',html);
  document.getElementById('modalExportar').addEventListener('click',e=>{ if(e.target===document.getElementById('modalExportar')) expCerrar(); });
}

let expTipo='ventas', expFmt='excel';

function expSelTipo(tipo){
  expTipo=tipo;
  document.querySelectorAll('.exp-opcion[id^="expTipo"]').forEach(el=>el.classList.remove('selected'));
  document.getElementById('expTipo'+tipo.charAt(0).toUpperCase()+tipo.slice(1)).classList.add('selected');
  document.getElementById('expFiltrosSection').style.display=tipo==='ventas'?'':'none';
}
function expSelFmt(fmt){
  expFmt=fmt;
  document.querySelectorAll('.exp-opcion[id^="expFmt"]').forEach(el=>el.classList.remove('selected'));
  document.getElementById('expFmt'+fmt.charAt(0).toUpperCase()+fmt.slice(1)).classList.add('selected');
}
function expCerrar(){ document.getElementById('modalExportar')?.classList.remove('open'); }

async function abrirModalExportar(){
  expInyectarModal();
  expTipo='ventas'; expFmt='excel';
  document.querySelectorAll('.exp-opcion').forEach(el=>el.classList.remove('selected'));
  document.getElementById('expTipoVentas')?.classList.add('selected');
  document.getElementById('expFmtExcel')?.classList.add('selected');
  document.getElementById('expFiltrosSection').style.display='';
  ['expFEstado','expFDesde','expFHasta'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('expProgress')?.classList.remove('show');
  document.getElementById('modalExportar').classList.add('open');
}

async function expEjecutar(){
  const btn=document.getElementById('expBtnGo');
  btn.disabled=true; btn.innerHTML='⏳ Cargando datos...';
  const prog=document.getElementById('expProgress'), fill=document.getElementById('expProgressFill');
  prog.classList.add('show'); fill.style.width='30%';

  let data=[];
  if(expTipo==='ventas'){
    data=await expGetVentasAPI();
    const fEst=document.getElementById('expFEstado')?.value||'';
    const fD=document.getElementById('expFDesde')?.value||'';
    const fH=document.getElementById('expFHasta')?.value||'';
    if(fEst) data=data.filter(v=>v.estado===fEst);
    if(fD)   data=data.filter(v=>(v.created_at||'').split(' ')[0]>=fD);
    if(fH)   data=data.filter(v=>(v.created_at||'').split(' ')[0]<=fH);
  } else if(expTipo==='usuarios'){
    data=await expGetUsuariosAPI();
  } else if(expTipo==='historial'){
    data=expGetHistorial();
  }

  if(!data.length){ alert('Sin datos para exportar.'); btn.disabled=false; btn.innerHTML='⬇️ Exportar'; prog.classList.remove('show'); return; }

  fill.style.width='70%';
  setTimeout(()=>{
    fill.style.width='100%';
    try{
      if(expFmt==='excel') expExcel(data);
      else if(expFmt==='csv') expCSV(data);
    }catch(err){ console.error(err); alert('Error al exportar: '+err.message); }
    setTimeout(()=>{ btn.disabled=false; btn.innerHTML='⬇️ Exportar'; prog.classList.remove('show'); fill.style.width='0%'; expCerrar(); },500);
  },300);
}

function expExcel(data){
  cargarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',()=>{
    const XLSX=window.XLSX, wb=XLSX.utils.book_new();
    const rows=expTransformar(data);
    const ws=XLSX.utils.json_to_sheet(rows);
    ws['!cols']=Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,14)}));
    XLSX.utils.book_append_sheet(wb,ws,expTipo.charAt(0).toUpperCase()+expTipo.slice(1));
    XLSX.writeFile(wb,`netcontact_${expTipo}_${new Date().toISOString().split('T')[0]}.xlsx`);
  });
}

function expCSV(data){
  const rows=expTransformar(data); if(!rows.length) return;
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(','),...rows.map(r=>headers.map(h=>`"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=`netcontact_${expTipo}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
}

function expTransformar(data){
  if(expTipo==='ventas'){
    return data.map(v=>({
      'Fecha':           (v.created_at||'').split(' ')[0]||'—',
      'Estado':          v.estado||'—',
      'Nombre':          v.nombre||'—',
      'DNI':             v.dni||'—',
      'Tel. Contacto':   v.telefono1||'—',
      'Tel. Referencia': v.telefono2||'—',
      'Email':           v.email||'—',
      'Departamento':    v.departamento||'—',
      'Provincia':       v.provincia||'—',
      'Distrito':        v.distrito||'—',
      'Dirección':       v.direccion||'—',
      'Claro Hogar':     v.claro_hogar||'—',
      'Tecnología':      v.tecnologia||'—',
      'Paquete':         v.paquete||'—',
      'Full Claro':      v.full_claro||'—',
      'Asesor':          v.asesor_nombre||'—',
      'Sala':            v.sala||'—',
      'Observación':     v.observacion||'—',
      'Obs. BackOffice': v.obs_backoffice||'—',
    }));
  }
  if(expTipo==='usuarios'){
    return data.map(u=>({
      'Nombre':  u.nombre||'—',
      'Usuario': u.usuario||'—',
      'Cargo':   u.cargo||'—',
      'Sala':    u.sala||'—',
      'Estado':  u.activo?'Activo':'Inactivo',
      'Creado':  (u.created_at||'').split(' ')[0]||'—',
    }));
  }
  if(expTipo==='historial'){
    return data.map(h=>({
      'Fecha':    h.fecha||'—', 'Hora':h.hora||'—', 'Módulo':h.modulo||'—',
      'Campo':    h.campo||'—', 'Anterior':h.anterior||'—', 'Nuevo':h.nuevo||'—',
      'Cliente':  h.nombre||'—', 'DNI':h.dni||'—', 'Tel.':h.n1||'—',
      'Usuario':  h.usuario||'—', 'Cargo':h.cargo||'—',
    }));
  }
  return data;
}