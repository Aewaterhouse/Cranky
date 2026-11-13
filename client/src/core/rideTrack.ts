import type { FitRide } from './fit'
import { routeAt, withLaps, type Route } from './route'
import { ROUTE_INDEX, loadRoute } from './routeLibrary'
import { myRoutes } from './routeStore'

/** What a saved ride says about where it went. */
export interface RodeOn {
  route?: { id: string; name: string; laps?: number }
  /** Metres along the route at each recorded second. */
  dist?: number[]
}

/** A bundled or imported route by id; undefined when this device no longer has it. */
export async function routeById(id: string): Promise<Route | undefined> {
  if (ROUTE_INDEX.some((r) => r.id === id)) return loadRoute(id).catch(() => undefined)
  return myRoutes().find((r) => r.id === id)
}

/** Position, height and distance for each recorded second of a ride on `lap` (`laps` times round). */
export function trackOn(lap: Route, laps: number, dist: number[]): FitRide['track'] {
  if (lap.points[0].lat === undefined) return undefined
  const route = withLaps(lap, laps)
  return dist.map((d) => {
    const p = routeAt(route, d)
    return { lat: p.lat!, lon: p.lon!, ele: p.ele, dist: d }
  })
}

/** The track and lap length for a saved ride's FIT file, when it was a free ride on a route with coordinates. */
export async function rideTrack(s: RodeOn): Promise<Pick<FitRide, 'track' | 'lapM'>> {
  const lap = s.route && s.dist?.length ? await routeById(s.route.id) : undefined
  if (!lap) return {}
  const laps = s.route!.laps ?? 1
  return { track: trackOn(lap, laps, s.dist!), lapM: laps > 1 ? lap.distance : undefined }
}
