import { CFG } from '../config'
import type { Point, Profile } from '../core/curve'
import { h } from './dom'
import { ZONE_COLOURS } from './planGraph'

const NS = 'http://www.w3.org/2000/svg'
const svgEl = (tag: string, attrs: Record<string, string | number>, text?: string) => {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text) e.textContent = text
  return e
}
export const dur = (s: number) => (s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${s / 3600} h`)
const ZONE_NAMES = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2', 'Anaerobic', 'Sprint']

/** Log-time power curve: solid line from real rides, hollow dots where it is only estimated. */
export function curveChart(allTime: Record<number, Point>, d90: Record<number, Point>) {
  const W = 480
  const H = 220
  const [l, r, t, b] = [44, 12, 12, 28]
  const D = CFG.curveDurations
  const x = (s: number) => l + (Math.log(s) / Math.log(D[D.length - 1])) * (W - l - r)
  const ws = D.flatMap((d) => [allTime[d].w, d90[d].w])
  const hi = Math.ceil((Math.max(...ws) * 1.08) / 100) * 100
  const y = (w: number) => t + (1 - w / hi) * (H - t - b)
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curve-chart', role: 'img' })
  svg.append(svgEl('title', {}, 'Power curve'))
  for (let w = 0; w <= hi; w += hi > 600 ? 200 : 100) {
    svg.append(
      svgEl('line', { x1: l, x2: W - r, y1: y(w), y2: y(w), class: 'grid' }),
      svgEl('text', { x: l - 6, y: y(w) + 4, class: 'ax', 'text-anchor': 'end' }, String(w)),
    )
  }
  D.forEach((d, i) => {
    if (i % 2 === 0 || d === 3600)
      svg.append(svgEl('text', { x: x(d), y: H - 8, class: 'ax', 'text-anchor': 'middle' }, dur(d)))
  })
  const line = (pts: Record<number, Point>, cls: string) => {
    svg.append(
      svgEl('polyline', {
        class: cls,
        points: D.map((d) => `${x(d).toFixed(1)},${y(pts[d].w).toFixed(1)}`).join(' '),
      }),
    )
    for (const d of D)
      svg.append(
        svgEl('circle', {
          cx: x(d),
          cy: y(pts[d].w),
          r: 3.5,
          class: `${cls}-dot${pts[d].real ? '' : ' est'}`,
        }),
      )
  }
  line(d90, 'l90')
  line(allTime, 'lall')
  return svg
}

export function zoneBar(zones: number[]) {
  const total = zones.reduce((a, b) => a + b, 0)
  if (!total)
    return h('p', { class: 'dim' }, 'Ride a bit and your time in each zone shows up here.')
  return h(
    'div',
    { class: 'zones' },
    h(
      'div',
      { class: 'zbar' },
      ...zones.map((z, i) =>
        h('i', {
          style: `flex:${z};background:${ZONE_COLOURS[i]}`,
          title: `Z${i + 1} ${ZONE_NAMES[i]}`,
        }),
      ),
    ),
    h(
      'ul',
      { class: 'zlegend' },
      ...zones.map((z, i) =>
        h(
          'li',
          { class: z ? '' : 'none' },
          h('i', { style: `background:${ZONE_COLOURS[i]}` }),
          h('b', {}, `Z${i + 1}`),
          h('span', {}, ZONE_NAMES[i]),
          h('em', {}, `${Math.round((z / total) * 100)}%`),
        ),
      ),
    ),
  )
}

const best = (r: Profile['rides'][number], d: number) => (r.best[d] ? `${r.best[d]} W` : '–')

export function history(p: Profile) {
  const rides = p.rides.slice(-12).reverse()
  if (!rides.length) return h('p', { class: 'dim' }, 'No rides yet. Your first one lands here.')
  return h(
    'div',
    { class: 'hist' },
    h(
      'div',
      { class: 'hrow head' },
      h('span', {}, 'Date'),
      h('span', {}, 'Time'),
      h('span', {}, 'kJ'),
      h('span', {}, '5 s'),
      h('span', {}, '1 min'),
      h('span', {}, '20 min'),
    ),
    ...rides.map((r) =>
      h(
        'div',
        { class: 'hrow' },
        h(
          'span',
          { class: 'when' },
          new Date(r.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
        ),
        h('span', {}, `${Math.round(r.secs / 60)} min`),
        h('span', {}, String(Math.round(r.kj))),
        h('span', {}, best(r, 5)),
        h('span', {}, best(r, 60)),
        h('span', {}, best(r, 1200)),
      ),
    ),
  )
}
