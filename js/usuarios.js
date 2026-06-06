/* ================================================
   USUARIOS.JS — Conectado a Node.js backend
   Sin emojis, clases CSS correctas
   ================================================ */

const API = 'http://127.0.0.1:3000/api';
let usuarios = [];
let editandoId = null;
let eliminandoId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await cargarUsuarios();
  actualizarKPIs();
  renderTabla();
  document.getElementById('u_activo')?.addEventListener('change', function () {
    document.getElementById('toggleLabel').textContent = this.checked ? 'Activo' : 'Inactivo';
  });
});

async function cargarUsuarios() {
  const tbody = document.getElementById('tablaBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Cargando...</td></tr>';
  try {
    const res  = await fetch(`${API}/usuarios`, { headers: ncHeaders() });
    const data = await res.json();
    if (!data.ok) { mostrarToast(data.mensaje); return; }
    usuarios = data.data;
  } catch(e) { mostrarToast('Error conectando al servidor'); }
}

function actualizarKPIs() {
  document.getElementById('kpiTotal').textContent        = usuarios.length;
  document.getElementById('kpiActivos').textContent      = usuarios.filter(u => u.activo).length;
  document.getElementById('kpiInactivos').textContent    = usuarios.filter(u => !u.activo).length;
  document.getElementById('kpiAsesores').textContent     = usuarios.filter(u => u.cargo === 'asesor').length;
  document.getElementById('kpiSupervisores').textContent = usuarios.filter(u => u.cargo === 'supervisor').length;
}

const CARGO_CLASE = {
  asesor:'bc-asesor', supervisor:'bc-supervisor', backoffice:'bc-backoffice',
  validacion:'bc-validacion', grabaciones:'bc-grabaciones', seguimiento:'bc-seguimiento',
  jefatura:'bc-jefatura', programacion:'bc-programacion', supgrabaciones:'bc-supgrabaciones',
  usuarios:'bc-usuarios'
};

function renderTabla(lista) {
  const data  = lista !== undefined ? lista : usuarios;
  const tbody = document.getElementById('tablaBody');
  const info  = document.getElementById('contadorInfo');
  if (info) info.textContent = `${data.length} usuario${data.length !== 1 ? 's' : ''} encontrado${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Sin usuarios registrados</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((u, i) => {
    const fecha    = u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE') : '—';
    const cargoCls = CARGO_CLASE[u.cargo] || 'bc-default';

    const estadoBadge = u.activo
      ? '<span style="display:inline-flex;padding:3px 9px;border-radius:6px;font-size:10px;font-weight:700;background:#dcfce7;color:#15803d;">Activo</span>'
      : '<span style="display:inline-flex;padding:3px 9px;border-radius:6px;font-size:10px;font-weight:700;background:#fee2e2;color:#991b1b;">Inactivo</span>';

    const btnToggle = u.activo
      ? `<button class="btn-acc-toggle btn-desact" onclick="toggleEstado(${u.id}, false)">Desactivar</button>`
      : `<button class="btn-acc-toggle btn-act"   onclick="toggleEstado(${u.id}, true)">Activar</button>`;

    return `<tr>
      <td style="color:#9ca3af;font-size:11px;">${i+1}</td>
      <td>
        <div class="nombre-main">${u.nombre}</div>
        <span class="nombre-sub">Género: ${u.genero === 'F' ? 'Femenino' : 'Masculino'}</span>
      </td>
      <td style="font-family:monospace;font-size:12px;font-weight:600;color:#374151;">@${u.usuario}</td>
      <td><span class="badge-cargo ${cargoCls}">${u.cargo.toUpperCase()}</span></td>
      <td style="font-size:12px;color:#374151;">${u.sala || '—'}</td>
      <td>${estadoBadge}</td>
      <td style="font-size:11px;color:#9ca3af;">${fecha}</td>
      <td>
        <div class="acc-fila">
          ${btnToggle}
          <button class="btn-acc-edit" onclick="abrirModalEditar(${u.id})">Editar</button>
          <button class="btn-acc-del"  onclick="abrirModalEliminar(${u.id}, '${u.nombre.replace(/'/g,"\\'")}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filtrarUsuarios() {
  const q      = document.getElementById('buscarInput').value.trim().toLowerCase();
  const cargo  = document.getElementById('filtroCargo').value;
  const estado = document.getElementById('filtroEstado').value;
  renderTabla(usuarios.filter(u => {
    const matchQ = !q || u.nombre.toLowerCase().includes(q) || u.usuario.toLowerCase().includes(q);
    const matchC = !cargo  || u.cargo === cargo;
    const matchE = !estado || (estado === 'activo' ? u.activo : !u.activo);
    return matchQ && matchC && matchE;
  }));
}

function limpiarFiltros() {
  document.getElementById('buscarInput').value  = '';
  document.getElementById('filtroCargo').value  = '';
  document.getElementById('filtroEstado').value = '';
  renderTabla();
}

/* ===== MODAL CREAR ===== */
function abrirModal() {
  editandoId = null;
  limpiarFormulario();
  document.getElementById('modalIcono').textContent  = '';
  document.getElementById('modalTitulo').textContent = 'Nuevo Usuario';
  document.getElementById('btnGuardar').textContent  = 'Crear Usuario';
  document.getElementById('passLabel').textContent   = 'Contraseña *';
  document.getElementById('passHint').classList.add('hidden');
  document.getElementById('u_pass').required = true;
  document.getElementById('modalUsuario').classList.remove('hidden');
}

/* ===== MODAL EDITAR ===== */
function abrirModalEditar(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  editandoId = id;
  limpiarFormulario();
  document.getElementById('modalIcono').textContent  = '';
  document.getElementById('modalTitulo').textContent = 'Editar Usuario';
  document.getElementById('btnGuardar').textContent  = 'Guardar cambios';
  document.getElementById('passLabel').textContent   = 'Nueva contraseña';
  document.getElementById('passHint').classList.remove('hidden');
  document.getElementById('u_pass').required = false;

  document.getElementById('u_nombre').value   = u.nombre  || '';
  document.getElementById('u_usuario').value  = u.usuario || '';
  document.getElementById('u_cargo').value    = u.cargo   || '';
  document.getElementById('u_sala').value     = u.sala    || '';
  document.getElementById('u_genero').value   = u.genero  || 'M';
  document.getElementById('u_activo').checked = !!u.activo;
  document.getElementById('toggleLabel').textContent = u.activo ? 'Activo' : 'Inactivo';
  document.getElementById('modalUsuario').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modalUsuario').classList.add('hidden');
  limpiarFormulario(); editandoId = null;
}

function limpiarFormulario() {
  ['u_nombre','u_usuario','u_pass','u_pass2'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('u_cargo').value    = '';
  document.getElementById('u_sala').value     = '';
  document.getElementById('u_genero').value   = 'M';
  document.getElementById('u_activo').checked = true;
  document.getElementById('toggleLabel').textContent = 'Activo';
  ['nombre','usuario','pass','pass2','cargo'].forEach(c => { const el=document.getElementById('err_'+c); if(el) el.textContent=''; });
}

function limpiarError(campo) {
  const el = document.getElementById('err_'+campo); if(el) el.textContent='';
}

/* ===== GUARDAR ===== */
async function guardarUsuario() {
  const nombre  = document.getElementById('u_nombre').value.trim();
  const usuario = document.getElementById('u_usuario').value.trim();
  const pass    = document.getElementById('u_pass').value;
  const pass2   = document.getElementById('u_pass2').value;
  const cargo   = document.getElementById('u_cargo').value;
  let ok = true;

  if (!nombre)  { document.getElementById('err_nombre').textContent  = 'El nombre es obligatorio'; ok=false; }
  if (!usuario) { document.getElementById('err_usuario').textContent = 'El usuario es obligatorio'; ok=false; }
  if (!editandoId && !pass) { document.getElementById('err_pass').textContent = 'La contraseña es obligatoria'; ok=false; }
  else if (pass && pass.length < 6) { document.getElementById('err_pass').textContent = 'Mínimo 6 caracteres'; ok=false; }
  if (pass && pass !== pass2) { document.getElementById('err_pass2').textContent = 'Las contraseñas no coinciden'; ok=false; }
  if (!cargo) { document.getElementById('err_cargo').textContent = 'Selecciona un cargo'; ok=false; }
  if (!ok) return;

  const btn = document.getElementById('btnGuardar');
  if (btn) { btn.disabled=true; btn.textContent='Guardando...'; }

  try {
    let res, data;
    if (editandoId) {
      const body = { nombre, usuario, cargo, sala: document.getElementById('u_sala').value, genero: document.getElementById('u_genero').value };
      if (pass) body.password = pass;
      res  = await fetch(`${API}/usuarios/${editandoId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify(body) });
      data = await res.json();
      if (!data.ok) {
        if (res.status===409) document.getElementById('err_usuario').textContent = 'Ese usuario ya existe';
        else mostrarToast(data.mensaje);
        if (btn) { btn.disabled=false; btn.textContent='Guardar cambios'; }
        return;
      }
      await fetch(`${API}/usuarios/${editandoId}/estado`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ activo: document.getElementById('u_activo').checked }) });
      mostrarToast('Usuario @' + usuario + ' actualizado');
    } else {
      res  = await fetch(`${API}/usuarios`, { method:'POST', headers:ncHeaders(), body:JSON.stringify({ nombre, usuario, password:pass, cargo, sala: document.getElementById('u_sala').value, genero: document.getElementById('u_genero').value, activo: document.getElementById('u_activo').checked }) });
      data = await res.json();
      if (!data.ok) {
        if (res.status===409) document.getElementById('err_usuario').textContent = 'Ese usuario ya existe';
        else mostrarToast(data.mensaje);
        if (btn) { btn.disabled=false; btn.textContent='Crear Usuario'; }
        return;
      }
      mostrarToast('Usuario @' + usuario + ' creado correctamente');
    }
    await cargarUsuarios(); actualizarKPIs(); filtrarUsuarios(); cerrarModal();
  } catch(e) {
    mostrarToast('Error conectando al servidor');
    if (btn) { btn.disabled=false; btn.textContent = editandoId ? 'Guardar cambios' : 'Crear Usuario'; }
  }
}

/* ===== TOGGLE ESTADO ===== */
async function toggleEstado(id, nuevoEstado) {
  try {
    const res  = await fetch(`${API}/usuarios/${id}/estado`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ activo:nuevoEstado }) });
    const data = await res.json();
    if (!data.ok) { mostrarToast(data.mensaje); return; }
    const u = usuarios.find(u => u.id === id);
    if (u) u.activo = nuevoEstado;
    actualizarKPIs(); filtrarUsuarios();
    mostrarToast(nuevoEstado ? 'Usuario activado' : 'Usuario desactivado');
  } catch(e) { mostrarToast('Error conectando al servidor'); }
}

/* ===== ELIMINAR ===== */
function abrirModalEliminar(id, nombre) {
  eliminandoId = id;
  document.getElementById('eliminarNombre').textContent = nombre;
  document.getElementById('modalEliminar').classList.remove('hidden');
}

function cerrarModalEliminar() {
  document.getElementById('modalEliminar').classList.add('hidden');
  eliminandoId = null;
}

async function confirmarEliminar() {
  if (!eliminandoId) return;
  const btn = document.getElementById('btnEliminarConfirm');
  btn.disabled=true; btn.textContent='Eliminando...';
  try {
    const res  = await fetch(`${API}/usuarios/${eliminandoId}`, { method:'DELETE', headers:ncHeaders() });
    const data = await res.json();
    if (!data.ok) { mostrarToast(data.mensaje); btn.disabled=false; btn.textContent='Eliminar'; return; }
    mostrarToast('Usuario eliminado');
    cerrarModalEliminar();
    await cargarUsuarios(); actualizarKPIs(); filtrarUsuarios();
  } catch(e) { mostrarToast('Error conectando al servidor'); btn.disabled=false; btn.textContent='Eliminar'; }
}

/* ===== UTILS ===== */
function togglePass(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function mostrarToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast';
  setTimeout(() => t.classList.add('hidden'), 3000);
}