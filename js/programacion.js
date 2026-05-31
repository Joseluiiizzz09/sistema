/* ================================================
   PROGRAMACION.JS — Módulo de Programación
   ================================================ */
const API_PROG = 'http://127.0.0.1:3000/api';

let ventasAll  = [];
let ventasFilt = [];
let ventaActiva = null;
let estadoModal = '';

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

function formatF(f) {
  if (!f) return '—';
  const d = f.split('T')[0] || f;
  const p = d.split('-');
  return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : f;
}

function badgeCls(estado) {
  const map = {
    'PROGRAMADO':'b-programado','INSTALADO':'b-instalado',
    'CAIDA':'b-caida','VALIDADO':'b-validado',
    'PENDIENTE':'b-pendiente','VENTA':'b-venta',
  };
  return map[(estado||'').toUpperCase()] || 'b-venta';
}

async function cargarVentas() {
  try {
    const res  = await fetch(API_PROG + '/ventas?programacion=1', { headers: ncHeaders() });
    const data = await res.json();
    if (!data.ok) { toast('Error cargando ventas'); return; }
    // Solo ventas que pasaron grabaciones (estado != VENTA ni vacío)
    ventasAll = data.data.filter(v => {
      const e = (v.estado||'').toUpperCase();
      return e !== 'VENTA' && e !== '';
    });
    actualizarKPIs();
    filtrarVentas();
  } catch(e) { toast('Error conectando al servidor'); }
}

function actualizarKPIs() {
  const e = (v, s) => (v.estado||'').toUpperCase() === s;
  document.getElementById('kpiTotal').textContent     = ventasAll.length;
  document.getElementById('kpiInstalado').textContent = ventasAll.filter(v=>e(v,'INSTALADO')).length;
  document.getElementById('kpiProgramado').textContent= ventasAll.filter(v=>e(v,'PROGRAMADO')).length;
  document.getElementById('kpiPendiente').textContent = ventasAll.filter(v=>e(v,'PENDIENTE')).length;
  document.getElementById('kpiCaida').textContent     = ventasAll.filter(v=>e(v,'CAIDA')).length;
}

function filtrarVentas() {
  const fEst   = document.getElementById('filtroEstado').value.toUpperCase();
  const fAs    = document.getElementById('filtroAsesor').value.toLowerCase();
  const fDesde = document.getElementById('filtroDesde').value;
  const fHasta = document.getElementById('filtroHasta').value;
  const fBus   = document.getElementById('tablaBuscar').value.toLowerCase();

  ventasFilt = ventasAll.filter(v => {
    const est  = (v.estado||'').toUpperCase();
    const fecha= (v.created_at||'').split('T')[0].split(' ')[0];
    if (fEst   && est !== fEst)                          return false;
    if (fAs    && !(v.asesor_nombre||'').toLowerCase().includes(fAs)) return false;
    if (fDesde && fecha < fDesde)                        return false;
    if (fHasta && fecha > fHasta)                        return false;
    if (fBus   && ![(v.dni||''),(v.nombre||''),(v.asesor_nombre||'')].join(' ').toLowerCase().includes(fBus)) return false;
    return true;
  });

  renderTabla();
}

function renderTabla() {
  const tbody = document.getElementById('tablaBody');
  document.getElementById('tablaCount').textContent = ventasFilt.length + ' registros';
  if (!ventasFilt.length) {
    tbody.innerHTML = '<tr class="tabla-empty"><td colspan="11">Sin registros con esos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = ventasFilt.map((v, i) => {
    const fecha = formatF((v.created_at||'').split(' ')[0]);
    const cls   = badgeCls(v.estado);
    return `<tr>
      <td style="color:#9ca3af;font-size:10px">${i+1}</td>
      <td style="font-size:11px;color:#374151;white-space:nowrap">${fecha}</td>
      <td style="font-weight:700;font-size:12px">${v.nombre||'—'}</td>
      <td style="font-family:monospace;font-size:12px">${v.dni||'—'}</td>
      <td style="font-size:12px">${v.asesor_nombre||'—'}</td>
      <td style="font-size:11px;color:#9ca3af">${v.sala||'—'}</td>
      <td style="font-size:11px">${v.distrito||'—'}</td>
      <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.paquete||''}">${v.paquete||'—'}</td>
      <td><span class="badge ${cls}">${v.estado||'—'}</span></td>
      <td style="font-size:11px;color:#6b7280;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.obs_programacion||'—'}</td>
      <td>
        <button class="btn-accion btn-ver-det" onclick="abrirDetalle(${v.id})">Ver / Editar</button>
      </td>
    </tr>`;
  }).join('');
}

function limpiarFiltros() {
  ['filtroEstado','filtroAsesor','filtroDesde','filtroHasta','tablaBuscar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filtrarVentas();
}

function abrirDetalle(id) {
  ventaActiva = ventasAll.find(v => v.id === id);
  if (!ventaActiva) return;
  estadoModal = ventaActiva.estado || '';

  const grid = document.getElementById('detalleGrid');
  const campo = (label, val) =>
    `<div class="det-campo"><label>${label}</label><span>${val||'—'}</span></div>`;

  grid.innerHTML =
    campo('Nombre', ventaActiva.nombre) +
    campo('DNI / Doc.', (ventaActiva.tipo_doc||'DNI') + ': ' + ventaActiva.dni) +
    campo('Teléfono 1', ventaActiva.telefono1) +
    campo('Teléfono 2', ventaActiva.telefono2) +
    campo('Asesor', ventaActiva.asesor_nombre) +
    campo('Sala', ventaActiva.sala) +
    campo('Departamento', ventaActiva.departamento) +
    campo('Distrito', ventaActiva.distrito) +
    campo('Claro Hogar', ventaActiva.claro_hogar) +
    campo('Tecnología', ventaActiva.tecnologia) +
    `<div class="det-campo det-full"><label>Paquete Real</label><span>${ventaActiva.paquete||'—'}</span></div>` +
    campo('Decos', ventaActiva.cant_decos) +
    campo('Mesh', ventaActiva.cant_mesh) +
    campo('Plano', ventaActiva.plano) +
    campo('Cuota Inst.', ventaActiva.cuota_inst) +
    campo('Full Claro', ventaActiva.full_claro) +
    `<div class="det-campo det-full"><label>Dirección</label><span>${ventaActiva.direccion||'—'}</span></div>` +
    campo('Coordenadas', ventaActiva.coordenadas) +
    campo('Fecha ingreso', formatF((ventaActiva.created_at||'').split(' ')[0]));

  document.getElementById('obsProg').value = ventaActiva.obs_programacion || '';
  document.getElementById('estadoSelLabel').textContent = 'Estado actual: ' + estadoModal;
  document.getElementById('modalDetalle').classList.add('open');
}

function setEstadoModal(estado) {
  estadoModal = estado;
  document.getElementById('estadoSelLabel').textContent = 'Nuevo estado: ' + estado;
}

async function guardarCambios() {
  if (!ventaActiva) return;
  const obs = document.getElementById('obsProg').value.trim();
  try {
    const res  = await fetch(`${API_PROG}/ventas/${ventaActiva.id}`, {
      method: 'PATCH', headers: ncHeaders(),
      body: JSON.stringify({ estado: estadoModal, obs_programacion: obs }),
    });
    const data = await res.json();
    if (!data.ok) { toast('Error actualizando'); return; }
    ventaActiva.estado = estadoModal;
    ventaActiva.obs_programacion = obs;
    cerrarModal();
    actualizarKPIs();
    filtrarVentas();
    toast('✅ Venta actualizada');
  } catch(e) { toast('Error conectando al servidor'); }
}

function cerrarModal() {
  document.getElementById('modalDetalle').classList.remove('open');
  ventaActiva = null; estadoModal = '';
}

window.onload = async () => {
  const u = ncGetSesion();
  if (u) {
    const el = document.getElementById('topbarUser');
    if (el) el.textContent = u.nombre || 'Programación';
  }
  await cargarVentas();
  document.getElementById('modalDetalle').addEventListener('click', e => {
    if (e.target === document.getElementById('modalDetalle')) cerrarModal();
  });
};