export const NC_API = import.meta.env.DEV ? 'http://localhost:3000' : ''
export const API    = '/api'

export function ncHeaders() {
  const token = sessionStorage.getItem('nc_token') || ''
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

export function ncHeadersFile() {
  const token = sessionStorage.getItem('nc_token') || ''
  return { 'Authorization': `Bearer ${token}` }
}
