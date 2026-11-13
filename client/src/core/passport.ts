import { CFG } from '../config'
import { ROUTE_AT, kmBetween } from './ausMap'
import type { Badge } from './badges'
import type { Profile } from './curve'
import type { RouteSummary } from './routeLibrary'

const P = CFG.passport

/** A rider's history on one route. */
export interface Stamp {
  /** Times finished: whole routes, or laps of a circuit. */
  n: number
  bestS?: number
  /** Metres climbed on it in all, finished or not. */
  vertM: number
  /** ISO date of the first finish. */
  first?: string
}
/** What a saved free ride says about itself (the parts of the ride summary the passport reads). */
export interface RodeRoute {
  route?: { id: string }
  ascent?: number
  segments?: { kind: string; secs: number }[]
  record: { date: string }
}

/**
 * The profile with a free ride stamped into its passport: every finished whole-route or lap effort counts as
 * a time ridden, and all the climbing counts whether the ride was finished or not.
 */
export function stampRide(p: Profile, s: RodeRoute): Profile {
  if (!s.route) return p
  const whole = (s.segments ?? []).filter((e) => e.kind === 'route' || e.kind === 'lap')
  const was: Stamp = p.passport?.[s.route.id] ?? { n: 0, vertM: 0 }
  const best = Math.min(was.bestS ?? Infinity, ...whole.map((e) => e.secs))
  const now: Stamp = {
    n: was.n + whole.length,
    vertM: was.vertM + Math.max(0, Math.round(s.ascent ?? 0)),
    bestS: Number.isFinite(best) ? best : undefined,
    first: was.first ?? (whole.length ? s.record.date : undefined),
  }
  return { ...p, passport: { ...p.passport, [s.route.id]: now } }
}

type Def = [string, string, string, string, Badge['rank'], boolean, string | undefined]
const short = (name: string) => name.replace(/^Mount /, '').replace(/ (loop|climb)$/i, '')

/**
 * Passport badges in the badge list's own shape: firsts, a state each, all of Brisbane, every route, repeats,
 * and cumulative climbing on a single route up to an Everest.
 */
export function passportBadges(p: Profile, routes: RouteSummary[]): Def[] {
  const stamps = p.passport ?? {}
  const done = routes.filter((r) => (stamps[r.id]?.n ?? 0) > 0)
  const firsts = done.map((r) => stamps[r.id].first!).sort()
  const brisbane = routes.filter(
    (r) =>
      ROUTE_AT[r.id] &&
      kmBetween(ROUTE_AT[r.id], P.brisbane.at as [number, number]) <= P.brisbane.km,
  )
  const states = [...new Set(routes.map((r) => r.region))]
  const stateDone = new Set(done.map((r) => r.region))
  const all = (set: RouteSummary[]) => set.length > 0 && set.every((r) => done.includes(r))
  const top = (pick: (s: Stamp) => number) =>
    routes.reduce<[number, string]>(
      (a, r) =>
        pick(stamps[r.id] ?? { n: 0, vertM: 0 }) > a[0] ? [pick(stamps[r.id]), short(r.name)] : a,
      [0, 'a route'],
    )
  const [vert, hill] = top((s) => s.vertM)
  const [most, haunt] = top((s) => s.n)
  const [v1, v2, v3] = P.vertTiers
  const [r1, r2] = P.repeatTiers
  // prettier-ignore
  return [
    ['pp1', 'First Stamp', 'Finish any bundled route. The passport has to start somewhere.', 'P1', 'bronze', done.length >= 1, firsts[0]],
    ['pp5', 'Frequent Flyer', 'Finish five different routes. Still no lounge access.', 'P5', 'silver', done.length >= 5, firsts[4]],
    ['ppStates', 'Interstate Incident', `Finish a route in every state on the map (${states.length}). Mind the fruit fly bins.`, 'AUS', 'silver', states.length > 0 && states.every((s) => stateDone.has(s)), undefined],
    ['ppBris', 'All of Brisbane', 'Finish every Brisbane route. The river is still brown.', 'BNE', 'silver', all(brisbane), undefined],
    ['ppAll', 'Grand Tour', 'Finish every route in the passport. Go outside, perhaps.', 'ALL', 'gold', all(routes), undefined],
    ['ppRep1', `Regular at ${most >= r1 ? haunt : 'the local'}`, `Finish one route ${r1} times. They know your order.`, `×${r1}`, 'bronze', most >= r1, undefined],
    ['ppRep2', `Part of the furniture at ${most >= r2 ? haunt : 'the local'}`, `Finish one route ${r2} times. Council may fit a plaque.`, `×${r2}`, 'silver', most >= r2, undefined],
    ['ppVert1', `Hill Regular: ${vert >= v1 ? hill : 'one hill'}`, `Climb ${v1.toLocaleString('en-AU')} m in total on one route.`, '2k', 'bronze', vert >= v1, undefined],
    ['ppVert2', `Base Camp ${vert >= v2 ? hill : ''}`.trim(), `Climb ${v2.toLocaleString('en-AU')} m in total on one route: half an Everest, none of the frostbite.`, '½E', 'silver', vert >= v2, undefined],
    ['ppVert3', `Everested ${vert >= v3 ? hill : 'something'}`, `Climb ${v3.toLocaleString('en-AU')} m in total on one route. Took a while. Still counts.`, 'EV', 'gold', vert >= v3, undefined],
  ]
}
