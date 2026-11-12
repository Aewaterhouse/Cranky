import type { BlockStat } from '../core/ride'
import { blockTarget } from '../core/plan'
import type { Plan, SprintResult, Tier } from '../types'
import { fmt, h } from './dom'
import { ZONE_COLOURS, zoneColour } from './planGraph'

export interface LiveStats {
  elapsed: number
  remaining: number
  avg: number
  np: number
  if: number
  tss: number
  kj: number
  cadence: number
  compliance: number | null
  zones: number[]
}

const pct = (v: number | null) => (v == null ? '–' : `${Math.round(v * 100)}%`)
const TILES: [string, (s: LiveStats) => string][] = [
  ['Elapsed', (s) => fmt(s.elapsed)],
  ['Remaining', (s) => fmt(s.remaining)],
  ['Avg power', (s) => `${Math.round(s.avg)} W`],
  ['NP', (s) => `${Math.round(s.np)} W`],
  ['IF', (s) => s.if.toFixed(2)],
  ['TSS', (s) => String(Math.round(s.tss))],
  ['Energy', (s) => `${Math.round(s.kj)} kJ`],
  ['Avg cadence', (s) => `${Math.round(s.cadence)} rpm`],
  ['Compliance', (s) => pct(s.compliance)],
]

const rangeText = (b: Plan['blocks'][number], tier: Tier, ftp: number, k: number) => {
  if (b.type === 'sprint') return 'ALL OUT'
  if (b.type === 'free') return 'Free ride'
  const w = (s: number) => Math.round(blockTarget(b, tier, s)! * ftp * k)
  if (b.type === 'ramp') return `${w(0)}→${w(b.dur)} W`
  if (b.type === 'over-under') return `${w(0)}/${w(b.step!)} W`
  return `${w(0)} W`
}

/** Right-hand column: interval list that follows the ride, plus live stat tiles and time in zone. */
export function soloPanel(plan: Plan, tier: () => Tier, ftp: number) {
  const rows = plan.blocks.map((b, i) => {
    const target = h('span', { class: 'iv-w' })
    const result = h('span', { class: 'iv-r' })
    const band = b.cad ? `Cadence ${b.cad[0]}–${b.cad[1]} rpm` : ''
    const cadEl = h('span', { class: 'iv-c' }, band)
    const row = h(
      'li',
      {
        class: `iv iv-${b.type}`,
        style: b.pct ? `--zc:${zoneColour(blockTarget(b, tier(), b.dur / 2)!)}` : undefined,
      },
      h('span', { class: 'iv-n' }, String(i + 1)),
      h('span', { class: 'iv-l' }, b.label ?? b.type),
      h('span', { class: 'iv-d' }, fmt(b.dur)),
      target,
      result,
      cadEl,
    )
    return { row, target, result, b, cadEl, band }
  })
  const list = h('ol', { class: 'ivlist' }, ...rows.map((r) => r.row))
  const vals = TILES.map(() => h('b', {}, '–'))
  const tiles = TILES.map(([label], i) =>
    h('div', { class: 'stile' }, h('span', {}, label), vals[i]),
  )
  const zbar = h(
    'div',
    { class: 'zbar' },
    ...ZONE_COLOURS.map((c, i) => h('i', { style: `background:${c}`, title: `Z${i + 1}` })),
  )
  const root = h(
    'aside',
    { class: 'solo-panel' },
    h('h3', {}, 'Intervals'),
    list,
    h('div', { class: 'stiles' }, ...tiles),
    h('div', { class: 'zlabel' }, h('span', {}, 'Time in zone'), h('span', {}, 'Z1 → Z7')),
    zbar,
  )
  let cur = -1
  return {
    root,
    /** Update targets (intensity may have changed), highlight and scroll to the current interval. */
    frame(i: number, k: number) {
      rows.forEach((r) => (r.target.textContent = rangeText(r.b, tier(), ftp, k)))
      if (i === cur) return
      cur = i
      rows.forEach((r, n) => {
        r.row.classList.toggle('now', n === i)
        r.row.classList.toggle('past', n < i)
      })
      rows[i]?.row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    done(stats: BlockStat[], sprints: SprintResult[], upto: number) {
      for (const s of stats) {
        const r = rows[s.i]
        if (!r || s.i >= upto) continue
        const spr = sprints.find((x) => x.blk === s.i)
        const ok = s.compliance >= 0.85
        r.result.className = `iv-r ${spr ? `g-${spr.grade}` : ok ? 'good' : 'miss'}`
        r.result.textContent = spr
          ? spr.grade
          : r.b.type === 'free'
            ? `${s.avgPower} W`
            : `${s.avgPower} W ${ok ? '✓' : '✗'}`
      }
    },
    /** Share of each block's seconds spent inside its cadence band. */
    cadence(pcts: (number | null)[]) {
      rows.forEach((r, i) => {
        const v = pcts[i]
        if (!r.band || v == null) return
        r.cadEl.textContent = `${r.band} · ${Math.round(v * 100)}% in band`
        r.cadEl.classList.toggle('good', v >= 0.8)
      })
    },
    stats(s: LiveStats) {
      TILES.forEach(([, f], i) => (vals[i].textContent = f(s)))
      const tot = s.zones.reduce((a, b) => a + b, 0) || 1
      ;[...zbar.children].forEach(
        (c, i) => ((c as HTMLElement).style.flexGrow = String(s.zones[i] / tot)),
      )
    },
  }
}
