import { h } from './dom'

/** The HUD's camera button: cycles the 3D views like the C key. */
export const camButton = (cycle: () => void) =>
  h(
    'button',
    {
      class: 'glass cam-btn',
      title: 'Camera view (C)',
      'aria-label': 'Camera view',
      onclick: cycle,
    },
    '🎥',
  )

/**
 * The C key while `alive()`: cycles the camera view. Ignored while typing or with Ctrl or Cmd held. Removes
 * itself once `alive()` is false.
 */
export function camKey(alive: () => boolean, cycle: () => void) {
  const on = (e: KeyboardEvent) => {
    if (!alive()) return removeEventListener('keydown', on)
    const tag = (e.target as HTMLElement)?.tagName
    if (e.key.toLowerCase() !== 'c' || tag === 'INPUT' || e.ctrlKey || e.metaKey) return
    e.preventDefault()
    cycle()
  }
  addEventListener('keydown', on)
  return () => removeEventListener('keydown', on)
}
