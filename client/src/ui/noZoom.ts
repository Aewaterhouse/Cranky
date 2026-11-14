/**
 * Page zoom off during rides and TV views, back on everywhere else (accessibility). Safari zooms the page on a
 * pinch or double tap that starts anywhere the 3D canvas doesn't cover with `touch-action: none` (the HUD, the
 * cards, the buttons), and it ignores `user-scalable=no`. So while locked: the page allows panning only (no pinch,
 * no double-tap zoom), Safari's own gesture events are cancelled, and the viewport is held at scale 1, which also
 * zooms back out a page that was already zoomed.
 */
const meta = () => document.querySelector<HTMLMetaElement>('meta[name=viewport]')
let free = ''
const stop = (e: Event) => e.preventDefault()
const GESTURES = ['gesturestart', 'gesturechange', 'gestureend']

export function lockZoom(on: boolean) {
  const m = meta()
  if (on === document.documentElement.classList.contains('no-zoom')) return
  document.documentElement.classList.toggle('no-zoom', on)
  for (const g of GESTURES)
    on
      ? document.addEventListener(g, stop, { passive: false })
      : document.removeEventListener(g, stop)
  if (!m) return
  if (on) {
    free = m.content
    m.content = `${free}, maximum-scale=1, user-scalable=no`
  } else m.content = free
}
