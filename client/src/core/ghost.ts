import { api } from './api'
import { localBests, type CrewRow } from './efforts'
import type { Route } from './route'
import { wholeId } from './segments'
import { traceAt } from './segmentTracker'

/** A best effort over the whole route (or one lap) that can ride again: metres from the start every few seconds. */
export interface GhostSpec {
  id: string
  name: string
  secs: number
  trace: number[]
}

/**
 * Metres along the ride for a ghost `t` seconds after the start. On a lap ride it rides its best lap over and
 * over; either way it stops at the finish.
 */
export function ghostD(g: GhostSpec, lapM: number, totalM: number, t: number) {
  const lap = Math.floor(Math.max(0, t) / g.secs)
  return Math.min(totalM, lap * lapM + traceAt(g.trace, g.secs, lapM, t - lap * g.secs))
}

/** My own best on this route as a ghost, from this device's copy; undefined before the first full ride. */
export function myGhost(rider: string, route: Route): GhostSpec | undefined {
  const b = localBests(rider)[wholeId(route)]
  return b?.trace && { id: 'ghost:me', name: 'Your PR', secs: b.secs, trace: b.trace }
}

/** The crew's bests over the whole route or lap, fastest first; empty when the server cannot be reached. */
export const routeBoard = (route: Route) =>
  api<CrewRow[]>(`/api/segments/${encodeURIComponent(wholeId(route))}/leaderboard`).catch(
    () => [] as CrewRow[],
  )

/** A mate's best on this route as a ghost, or undefined when they have none or the server is away. */
export const mateGhost = (rider: string, route: Route): Promise<GhostSpec | undefined> =>
  api<CrewRow & { trace: number[] }>(
    `/api/segments/${encodeURIComponent(wholeId(route))}/ghost/${encodeURIComponent(rider)}`,
  )
    .then((g) => ({ id: `ghost:${g.id}`, name: g.name, secs: g.secs, trace: g.trace }))
    .catch(() => undefined)
