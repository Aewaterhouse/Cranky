import type { PerfStats } from '../scene/perfMon'
import { h } from './dom'

/** What the overlay reads once a second: the monitor's numbers plus what the renderer drew last frame. */
export interface PerfReport extends PerfStats {
  calls: number
  triangles: number
  level: string
  chunks: number
}

export const perfText = (r: PerfReport) =>
  [
    `${r.fps.toFixed(1)} fps avg · ${r.low1.toFixed(1)} fps 1% low · worst ${Math.round(r.worstMs)} ms`,
    `${r.calls} draw calls · ${(r.triangles / 1000).toFixed(0)}k triangles · ${r.chunks} chunks · ${r.level}`,
    r.builds
      ? `chunk builds: ${r.builds}, avg ${r.buildMs.toFixed(0)} ms, worst ${Math.round(r.buildWorstMs)} ms`
      : 'chunk builds: none yet',
  ].join('\n')

/**
 * The frame-time overlay (`?perf=1` in a ride, always in the route harness): three lines in a corner, refreshed
 * once a second from `read`. Returns the element and a stop function.
 */
export function perfOverlay(read: () => PerfReport | undefined) {
  const el = h('pre', { class: 'perf-ov' })
  const paint = () => {
    const r = read()
    if (r) el.textContent = perfText(r)
  }
  const timer = setInterval(paint, 1000)
  paint()
  return { el, stop: () => (clearInterval(timer), el.remove()) }
}
