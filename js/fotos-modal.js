/* ================================================
   FOTOS-MODAL.JS — Solo LECTURA de fotos/archivos
   subidos por el asesor desde el dashboard.
   Incluir en validacion, grabaciones, seguimiento,
   supgrabaciones, supervisor, programacion, etc.
   ================================================ */

const API_FM = window.NC_API + '/api';

function inyectarModalFotos() {
  if (document.getElementById('modalFotosVisor')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="modalFotosVisor" class="fmv-overlay" style="display:none" onclick="cerrarVisorFotos(event)">
      <div class="fmv-box" onclick="event.stopPropagation()">
        <div class="fmv-header">
          <div>
            <h3 class="fmv-title">📎 Archivos adjuntos</h3>
            <p class="fmv-subtitle" id="fmvSubtitle"></p>
          </div>
          <button class="fmv-close" onclick="cerrarVisorFotos()">✕</button>
        </div>
        <div class="fmv-body">
          <div class="fmv-grid" id="fmvGrid">
            <div class="fmv-loading">Cargando...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div id="fmvLightbox" class="fmv-lightbox" style="display:none" onclick="cerrarFmvLightbox()">
      <button class="fmv-lb-nav fmv-lb-prev" onclick="event.stopPropagation();fmvNav(-1)">‹</button>
      <img id="fmvLightboxImg" src="" alt="foto" onclick="event.stopPropagation()">
      <button class="fmv-lb-nav fmv-lb-next" onclick="event.stopPropagation();fmvNav(1)">›</button>
      <button class="fmv-lb-close" onclick="cerrarFmvLightbox()">✕</button>
      <div class="fmv-lb-info" id="fmvLbInfo"></div>
    </div>
  `);
  inyectarEstilosVisor();
}

let _fmvVentaId  = null;
let _fmvNombre   = '';
let _fmvFotos    = []; // solo imágenes para lightbox
let _fmvLbIndex  = 0;

async function abrirModalFotos(ventaId, nombreCliente) {
  inyectarModalFotos();
  _fmvVentaId = ventaId;
  _fmvNombre  = nombreCliente || 'Cliente';
  document.getElementById('fmvSubtitle').textContent = _fmvNombre;
  document.getElementById('fmvGrid').innerHTML = '<div class="fmv-loading">Cargando archivos...</div>';
  document.getElementById('modalFotosVisor').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await fmvCargar();
}

function cerrarVisorFotos(e) {
  if (e && e.target !== document.getElementById('modalFotosVisor')) return;
  document.getElementById('modalFotosVisor').style.display = 'none';
  document.body.style.overflow = '';
}

async function fmvCargar() {
  const token = typeof ncGetToken === 'function' ? ncGetToken() : (sessionStorage.getItem('nc_token') || '');
  try {
    const res  = await fetch(`${API_FM}/ventas/${_fmvVentaId}/fotos`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    // El backend devuelve { ok: true, data: [...] }
    const archivos = data.data || data.fotos || [];
    fmvRender(archivos);
  } catch(e) {
    document.getElementById('fmvGrid').innerHTML = '<div class="fmv-empty">Error al cargar archivos.</div>';
  }
}

function fmvRender(archivos) {
  const grid = document.getElementById('fmvGrid');
  if (!archivos.length) {
    grid.innerHTML = '<div class="fmv-empty">El asesor no ha adjuntado fotos ni archivos en esta venta.</div>';
    return;
  }

  const baseUrl = window.NC_API + '/';
  // Guardar solo imágenes para el lightbox
  _fmvFotos = archivos.filter(f => (f.mimetype||f.tipo||'').startsWith('image'));

  grid.innerHTML = archivos.map((f, i) => {
    const url     = f.ruta ? baseUrl + f.ruta : (f.url || '');
    const tipo    = f.mimetype || f.tipo || '';
    const nombre  = f.nombre || 'archivo';
    const fecha   = (f.created_at || f.fecha || '').split(' ')[0] || '—';
    const esImg   = tipo.startsWith('image');
    const esPdf   = tipo === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf');
    const lbIdx   = esImg ? _fmvFotos.findIndex(x => x === f) : -1;

    const preview = esImg
      ? `<div class="fmv-card-img" onclick="fmvAbrirLightbox(${lbIdx})">
           <img src="${url}" alt="${nombre}" loading="lazy"
                onerror="this.parentElement.innerHTML='<div class=fmv-img-err>🖼️</div>'">
           <div class="fmv-card-zoom">🔍</div>
         </div>`
      : `<div class="fmv-card-img fmv-card-pdf" onclick="window.open('${url}','_blank')">
           <div class="fmv-pdf-icon">📄</div>
           <div class="fmv-pdf-label">PDF</div>
           <div class="fmv-card-zoom">Abrir</div>
         </div>`;

    return `<div class="fmv-card">
      ${preview}
      <div class="fmv-card-info">
        <span class="fmv-card-nombre" title="${nombre}">${nombre}</span>
        <span class="fmv-card-fecha">${fecha}</span>
      </div>
      <a class="fmv-btn-dl" href="${url}" download="${nombre}" target="_blank">⬇ Descargar</a>
    </div>`;
  }).join('');
}

function fmvAbrirLightbox(idx) {
  if (idx < 0 || !_fmvFotos[idx]) return;
  _fmvLbIndex = idx;
  fmvShowLightbox();
}

function fmvShowLightbox() {
  const lb   = document.getElementById('fmvLightbox');
  const img  = document.getElementById('fmvLightboxImg');
  const info = document.getElementById('fmvLbInfo');
  const f    = _fmvFotos[_fmvLbIndex];
  const baseUrl = window.NC_API + '/';
  const url  = f.ruta ? baseUrl + f.ruta : (f.url || '');
  img.src    = url;
  info.textContent = `${_fmvLbIndex + 1} / ${_fmvFotos.length} · ${f.nombre || ''}`;
  lb.style.display = 'flex';
}

function fmvNav(dir) {
  _fmvLbIndex = (_fmvLbIndex + dir + _fmvFotos.length) % _fmvFotos.length;
  fmvShowLightbox();
}

function cerrarFmvLightbox() {
  document.getElementById('fmvLightbox').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (document.getElementById('fmvLightbox')?.style.display !== 'none') {
    if (e.key === 'ArrowLeft')  fmvNav(-1);
    if (e.key === 'ArrowRight') fmvNav(1);
    if (e.key === 'Escape')     cerrarFmvLightbox();
  }
  if (e.key === 'Escape' && document.getElementById('modalFotosVisor')?.style.display !== 'none') {
    document.getElementById('modalFotosVisor').style.display = 'none';
    document.body.style.overflow = '';
  }
});

function inyectarEstilosVisor() {
  if (document.getElementById('fmv-styles')) return;
  const s = document.createElement('style');
  s.id = 'fmv-styles';
  s.textContent = `
    .fmv-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    }
    .fmv-box {
      background: #fff; border-radius: 18px; width: 100%;
      max-width: 820px; max-height: 88vh;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,.25); overflow: hidden;
    }
    .fmv-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 20px 24px 16px; border-bottom: 1px solid #f0f0f0;
      background: #fff; border-radius: 18px 18px 0 0; flex-shrink: 0;
    }
    .fmv-title  { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1a1a2e; }
    .fmv-subtitle { margin: 3px 0 0; font-size: 0.82rem; color: #888; }
    .fmv-close {
      background: #f5f5f5; border: none; border-radius: 50%;
      width: 32px; height: 32px; cursor: pointer; font-size: .9rem;
      color: #555; transition: background .2s; flex-shrink: 0;
    }
    .fmv-close:hover { background: #e0e0e0; }
    .fmv-body { overflow-y: auto; flex: 1; padding: 20px 24px 24px; }
    .fmv-loading, .fmv-empty {
      text-align: center; padding: 48px 24px;
      color: #aaa; font-size: .9rem;
    }
    .fmv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 14px;
    }
    .fmv-card {
      border: 1px solid #eee; border-radius: 12px; overflow: hidden;
      background: #fafafa; display: flex; flex-direction: column;
      transition: box-shadow .2s;
    }
    .fmv-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,.10); }
    .fmv-card-img {
      position: relative; width: 100%; aspect-ratio: 1/1;
      overflow: hidden; cursor: zoom-in; background: #f3f4f6;
    }
    .fmv-card-img img {
      width: 100%; height: 100%; object-fit: cover; display: block;
      transition: transform .25s;
    }
    .fmv-card-img:hover img { transform: scale(1.05); }
    .fmv-card-zoom {
      position: absolute; inset: 0; background: rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; opacity: 0; transition: opacity .2s;
    }
    .fmv-card-img:hover .fmv-card-zoom { opacity: 1; }
    .fmv-card-pdf { cursor: pointer; flex-direction: column; justify-content: center; gap: 4px; }
    .fmv-pdf-icon { font-size: 2.6rem; }
    .fmv-pdf-label { font-size: .75rem; font-weight: 700; color: #dc2626; }
    .fmv-img-err  { display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem; }
    .fmv-card-info { padding: 7px 9px 2px; flex: 1; }
    .fmv-card-nombre {
      font-size: .72rem; color: #444; display: block;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;
    }
    .fmv-card-fecha { font-size: .68rem; color: #aaa; display: block; margin-top: 1px; }
    .fmv-btn-dl {
      display: block; text-align: center; padding: 6px;
      background: #f3f4f6; color: #374151; font-size: .72rem;
      font-weight: 600; text-decoration: none; transition: background .2s;
      border-top: 1px solid #eee;
    }
    .fmv-btn-dl:hover { background: #e5e7eb; }
    /* Lightbox */
    .fmv-lightbox {
      position: fixed; inset: 0; background: rgba(0,0,0,.93);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000; cursor: zoom-out;
    }
    .fmv-lightbox img {
      max-width: 90vw; max-height: 88vh;
      border-radius: 8px; object-fit: contain; cursor: default;
    }
    .fmv-lb-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(255,255,255,.12); border: none; color: #fff;
      font-size: 2.5rem; width: 50px; height: 80px; border-radius: 8px;
      cursor: pointer; transition: background .2s;
    }
    .fmv-lb-nav:hover { background: rgba(255,255,255,.25); }
    .fmv-lb-prev { left: 16px; }
    .fmv-lb-next { right: 16px; }
    .fmv-lb-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,.15); border: none; color: #fff;
      border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 1rem;
    }
    .fmv-lb-info {
      position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,.7); font-size: .82rem; white-space: nowrap;
    }
    /* Botón en tabla */
    .btn-fotos {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff; border: none; border-radius: 6px;
      padding: 4px 10px; cursor: pointer; font-size: .75rem;
      font-weight: 600; transition: opacity .2s; white-space: nowrap;
    }
    .btn-fotos:hover { opacity: .85; }
  `;
  document.head.appendChild(s);
}
