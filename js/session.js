/* ================================================
   SESSION.JS — Control de sesión con JWT
   ================================================ */

function ncGetSesion() {
  try {
    const raw = localStorage.getItem('nc_usuario');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function ncGetToken() {
  return localStorage.getItem('nc_token') || '';
}

function ncCerrarSesion() {
  localStorage.removeItem('nc_token');
  localStorage.removeItem('nc_usuario');
  window.location.href = 'index.html';
}

function ncHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${ncGetToken()}`,
  };
}

function ncAplicarSesion() {
  const u  = ncGetSesion();
  if (!u) return;
  const el = document.getElementById('topbarUser');
  if (el) el.textContent = u.nombre;
}

function ncTieneAcceso(cargo) {
  const u = ncGetSesion();
  if (!u) return false;
  if (u.cargo === cargo) return true;
  if (u.permisos && u.permisos.includes(cargo)) return true;
  return false;
}

function ncProteger(cargosPermitidos = []) {
  const token = ncGetToken();
  const u     = ncGetSesion();
  if (!token || !u) {
    window.location.href = 'index.html';
    return false;
  }
  if (cargosPermitidos.length > 0) {
    const tieneAcceso = cargosPermitidos.some(c => ncTieneAcceso(c));
    if (!tieneAcceso) {
      window.location.href = 'index.html';
      return false;
    }
  }
  ncAplicarSesion();
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  const pagina = window.location.pathname.split('/').pop();
  if (pagina === 'index.html' || pagina === '' || pagina === '/') return;

  // Cada página solo permite sus cargos específicos
  const protecciones = {
    'usuarios.html':    ['jefatura', 'usuarios'],
    'jefatura.html':    ['jefatura'],
    'backoffice.html':  ['jefatura', 'backoffice'],
    'validacion.html':  ['jefatura', 'validacion'],
    'grabaciones.html': ['jefatura', 'grabaciones'],
    'seguimiento.html': ['jefatura', 'seguimiento'],
    'supervisor.html':  ['jefatura', 'supervisor'],
    'dashboard.html':   ['jefatura', 'asesor'],
  };

  const cargos = protecciones[pagina];
  if (cargos) {
    ncProteger(cargos);
  } else {
    ncProteger();
  }
});