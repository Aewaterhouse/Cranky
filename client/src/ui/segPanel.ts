import type { SegLive } from '../modes/freeRide/segmentRun'
import { h } from './dom'

/** The name and lines of the segment being timed (time so far, splits), shared by both free-ride layouts. */
export function segPanel() {
  const name = h('span', { class: 'seg-name' })
  const lines = h('div', { class: 'seg-lines' })
  return {
    name,
    lines,
    /** `bare` leaves the "in 120 m" lead off the name (the climb panel already counts it down). */
    set(sg: SegLive, bare = false) {
      const lead = bare || sg.inM === undefined ? '' : ` in ${Math.ceil(sg.inM / 10) * 10} m`
      name.textContent = `${sg.name}${lead}`
      lines.replaceChildren(
        ...sg.lines.map((t) =>
          h('span', { class: t[0] === '−' ? 'up' : t[0] === '+' ? 'down' : '' }, t),
        ),
      )
    },
  }
}
