import { gapText, type RiderRow } from '../core/hud'
import { h } from './dom'

/** Riders nearby: name, W/kg and the gap to me. Hidden while there are no rows. Any mode can feed it. */
export function riderList() {
  const el = h('div', { class: 'glass rlist' })
  el.hidden = true
  return {
    el,
    /** `speed` is mine in m/s, for turning gaps in metres into time. */
    set(rows: RiderRow[], speed: number) {
      el.hidden = !rows.length
      el.replaceChildren(
        ...rows.map((r) =>
          h(
            'div',
            { class: `rrow ${r.me ? 'me' : r.gapM >= 0 ? 'ahead' : 'behind'}` },
            h('span', { class: 'rn' }, r.name),
            h('span', { class: 'rw' }, r.wkg == null ? '' : r.wkg.toFixed(1)),
            h('span', { class: 'rg' }, r.me ? '' : gapText(r.gapM, speed)),
          ),
        ),
      )
    },
  }
}
