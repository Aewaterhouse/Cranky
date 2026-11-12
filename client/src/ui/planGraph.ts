import { CFG } from '../config'
import { blockTarget, planTotal } from '../core/plan'
import type { Block, Tier } from '../types'

/** Zone colours Z1..Z7, shared by every chart. */
export const ZONE_COLOURS = [
  '#7d8590',
  '#3f88c5',
  '#44bba4',
  '#f2b705',
  '#f6832d',
  '#e94f37',
  '#c2185b',
]
const STANDARD = [...ZONE_COLOURS]
const COLOUR_BLIND = ['#999999', '#0072b2', '#009e73', '#f0e442', '#e69f00', '#d55e00', '#cc79a7']
/** Swaps the shared palette in place, so every chart drawn afterwards uses it. */
export function setZonePalette(colourBlind: boolean) {
  ZONE_COLOURS.splice(0, ZONE_COLOURS.length, ...(colourBlind ? COLOUR_BLIND : STANDARD))
}
export const SPRINT_COLOUR = '#e040fb'
export function zoneColour(frac: number) {
  const i = CFG.zones.findIndex((z) => frac < z)
  return ZONE_COLOURS[i < 0 ? CFG.zones.length : i]
}

const NS = 'http://www.w3.org/2000/svg'
const MAX = 1.6

/**
 * Workout profile as an SVG that stretches to its container (set width/height in CSS).
 * Blocks are coloured by zone; sprints are full-height spikes. `setProgress(secs)` moves the marker.
 */
export function planGraph(blocks: Block[], tier: Tier = 'hard') {
  const total = planTotal(blocks)
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${total} 100`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.classList.add('plan-graph')
  const y = (f: number) => 100 - (Math.min(f, MAX) / MAX) * 100
  let t = 0
  for (const b of blocks) {
    const p = document.createElementNS(NS, 'polygon')
    const w = b.type === 'sprint' ? Math.max(b.dur, total / 150) : b.dur
    const pts: [number, number][] = [[t, 100]]
    if (b.type === 'sprint' || b.type === 'free')
      pts.push([t, b.type === 'sprint' ? 0 : y(0.5)], [t + w, b.type === 'sprint' ? 0 : y(0.5)])
    else if (b.type === 'over-under')
      for (let s = 0; s < b.dur; s += b.step!) {
        const f = blockTarget(b, tier, s)!
        pts.push([t + s, y(f)], [t + Math.min(b.dur, s + b.step!), y(f)])
      }
    else pts.push([t, y(blockTarget(b, tier, 0)!)], [t + w, y(blockTarget(b, tier, b.dur)!)])
    pts.push([t + w, 100])
    p.setAttribute('points', pts.map((q) => q.join(',')).join(' '))
    const mid = blockTarget(b, tier, b.dur / 2)
    p.setAttribute(
      'fill',
      b.type === 'sprint'
        ? SPRINT_COLOUR
        : mid == null
          ? '#555a63'
          : zoneColour(b.type === 'over-under' ? blockTarget(b, tier, 0)! : mid),
    )
    const title = document.createElementNS(NS, 'title')
    title.textContent = `${b.label ?? b.type} · ${Math.round(b.dur / 6) / 10} min`
    p.append(title)
    svg.append(p)
    t += b.dur
  }
  const marker = document.createElementNS(NS, 'rect')
  marker.setAttribute('y', '0')
  marker.setAttribute('height', '100')
  marker.setAttribute('width', '0')
  marker.setAttribute('fill', 'rgba(255,255,255,0.28)')
  svg.append(marker)
  return Object.assign(svg, {
    setProgress: (secs: number) =>
      marker.setAttribute('width', String(Math.max(0, Math.min(total, secs)))),
  })
}
