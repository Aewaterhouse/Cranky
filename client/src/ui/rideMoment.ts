import '../moment.css'
import { CFG } from '../config'
import type { MomentCard } from '../modes/freeRide/moments'
import { h } from './dom'

/** The stats flash at a summit or the finish: headline, the announcer's line and the numbers. Takes itself away. */
export function momentFlash(m: MomentCard, secs = CFG.moments.cardS) {
  const el = h(
    'div',
    { class: `moment ${m.kind}`, role: 'status' },
    h('b', { class: 'mo-head' }, m.head),
    h('p', {}, m.line),
    h(
      'div',
      { class: 'mo-tiles' },
      ...m.tiles.map(([label, value]) => h('div', {}, h('span', {}, label), h('b', {}, value))),
    ),
  )
  setTimeout(() => el.classList.add('out'), secs * 1000)
  setTimeout(() => el.remove(), secs * 1000 + 600)
  return el
}
