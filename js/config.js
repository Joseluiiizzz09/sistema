// config.js — detecta entorno automáticamente
window.NC_API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://TU-BACKEND.up.railway.app'; // se cambia al hacer deploy