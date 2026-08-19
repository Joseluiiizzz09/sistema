const MIN_POLL_DELAY = 5000
const INTERACTION_GRACE = 1200

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
