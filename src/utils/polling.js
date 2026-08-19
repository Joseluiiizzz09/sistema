// Las tablas son grandes: consultar cada 1-2 segundos reconstruía cientos de
// filas durante toda la sesión aunque no hubiera cambios.
const MIN_POLL_DELAY = 15000
const INTERACTION_GRACE = 3000

let ultimaInteraccion = 0
let listenersInstalados = false

function instalarDetectorInteraccion() {
  if (listenersInstalados || typeof window === 'undefined') return
  listenersInstalados = true
  const marcar = () => { ultimaInteraccion = Date.now() }
  window.addEventListener('pointerdown', marcar, { passive:true, capture:true })
  window.addEventListener('keydown', marcar, { passive:true, capture:true })
  window.addEventListener('input', marcar, { passive:true, capture:true })
  window.addEventListener('wheel', marcar, { passive:true, capture:true })
}

export function setVisibleInterval(task, delay) {
  instalarDetectorInteraccion()
  let running = false
  const intervalo = Math.max(Number(delay) || MIN_POLL_DELAY, MIN_POLL_DELAY)

  return window.setInterval(async () => {
    if (document.visibilityState === 'hidden' || running || Date.now() - ultimaInteraccion < INTERACTION_GRACE) return

    running = true
    try {
      await task()
    } finally {
      running = false
    }
  }, intervalo)
}

// Evita setState y renderizados completos cuando el servidor devuelve la
// misma colección. Solo conserva una firma pequeña, no una copia de los datos.
export function responseChanged(ref, data) {
  const json = JSON.stringify(data ?? null)
  let hash = 2166136261
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const firma = `${json.length}:${hash >>> 0}`
  if (ref.current === firma) return false
  ref.current = firma
  return true
}
