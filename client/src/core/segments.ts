import { CFG } from '../config'
import { findClimbs } from './climbs'
import type { Route } from './route'

const S = CFG.segments

export type SegKind = 'climb' | 'sprint' | 'route' | 'lap'
/** A timed stretch of a route, in metres along one lap of it. */
export interface Segment {
  /** Stable across sessions: route id, kind and the start rounded to `idRoundM`. */
  id: string
  kind: SegKind
  name: string
  start: number
  end: number
}

/** The single lap behind a lap ride, or the route itself. */
export const baseRoute = (r: Route) => r.lapOf ?? r

/** The id of the whole-route segment (one lap, on a circuit): what ghosts and the route board are keyed on. */
export const wholeId = (route: Route) => {
  const r = baseRoute(route)
  return segId(r.id, r.loop ? 'lap' : 'route', 0)
}

const segId = (route: string, kind: SegKind, start: number) =>
  `${route}:${kind}:${Math.round(start / S.idRoundM) * S.idRoundM}`

/** The named peak or lookout nearest the point `d` metres along, if one is within `poiM`. */
function poiNear(r: Route, d: number): string | undefined {
  const t = r.terrain
  const at =
    r.points[Math.min(r.points.length - 1, Math.round(d / (r.points[1].d - r.points[0].d)))]
  if (!t || at.lat === undefined || at.lon === undefined) return undefined
  const e = (at.lon - t.lon0) * 111320 * Math.cos((t.lat0 * Math.PI) / 180)
  const n = (at.lat - t.lat0) * 110540
  let best: string | undefined
  let bestM = S.poiM
  for (const p of r.features?.pois ?? []) {
    const m = Math.hypot(p.at[0] - e, p.at[1] - n)
    if ((p.k === 'peak' || p.k === 'viewpoint') && /[a-z]/i.test(p.n) && m < bestM)
      [best, bestM] = [p.n, m]
  }
  return best
}

/** Where the sprint goes: the last `lenM` stretch with no gradient past `flatPct`, else the flattest one. */
function sprintStart(r: Route, c = S.sprint): number | undefined {
  const p = r.points
  const n = Math.round(c.lenM / (p[1].d - p[0].d))
  if (p.length - 1 < 2 * n) return undefined
  let flattest = 0
  let least = Infinity
  for (let i = p.length - 1 - n; i >= 0; i--) {
    let worst = 0
    for (let k = i; k < i + n; k++) worst = Math.max(worst, Math.abs(p[k].grade))
    if (worst <= c.flatPct) return p[i].d
    if (worst < least) [flattest, least] = [i, worst]
  }
  return p[flattest].d
}

/**
 * The segments of a route (of one lap, for a lap ride): every sustained climb, one sprint, and the whole
 * route or, on a circuit, one lap. The same route always gives the same list.
 */
export function routeSegments(route: Route): Segment[] {
  const r = baseRoute(route)
  const used = new Map<string, number>()
  const climbs = findClimbs(r).map((c, i): Segment => {
    const poi = poiNear(r, c.end)
    const seen = poi ? (used.get(poi) ?? 0) + 1 : 0
    if (poi) used.set(poi, seen)
    const name = poi ? `${poi}${seen > 1 ? ` ${seen}` : ''} climb` : `${r.name} · climb ${i + 1}`
    return { id: segId(r.id, 'climb', c.start), kind: 'climb', name, start: c.start, end: c.end }
  })
  const s = sprintStart(r)
  const sprint: Segment[] =
    s === undefined
      ? []
      : [
          {
            id: segId(r.id, 'sprint', s),
            kind: 'sprint',
            name: `${r.name} · sprint`,
            start: s,
            end: s + S.sprint.lenM,
          },
        ]
  const kind: SegKind = r.loop ? 'lap' : 'route'
  const whole: Segment = {
    id: segId(r.id, kind, 0),
    kind,
    name: r.loop ? `${r.name} · one lap` : r.name,
    start: 0,
    end: r.distance,
  }
  return [...climbs, ...sprint, whole]
}

/** A segment time: "24.3 s" under a minute, then m:ss, then h:mm:ss. */
export function segClock(secs: number) {
  if (secs < 59.95) return `${secs.toFixed(1)} s`
  const t = Math.round(secs)
  const ss = String(t % 60).padStart(2, '0')
  return t >= 3600
    ? `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${ss}`
    : `${Math.floor(t / 60)}:${ss}`
}

/** "−0:04" or "+0:11": seconds against a best, minus when ahead of it. */
export function splitText(deltaS: number) {
  const s = Math.round(Math.abs(deltaS))
  return `${deltaS < -0.5 ? '−' : '+'}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
