import { useState } from 'react'

export function useAuth() {
  const [sesion, setSesion] = useState(() => {
    try {
      const raw = sessionStorage.getItem('nc_usuario')
      return raw ? JSON.parse(raw) : null
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
