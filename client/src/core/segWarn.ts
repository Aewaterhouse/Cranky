import { WARN } from '../scene/route/warnVis'
import { routeAt, type Route } from './route'
import { baseRoute, routeSegments } from './segments'

/** A sprint or KOM along the ride, in metres from the start (every lap of a lap ride has its own). */
export interface Mark {
  kind: 'sprint' | 'climb'
  name: string
  start: number
  end: number
  /** Average gradient, %. */
  avgPct: number
}

/** The sprints and KOMs of a ride, in order, repeated on each lap of a lap ride. */
export function rideMarks(route: Route): Mark[] {
  const base = baseRoute(route)
  const laps = route.lapOf ? Math.round(route.distance / base.distance) : 1
  const one = routeSegments(route).flatMap((s) =>
    s.kind === 'sprint' || s.kind === 'climb'
      ? [
          {
            kind: s.kind,
            name: s.name,
            start: s.start,
            end: s.end,
            avgPct:
              ((routeAt(base, s.end).ele - routeAt(base, s.start).ele) / (s.end - s.start)) * 100,
          },
        ]
      : [],
  )
  return Array.from({ length: laps }, (_, k) =>
    one.map((m) => ({ ...m, start: m.start + k * base.distance, end: m.end + k * base.distance })),
  )
    .flat()
    .sort((a, b) => a.start - b.start)
}

/** What to show for the next sprint or KOM: a new banner (once per stage) and the countdown number. */
export interface Warning {
  /** Just reached one of the stages: this many metres short of the start of `mark`. */
  banner: { mark: Mark; stage: number } | null
  /** 3, 2, 1 in the last seconds to the line at the current speed, else null. */
  count: number | null
  next?: Mark
}

/** Heads-up banners at 1 km, 500 m and 200 m before each sprint and KOM, then a 3-2-1 to the line. No DOM. */
export class SegWarnings {
  private shown = new Set<string>()

  constructor(private marks: Mark[]) {}

  /** Call every tick with where the rider is and how fast (m/s). */
  step(dist: number, speed: number): Warning {
    const i = this.marks.findIndex((m) => m.start > dist)
    if (i < 0) return { banner: null, count: null }
    const next = this.marks[i]
    const left = next.start - dist
    let banner: Warning['banner'] = null
    // The nearest stage the rider is inside; starting already past the 1 km mark only gives the later ones.
    const stage = [...WARN.stagesM].sort((a, b) => a - b).find((s) => left <= s)
    if (stage !== undefined && !this.shown.has(`${i}:${stage}`)) {
      for (const s of WARN.stagesM) if (s >= stage) this.shown.add(`${i}:${s}`)
      banner = { mark: next, stage }
    }
    const secs = speed >= WARN.countMinMs ? left / speed : Infinity
    const count = secs <= WARN.countS ? Math.max(1, Math.ceil(secs)) : null
    return { banner, count, next }
  }
}
