import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { API } from '../services/api'
import styles from './Login.module.css'

const RUTAS = {
  asesor:         '/dashboard',
  supervisor:     '/supervisor',
  backoffice:     '/backoffice',
  validacion:     '/validacion',
  grabaciones:    '/grabaciones',
  seguimiento:    '/seguimiento',
  jefatura:       '/jefatura',
  usuarios:       '/usuarios',
  programacion:   '/programacion',
  supgrabaciones: '/sup-grabaciones',
}

export default function Login() {
  const [usuario, setUsuario]     = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState('')
  const [cargando, setCargando]   = useState(false)
  const [bienvenida, setBienvenida] = useState(null)
  const { login } = useAuth()
  const navigate  = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!usuario.trim()) { setError('Ingresa tu usuario.'); return }
    if (!password.trim()) { setError('Ingresa tu contraseña.'); return }

    setCargando(true)
    try {
      const res  = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.trim().toLowerCase(), password: password.trim() }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.mensaje || 'Usuario o contraseña incorrectos.'); return }

      login(data.token, data.usuario)
      setBienvenida(data.usuario)
      setTimeout(() => navigate(RUTAS[data.usuario.cargo] || '/dashboard'), 1800)
    } catch {
      setError('No se pudo conectar al servidor. ¿Está corriendo el backend?')
    } finally {
      setCargando(false)
    }
  }

  if (bienvenida) {
    return (
      <div className={styles.welcome}>
        <img src="/assets/logo3.png" alt="NC" className={styles.welcomeLogo} />
        <div className={styles.welcomeSaludo}>Bienvenido de nuevo,</div>
        <div className={styles.welcomeNombre}>{bienvenida.nombre}</div>
        <div className={styles.welcomeCargo}>{bienvenida.cargo}</div>
        <div className={styles.welcomeBarraWrap}>
          <div className={styles.welcomeBarra} />
        </div>
        <div className={styles.welcomeRedirect}>Redirigiendo a tu panel...</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.blob1} aria-hidden="true" />
      <div className={styles.blob2} aria-hidden="true" />
      <div className={styles.blob3} aria-hidden="true" />
      <div className={styles.blob4} aria-hidden="true" />
      <div className={styles.loginBox}>
        <div className={styles.logoCircle}>
          <img src="/assets/logo3.png" alt="Netcontact" />
        </div>
        <h2 className={styles.titulo}>Bienvenido a Netcontact</h2>
        {usuario.length >= 2 && (
          <p className={styles.nombreUsuario}>{usuario.toUpperCase()}</p>
        )}

        {error && <div className={styles.errorMsg}>{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="off" className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              placeholder=" "
              required
              autoComplete="off"
            />
            <label>Usuario</label>
          </div>
          <div className={styles.inputGroup}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="new-password"
            />
            <label>Contraseña</label>
            <span className={styles.eye} onClick={() => setShowPass(v => !v)}>
              {showPass ? '🙈' : '👁️'}
            </span>
          </div>
          <button type="submit" disabled={cargando} className={styles.btnLogin}>
            {cargando ? 'Verificando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
