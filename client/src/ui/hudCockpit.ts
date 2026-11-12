import type { Live } from '../modes/rideController'
import type { Frame } from '../types'
import { fmt, h } from './dom'
import { pulse, set } from './hudKit'

const LO = 0.7
const SPAN = 0.6
const clamp = (v: number) => Math.max(0, Math.min(1, v))

/** Bottom-centre rider cockpit: power, power-vs-target band gauge, cadence, interval clock. */
export function makeCockpit() {
  const el = (cls: string, t = '') => h('span', { class: cls }, t)
  const pow = el('cp-pow', '0'),
    tgt = el('cp-tgt-n', '–'),
    delta = el('cp-delta'),
    cad = el('cp-n', '0'),
    left = el('cp-n', '0:00'),
    comp = el('cp-n', '–'),
    tag = el('cp-lab', 'POWER · 3 S'),
    tgtLabel = el('cp-lab', 'TARGET')
  const needle = h('i', { class: 'cp-needle' })
  const bandEl = h('i', { class: 'cp-band' })
  bandEl.style.left = `${((0.95 - LO) / SPAN) * 100}%`
  bandEl.style.width = `${(0.1 / SPAN) * 100}%`
  const gauge = h(
    'div',
    { class: 'cp-gauge' },
    bandEl,
    needle,
    h('u', { class: 'cp-lo' }, 'EASE OFF'),
    h('u', { class: 'cp-hi' }, 'PUSH'),
  )
  const fill = h('i', { class: 'cp-fill' })
  const mark = h('i', { class: 'cp-mark' })
  const sbar = h('div', { class: 'cp-sbar' }, fill, mark)
  const cell = (label: string, v: HTMLElement, unit = '') =>
    h('div', { class: 'cp-cell' }, el('cp-lab', label), v, unit ? el('cp-unit', unit) : '')
  const root = h(
    'section',
    { class: 'hud-glass cp' },
    h('div', { class: 'cp-allout' }, 'ALL OUT!'),
    h(
      'div',
      { class: 'cp-top' },
      h('div', { class: 'cp-pw' }, tag, h('div', {}, pow, el('cp-unit big', 'W'))),
      h('div', { class: 'cp-tg' }, tgtLabel, h('div', {}, tgt, el('cp-unit', 'W')), delta),
    ),
    gauge,
    sbar,
    h(
      'div',
      { class: 'cp-row' },
      cell('CADENCE', cad, 'rpm'),
      cell('INTERVAL', left),
      cell('COMPLIANCE', comp),
    ),
  )
  let wasSprint = false
  return {
    root,
    /** `best` is the rider's best sprint average so far (or a stand-in) for the sprint bar. */
    update(f: Frame | null, live: Live, best: number) {
      const sprint = f?.type === 'sprint'
      root.classList.toggle('sprint', sprint)
      root.classList.toggle('nogauge', !sprint && !f?.tgt)
      if (sprint && !wasSprint) pulse(root, 'go')
      wasSprint = sprint
      set(cad, `${Math.round(live.cadence)}`)
      set(left, f ? fmt(f.dur - f.bel) : '–')
      set(comp, sprint || live.c == null ? '–' : `${Math.round(live.c * 100)}%`)
      if (sprint) {
        set(pow, `${Math.round(live.power)}`)
        set(tag, 'LIVE WATTS')
        set(tgtLabel, 'BEST')
        set(tgt, `${Math.round(best)}`)
        set(delta, live.power >= best ? 'NEW BEST!' : `${Math.round(best - live.power)} W to go`)
        fill.style.width = `${(clamp(live.power / best / 1.15) * 100).toFixed(1)}%`
        mark.style.left = `${(100 / 1.15).toFixed(1)}%`
        root.classList.toggle('beat', live.power >= best)
        return
      }
      set(pow, `${Math.round(live.avg)}`)
      set(tag, 'POWER · 3 S')
      set(tgtLabel, 'TARGET')
      const t = f?.tgt ?? 0
      set(tgt, t ? `${t}` : f ? 'FREE' : '–')
      if (!t) return set(delta, '')
      const r = live.avg / t
      const dev = Math.abs(r - 1)
      needle.style.left = `${clamp((r - LO) / SPAN) * 100}%`
      gauge.dataset.s = dev <= 0.05 ? 'ok' : dev <= 0.12 ? 'warn' : 'bad'
      const d = Math.round(live.avg - t)
      set(delta, dev <= 0.05 ? 'ON TARGET' : `${d > 0 ? '▼ EASE' : '▲ PUSH'} ${Math.abs(d)} W`)
      delta.dataset.s = gauge.dataset.s
    },
  }
}
