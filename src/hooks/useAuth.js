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
    if (sesion.cargo === cargo) return true
    if (sesion.permisos?.includes(cargo)) return true
    return false
  }

  return { sesion, login, logout, getToken, tieneAcceso }
}
