import type { Mark, Warning } from '../core/segWarn'
import { VIS } from '../scene/params'
import { settings } from '../core/settings'
import { SFX } from './audio'
import { h } from './dom'
import { UNIT } from './units'

const W = VIS.route.warn
const icon = (m: Mark) => (m.kind === 'sprint' ? '⚡' : '⛰')
const what = (m: Mark) => (m.kind === 'sprint' ? 'Sprint' : 'KOM')
/** "500 m", "1.2 km" (or miles): a short distance as a banner says it. */
const short = (m: number) =>
  settings.units === 'metric' && m < 1000 ? `${Math.round(m / 10) * 10} m` : UNIT.dist(m, 1)
/** "Name · 300 m · 1.2%": what a banner says under its first line. */
export const markLine = (m: Mark) =>
  `${m.name} · ${short(m.end - m.start)} · ${m.avgPct.toFixed(1)}%`

/**
 * The heads-up for the next sprint or KOM, top centre in both free-ride layouts: a banner at 1 km, 500 m and
 * 200 m with a chime, then the big 3-2-1 to the line with the bus's tone on each number.
 */
export function segCues() {
  const head = h('b', {})
  const sub = h('small', {})
  const banner = h('div', { class: 'glass segwarn-chip off' }, head, sub)
  const count = h('div', { class: 'segwarn-count off' })
  const el = h('div', { class: 'segwarn' }, banner, count)
  let until = 0
  let last: number | null = null
  return {
    el,
    frame(w: Warning | undefined) {
      const now = performance.now()
      if (w?.banner) {
        const { mark, stage } = w.banner
        banner.className = `glass segwarn-chip ${mark.kind}`
        head.textContent = `${icon(mark)} ${what(mark)} in ${short(stage)}`
        sub.textContent = markLine(mark)
        until = now + W.bannerS * 1000
        SFX.cue()
      }
      const n = w?.count ?? null
      if (n !== null && w?.next) {
        banner.className = `glass segwarn-chip ${w.next.kind}`
        head.textContent = `${icon(w.next)} ${what(w.next)}`
        sub.textContent = w.next.name
        until = now + 1000
      }
      banner.classList.toggle('off', now > until)
      count.classList.toggle('off', n === null)
      if (n !== null && n !== last) {
        count.textContent = String(n)
        SFX.countdown()
      }
      last = n
    },
  }
}
