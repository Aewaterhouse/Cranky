/** Keeps the screen on during rides. Re-acquires after the tab is hidden and shown again. */
let want = false
let lock: WakeLockSentinel | null = null

async function acquire() {
  if (!want || lock || document.visibilityState !== 'visible') return
  try {
    lock = await navigator.wakeLock?.request('screen')
    lock?.addEventListener('release', () => (lock = null))
  } catch {
    /* not supported or refused: nothing to do */
  }
}

document.addEventListener('visibilitychange', acquire)

export function keepAwake(on: boolean) {
  want = on
  if (on) void acquire()
  else void lock?.release()
}
