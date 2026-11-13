import { routeById } from '../core/rideTrack'
import type { Route } from '../core/route'
import { svgEl } from './svg'

/** The route's line as SVG path data in a `w` by `h` box, north up, with the points it was drawn through. */
export function tracePath(route: Route, w: number, h: number, pad = 4, upTo = Infinity) {
  const pts = route.points.filter((p) => p.lat !== undefined && p.d <= upTo)
  if (pts.length < 2) return ''
  const all = route.points
  const k = Math.cos((all[0].lat! * Math.PI) / 180)
  const xs = all.map((p) => p.lon! * k)
  const ys = all.map((p) => -p.lat!)
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)]
  const [dx, dy] = [Math.max(...xs) - x0 || 1e-9, Math.max(...ys) - y0 || 1e-9]
  const s = Math.min((w - 2 * pad) / dx, (h - 2 * pad) / dy)
  const step = Math.max(1, Math.floor(pts.length / 300))
  return pts
    .filter((_, i) => i % step === 0 || i === pts.length - 1)
    .map((p, i) => {
      const x = (w - dx * s) / 2 + (p.lon! * k - x0) * s
      const y = (h - dy * s) / 2 + (-p.lat! - y0) * s
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join('')
}

/**
 * A small map of a route by id: just its line, drawn once the route has loaded. `riddenM` (ride detail) draws
 * the part that was ridden brighter and marks the start. Stays empty for a route this device does not have.
 */
export function routeTrace(id: string, w: number, h: number, riddenM?: number) {
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rtrace', role: 'img' })
  svg.setAttribute('aria-label', 'Route map')
  void routeById(id).then((route) => {
    if (!route || route.points[0].lat === undefined) return svg.classList.add('none')
    const whole = tracePath(route, w, h)
    svg.append(svgEl('path', { d: whole, class: riddenM === undefined ? 'on' : 'all' }))
    if (riddenM === undefined) return
    svg.append(svgEl('path', { d: tracePath(route, w, h, 4, riddenM) || whole, class: 'on' }))
    const [x, y] = whole.slice(1).split('L')[0].split(' ')
    svg.append(svgEl('circle', { cx: x, cy: y, r: 3.5, class: 'start' }))
  })
  return svg
}
