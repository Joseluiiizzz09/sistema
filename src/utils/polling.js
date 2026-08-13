export function setVisibleInterval(task, delay) {
  let running = false
  // Las pantallas consultan listas completas. Con muchos usuarios, intervalos
  // de 0.5–2 s saturan la API y MySQL sin aportar una diferencia perceptible.
  // Se conserva la actualización automática, con un mínimo seguro y un pequeño
  // desfase aleatorio para que todos los navegadores no consulten a la vez.
  const effectiveDelay = Math.max(Number(delay) || 0, 4000) + Math.floor(Math.random() * 750)

  return window.setInterval(async () => {
    if (document.visibilityState === 'hidden' || running) return

    running = true
    try {
      await task()
    } finally {
      running = false
    }
  }, effectiveDelay)
}
