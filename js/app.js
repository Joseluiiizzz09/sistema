/* ================================================
   APP.JS — Login Central Netcontact
   Conectado a Node.js backend
   ================================================ */

const API = 'http://127.0.0.1:3000/api';

/* ===== RUTAS POR CARGO ===== */
const RUTAS = {
  asesor:      'dashboard.html',
  supervisor:  'supervisor.html',
  backoffice:  'backoffice.html',
  validacion:  'validacion.html',
  grabaciones: 'grabaciones.html',
  seguimiento: 'seguimiento.html',
  jefatura:    'jefatura.html',
  usuarios:    'usuarios.html',
  instalacion: 'instalacion.html',
  postventa:   'postventa.html',
};

/* ===== LABELS DE CARGO ===== */
const CARGO_LABELS = {
  asesor:      'Asesor',
  supervisor:  'Supervisor',
  backoffice:  'Back Office',
  validacion:  'Validación',
  grabaciones: 'Grabaciones',
  seguimiento: 'Seguimiento',
  jefatura:    'Jefatura',
  usuarios:    'Usuarios',
  instalacion: 'Instalación',
  postventa:   'Post Venta',
};

/* ===== TOGGLE CONTRASEÑA ===== */
function togglePassword() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('eyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.add('active');
  } else {
    input.type = 'password';
    icon.classList.remove('active');
  }
}

/* ===== SALUDO DINÁMICO ===== */
function actualizarNombre() {
  const input  = document.getElementById('usuario');
  const nombre = document.getElementById('nombreUsuario');
  const saludo = document.getElementById('saludo');
  if (!input || !nombre || !saludo) return;

  const val = input.value.trim();

  nombre.classList.remove('typing');
  void nombre.offsetWidth;
  nombre.classList.add('typing');

  if (val.length < 2) {
    nombre.textContent = '...';
    nombre.classList.remove('dots');
    void nombre.offsetWidth;
    nombre.classList.add('dots');
    saludo.textContent = 'Bienvenido a Netcontact';
    return;
  }

  nombre.classList.remove('dots');
  nombre.textContent = val.toUpperCase();
  nombre.style.animation = 'none';
  setTimeout(() => { nombre.style.animation = 'popPro .3s cubic-bezier(.22,1,.36,1)'; }, 10);

  const femenino = val.toUpperCase().endsWith('A');
  saludo.textContent = femenino ? 'Bienvenida a Netcontact' : 'Bienvenido a Netcontact';
}

/* ===== ERROR / LIMPIEZA ===== */
function mostrarError(msg) {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('usuario')?.classList.add('error');
  document.getElementById('password')?.classList.add('error');
}
function ocultarError() {
  document.getElementById('errorMsg')?.classList.remove('show');
  document.getElementById('usuario')?.classList.remove('error');
  document.getElementById('password')?.classList.remove('error');
}

/* ===== ANIMACIÓN DE BIENVENIDA ===== */
function mostrarBienvenida(user, callback) {
  const screen = document.getElementById('welcomeScreen');
  if (!screen) { callback(); return; }

  const primerNombre = user.nombre.split(' ')[0];
  const femenino     = primerNombre.toUpperCase().endsWith('A');

  document.getElementById('wSaludo').textContent =
    femenino ? '¡Bienvenida de nuevo,' : '¡Bienvenido de nuevo,';

  const wNombre = document.getElementById('wNombre');
  wNombre.innerHTML = primerNombre
    .split('')
    .map((c, i) => i === 0 ? `<span class="accent">${c}</span>` : c)
    .join('');

  document.getElementById('wCargo').textContent =
    CARGO_LABELS[user.cargo] || user.cargo;

  screen.classList.add('show');

  setTimeout(() => {
    const barra = document.getElementById('wBarra');
    if (barra) barra.style.width = '100%';
  }, 100);

  setTimeout(callback, 1600);
}

/* ===== LOGIN ===== */
async function doLogin(e) {
  if (e) e.preventDefault();
  ocultarError();

  const usuario  = (document.getElementById('usuario')?.value  || '').trim().toLowerCase();
  const password = (document.getElementById('password')?.value || '').trim();

  if (!usuario)  { mostrarError('Ingresa tu usuario.');    return; }
  if (!password) { mostrarError('Ingresa tu contraseña.'); return; }

  const btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

  try {
    const res = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usuario, password }),
    });

    const data = await res.json();

    if (!data.ok) {
      mostrarError(data.mensaje || 'Usuario o contraseña incorrectos.');
      if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }
      return;
    }

    // Guardar token y sesión en localStorage (persiste entre pestañas)
    localStorage.setItem('nc_token',   data.token);
    localStorage.setItem('nc_usuario', JSON.stringify(data.usuario));

    const ruta = RUTAS[data.usuario.cargo] || 'dashboard.html';
    mostrarBienvenida(data.usuario, () => {
      window.location.href = ruta;
    });

  } catch(err) {
    console.error('Error de conexión:', err);
    mostrarError('No se pudo conectar al servidor. ¿Está corriendo el backend?');
    if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }
  }
}

/* ===== PARTÍCULAS ===== */
function crearParticulas() {
  const cont = document.querySelector('.particles');
  if (!cont) return;
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.style.left              = Math.random() * 100 + 'vw';
    s.style.width             = (Math.random() * 5 + 3) + 'px';
    s.style.height            = s.style.width;
    s.style.opacity           = Math.random() * 0.5 + 0.2;
    s.style.animationDuration = (Math.random() * 10 + 8) + 's';
    s.style.animationDelay    = (Math.random() * 8) + 's';
    cont.appendChild(s);
  }
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  crearParticulas();

  const inputU = document.getElementById('usuario');
  const inputP = document.getElementById('password');
  const form   = document.getElementById('loginForm');

  inputU?.addEventListener('input', actualizarNombre);
  inputU?.addEventListener('keydown', e => { if (e.key === 'Enter') inputP?.focus(); });
  inputP?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  form?.addEventListener('submit', doLogin);

  inputU?.focus();

  // Si ya hay sesión activa → redirigir directamente
  try {
    const token = localStorage.getItem('nc_token');
    const raw   = localStorage.getItem('nc_usuario');
    if (token && raw) {
      const u    = JSON.parse(raw);
      const ruta = RUTAS[u.cargo];
      if (ruta) window.location.href = ruta;
    }
  } catch(e) {}
});