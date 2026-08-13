import { useState } from 'react'

export function useAuth() {
  const [sesion, setSesion] = useState(() => {
    try {
      const raw = sessionStorage.getItem('nc_usuario')
      const actor = raw ? JSON.parse(raw) : null
      const objetivo = JSON.parse(sessionStorage.getItem('nc_jefatura_usuario_objetivo') || 'null')
      if (actor?.cargo === 'jefatura' && objetivo?.id && objetivo?.cargo) {
        return { ...actor, ...objetivo, cargo: objetivo.cargo, _actorJefatura: actor }
      }
      return actor
    } catch {
      return null
    }
  })

  function login(token, usuario) {
    sessionStorage.setItem('nc_token', token)
    sessionStorage.setItem('nc_usuario', JSON.stringify(usuario))
    setSesion(usuario)
  }

  function logout() {
    sessionStorage.removeItem('nc_jefatura_usuario_objetivo')
    sessionStorage.removeItem('nc_dashboard_asesor_objetivo')
    sessionStorage.removeItem('nc_token')
    sessionStorage.removeItem('nc_usuario')
    setSesion(null)
  }

  function getToken() {
    return sessionStorage.getItem('nc_token') || ''
  }

  function tieneAcceso(cargo) {
    if (!sesion) return false
    // Cada sesion usa un solo cargo activo para no mezclar permisos.
    return sesion.cargo === cargo
  }

  return { sesion, login, logout, getToken, tieneAcceso }
}
