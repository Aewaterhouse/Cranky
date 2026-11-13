import { listWindow } from '../core/hud'
import type { BlockStat } from '../core/ride'
import { blockTarget } from '../core/plan'
import type { Plan, SprintResult, Tier } from '../types'
import { fmt, h } from './dom'
import { hudStat } from './hudParts'
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
  ['Avg power', (s) => `${Math.round(s.avg)} W`],
  ['Normalised', (s) => `${Math.round(s.np)} W`],
  ['Intensity factor', (s) => s.if.toFixed(2)],
  ['TSS', (s) => String(Math.round(s.tss))],
  ['Energy', (s) => `${Math.round(s.kj)} kJ`],
  ['Avg cadence', (s) => `${Math.round(s.cadence)} rpm`],
  ['Compliance', (s) => pct(s.compliance)],
]

const rangeText = (b: Plan['blocks'][number], tier: Tier, ftp: number, k: number) => {
  if (b.type === 'sprint') return 'ALL OUT'
  if (b.type === 'free') return 'Free'
  const w = (s: number) => Math.round(blockTarget(b, tier, s)! * ftp * k)
  if (b.type === 'ramp') return `${w(0)}→${w(b.dur)} W`
  if (b.type === 'over-under') return `${w(0)}/${w(b.step!)} W`
  return `${w(0)} W`
}

/**
 * The solo player's two lists: the intervals on the right edge (a window that follows the ride, in the rider
 * list's clothes) and the rows of the stats drawer with time in zone.
 */
export function soloPanel(plan: Plan, tier: () => Tier, ftp: number) {
  const makeRow = (b: Plan['blocks'][number]) => {
    const target = h('span', { class: 'rw' })
    const result = h('span', { class: 'rg' })
    const dur = h('span', { class: 'rd' }, fmt(b.dur))
    const band = b.cad ? `Cadence ${b.cad[0]}–${b.cad[1]} rpm` : ''
    const row = h(
      'div',
      {
        class: `rrow irow iv-${b.type}`,
        title: band,
        style: b.pct ? `--zc:${zoneColour(blockTarget(b, tier(), b.dur / 2)!)}` : undefined,
      },
      h('span', { class: 'rn' }, b.label ?? b.type, band ? h('small', {}, '↻') : ''),
      dur,
      target,
      result,
    )
    return { row, target, result, b, band, dur }
  }
  const rows = plan.blocks.map(makeRow)
  const list = h('div', { class: 'glass rlist ilist' }, ...rows.map((r) => r.row))
  const stats = TILES.map(([label]) => hudStat(label))
  const zbar = h(
    'i',
    { class: 'zbar' },
    ...ZONE_COLOURS.map((c, i) => h('i', { style: `background:${c}`, title: `Z${i + 1}` })),
  )
  const note = h('div', { class: 'ghost-note' })
  note.hidden = true
  const drawer = h(
    'div',
    { class: 'glass hstats' },
    ...stats.map((s) => s.el),
    h('div', {}, h('span', {}, 'Time in zone'), h('span', {}, 'Z1 → Z7')),
    zbar,
    note,
  )
  let cur = -1
  return {
    list,
    drawer,
    /** A line at the foot of the drawer (what the dashed trace is). */
    note(text: string) {
      note.hidden = false
      note.textContent = text
    },
    /** Update targets (intensity may have changed), highlight the current interval and move the window to it. */
    frame(i: number, k: number) {
      while (rows.length < plan.blocks.length) {
        const r = makeRow(plan.blocks[rows.length])
        rows.push(r)
        list.append(r.row)
        cur = -1
      }
      rows.forEach((r) => {
        r.target.textContent = rangeText(r.b, tier(), ftp, k)
        r.dur.textContent = fmt(r.b.dur)
      })
      if (i === cur) return
      cur = i
      const [from, to] = listWindow(rows.length, i)
      rows.forEach((r, n) => {
        r.row.hidden = n < from || n >= to
        r.row.classList.toggle('me', n === i)
        r.row.classList.toggle('past', n < i)
      })
    },
    done(stats: BlockStat[], sprints: SprintResult[], upto: number) {
      for (const s of stats) {
        const r = rows[s.i]
        if (!r || s.i >= upto) continue
        const spr = sprints.find((x) => x.blk === s.i)
        const ok = s.compliance >= 0.85
        r.result.className = `rg ${spr ? `g-${spr.grade}` : ok ? 'good' : 'miss'}`
        r.result.textContent = spr
          ? spr.grade
          : r.b.type === 'free'
            ? `${s.avgPower} W`
            : `${s.avgPower} W ${ok ? '✓' : '✗'}`
      }
    },
    /** Share of each block's seconds spent inside its cadence band (on the row's tooltip). */
    cadence(pcts: (number | null)[]) {
      rows.forEach((r, i) => {
        const v = pcts[i]
        if (r.band && v != null) r.row.title = `${r.band} · ${Math.round(v * 100)}% in band`
      })
    },
    stats(s: LiveStats) {
      TILES.forEach(([, f], i) => (stats[i].v.textContent = f(s)))
      const tot = s.zones.reduce((a, b) => a + b, 0) || 1
      ;[...zbar.children].forEach(
        (c, i) => ((c as HTMLElement).style.flexGrow = String(s.zones[i] / tot)),
      )
    },
  }
}
