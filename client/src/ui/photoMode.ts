import type { CamOrbit } from '../scene/camOrbit'
import { CAM } from '../scene/camVis'
import { h } from './dom'
import '../photo.css'

/**
 * Free-ride photo mode, from the pause screen: the HUD goes, the camera is the player's (drag to turn, wheel or
 * pinch to zoom, arrows or two fingers to pan, no auto-return), and "Use as postcard" keeps this frame as the
 * ride's postcard. Done or Esc hands the camera back and calls `leave`.
 */
export function photoMode(o: {
  root: HTMLElement
  orbit: CamOrbit
  postcard: () => void
  leave: () => void
}) {
  const { root, orbit } = o
  // While it is up, every key is photo mode's: the arrows pan rather than reach the simulator or the ride.
  const key = (e: KeyboardEvent) => {
    e.stopImmediatePropagation()
    const k = e.key
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    }
    if (pan[k]) {
      e.preventDefault()
      orbit.pan(pan[k][0] * CAM.panStep, pan[k][1] * CAM.panStep)
    } else if (k === 'Escape' || k === 'Enter') done()
  }
  const bar = h(
    'div',
    { class: 'photo-bar glass' },
    h('span', {}, 'Drag to turn · wheel or pinch to zoom · arrows or two fingers to pan'),
    h('button', { class: 'primary', onclick: () => o.postcard() }, 'Use as postcard'),
    h('button', { onclick: () => done() }, 'Done'),
  )
  const done = () => {
    removeEventListener('keydown', key, true)
    bar.remove()
    root.classList.remove('photo')
    orbit.free = false
    orbit.snap()
    o.leave()
  }
  orbit.free = true
  root.classList.add('photo')
  root.append(bar)
  addEventListener('keydown', key, true)
  return done
}
