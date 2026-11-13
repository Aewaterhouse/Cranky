import { CFG } from '../config'
import { findClimbs } from './climbs'
import type { Route } from './route'

export interface FlyStretch {
  /** Metres along the route where the sweep starts and ends. */
  from: number
  to: number
  /** What it shows, for the card. */
  what: 'The hairpins' | 'The summit' | 'The steep bit' | 'The road'
}

/**
 * The stretch of a route worth showing off before the ride: a stack of hairpins on the main climb, else the top
 * of the main climb, else the steepest stretch, else the middle of the road. `hairpins` are metres along the
 * route (the scene knows the bends; the profile alone does not).
 */
export function flyStretch(route: Route, hairpins: number[] = [], c = CFG.intro): FlyStretch {
  const len = route.distance
  const span = Math.min(c.spanM, len)
  const fit = (mid: number, what: FlyStretch['what']): FlyStretch => {
    const from = Math.max(0, Math.min(len - span, mid - span / 2))
    return { from, to: from + span, what }
  }
  const main = findClimbs(route).reduce<{ start: number; end: number; gain: number } | undefined>(
    (a, b) => (!a || b.gain > a.gain ? b : a),
    undefined,
  )
  if (main && main.gain >= c.minGainM) {
    const on = hairpins.filter((d) => d >= main.start && d <= main.end)
    // The tightest pair of neighbouring bends, if any two are close enough to be a stack.
    let best: [number, number] | undefined
    for (let i = 1; i < on.length; i++)
      if (on[i] - on[i - 1] <= c.stackM && (!best || on[i] - on[i - 1] < best[1] - best[0]))
        best = [on[i - 1], on[i]]
    if (best) return fit((best[0] + best[1]) / 2, 'The hairpins')
    return fit(main.end - span / 2, 'The summit')
  }
  // The steepest `span` of road, by what it gains from end to end.
  const p = route.points
  const n = Math.max(1, Math.round(span / (p[1].d - p[0].d)))
  let at = -1
  let most = (c.steepPct / 100) * span
  for (let i = 0; i + n < p.length; i++) {
    const rise = p[i + n].ele - p[i].ele
    if (rise >= most) [at, most] = [i, rise]
  }
  return at >= 0 ? fit(p[at].d + span / 2, 'The steep bit') : fit(len / 2, 'The road')
}

/** `n` heights evenly along the route, for a small profile. */
export function profileSample(route: Route, n = CFG.intro.profilePts) {
  const p = route.points
  return Array.from({ length: n }, (_, i) => p[Math.round((i / (n - 1)) * (p.length - 1))].ele)
}
