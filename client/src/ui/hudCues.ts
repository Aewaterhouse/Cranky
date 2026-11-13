import { busWarn, loadBanner } from '../core/hud'
import type { Tick } from '../net/protocol'
import type { Frame } from '../types'
import { SFX } from './audio'
import { h } from './dom'

/** The bus's top-centre cues: the fallen-rider banner, and "Next: 250 W" with a 5-4-3-2-1 before a change. */
export function hudCues() {
  const next = h('div', { class: 'glass nchip off' })
  const load = h('div', { class: 'glass load-banner off' })
  const count = h('div', { class: 'count off' })
  let last = 0
  return {
    load,
    next,
    count,
    /** Every frame: the countdown, with the solo player's tone on each new number. */
    frame(f: Frame) {
      const warn = busWarn(f)
      next.classList.toggle('off', !warn)
      count.classList.toggle('off', !warn)
      if (warn && warn.s !== last) {
        next.textContent = warn.text
        count.textContent = String(warn.s)
        SFX.countdown()
      }
      last = warn?.s ?? 0
    },
    /** Every server tick: who is off the bus and what the rest carry. */
    tick(m: Tick) {
      const fallen = Object.values(m.riders).filter((r) => r.st === 'fell')
      const text = loadBanner(
        m.load,
        fallen.map((r) => r.name),
      )
      load.classList.toggle('off', !text)
      if (text) load.textContent = `⚠ ${text}`
    },
  }
}
