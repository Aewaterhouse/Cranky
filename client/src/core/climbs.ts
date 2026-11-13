import { CFG } from '../config'
import type { Route } from './route'

export interface Climb {
  /** Metres along the route. */
  start: number
  end: number
  /** Metres gained from start to end. */
  gain: number
  /** Average gradient in %. */
  avg: number
}

/**
 * Sustained climbs on a route: stretches at `minPct` or steeper, at least `minM` long. A dip below `minPct`
 * shorter than `dipM` does not end a climb; rolling terrain never starts one.
 */
export function findClimbs(route: Route, c = CFG.hud.climb): Climb[] {
  const p = route.points
  const out: Climb[] = []
  let start = -1
  let top = -1
  const close = () => {
    if (start < 0) return
    const a = p[start]
    const b = p[top]
    const avg = ((b.ele - a.ele) / (b.d - a.d)) * 100
    if (b.d - a.d >= c.minM && avg >= c.minPct)
      out.push({ start: a.d, end: b.d, gain: b.ele - a.ele, avg })
    start = -1
  }
  // A point's gradient is that of the stretch to the next point, so a steep point i moves the top to i + 1.
  for (let i = 0; i < p.length - 1; i++) {
    if (p[i].grade >= c.minPct) {
      if (start < 0) start = i
      top = i + 1
    } else if (start >= 0 && p[i + 1].d - p[top].d > c.dipM) close()
  }
  close()
  return out
}

/** The climb the rider is on, or about to reach within `leadM`. */
export const climbAt = (climbs: Climb[], d: number, leadM = CFG.hud.climb.leadM) =>
  climbs.find((c) => d >= c.start - leadM && d < c.end)
