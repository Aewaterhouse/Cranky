import '../leaderboards.css'
import { segClock } from '../core/segments'
import type { SegBoard } from '../modes/freeRide/segmentRun'
import { h } from './dom'

/** The top three of the segment in play, for the stats drawer of either layout. Hidden when nobody has a time. */
export function segBoard() {
  const el = h('div', { class: 'seg-board' })
  el.hidden = true
  let key = ''
  return {
    el,
    set(b: SegBoard | undefined) {
      const k = b ? b.name + b.rows.map((r) => r.id + r.secs).join() : ''
      if (k === key) return
      key = k
      el.hidden = !b
      if (!b) return
      el.replaceChildren(
        h('span', { class: 'sb-name' }, `Top three · ${b.name}`),
        ...b.rows.map((r) =>
          h(
            'div',
            { class: r.me ? 'me' : '' },
            h('span', {}, `${r.rank}  ${r.name}`),
            h('b', {}, segClock(r.secs)),
          ),
        ),
      )
    },
  }
}
