import type { CamOrbit } from './camOrbit'
import { CAM } from './camVis'

/**
 * Camera input on the 3D canvas only, so HUD panels, buttons, the map and sliders above it keep their own
 * pointers: one-finger or mouse drag orbits, the wheel or a pinch zooms, and two fingers pan in photo mode. `tap` runs first on every press; returning true eats it (skipping a cinematic).
 */
export function bindCamInput(el: HTMLElement, orbit: CamOrbit, tap: () => boolean) {
  const pts = new Map<number, { x: number; y: number }>()
  let moved = 0
  el.style.touchAction = 'none'
  const mid = () => {
    const [a, b] = [...pts.values()]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }
  }
  const down = (e: PointerEvent) => {
    if (tap()) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 1) moved = 0
    el.setPointerCapture?.(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    const p = pts.get(e.pointerId)
    if (!p) return
    if (pts.size === 1) {
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      moved += Math.abs(dx) + Math.abs(dy)
      p.x = e.clientX
      p.y = e.clientY
      if (moved > 3) orbit.drag(dx, dy)
      return
    }
    const before = mid()
    p.x = e.clientX
    p.y = e.clientY
    const after = mid()
    moved += 10
    if (after.d > 0) orbit.zoomBy(before.d / after.d)
    orbit.pan(-(after.x - before.x) * 0.02, (after.y - before.y) * 0.02)
  }
  const up = (e: PointerEvent) => void pts.delete(e.pointerId)
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    orbit.zoomBy(Math.exp(Math.sign(e.deltaY) * CAM.wheelStep))
  }
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('wheel', wheel, { passive: false })
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    el.removeEventListener('wheel', wheel)
  }
}
