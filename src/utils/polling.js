export function setVisibleInterval(task, delay) {
  let running = false

  return window.setInterval(async () => {
    if (document.visibilityState === 'hidden' || running) return

    running = true
    try {
      await task()
    } finally {
      running = false
    }
  }, delay)
}
