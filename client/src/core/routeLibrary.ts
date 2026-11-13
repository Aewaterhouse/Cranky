import { packLoaded } from './offline'
import { CFG } from '../config'
import { rideSeconds, totalMass } from './physics'
import {
  buildRoute,
  haversine,
  type RawPoint,
  type Route,
  type RouteFeatures,
  type TerrainData,
} from './route'

const L = CFG.freeRide.library

/** One line per bundled route, small enough to load with the app. */
export interface RouteSummary {
  id: string
  name: string
  region: string
  blurb: string
  km: number
  gainM: number
  avgGrade: number
  maxGrade: number
  profile: number[]
  /** A circuit: laps can be chosen. */
  loop?: boolean
}
/** The lazy-loaded pack for one route; `pts` are [lat, lon, ele]. */
export interface RoutePack {
  id: string
  name: string
  region: string
  blurb: string
  published: { km: number | null; gainM: number | null; source: string }
  loop?: boolean
  pts: [number, number, number][]
  terrain?: TerrainData
  features?: RouteFeatures
}

export const ROUTE_INDEX: RouteSummary[] = Object.values(
  import.meta.glob<RouteSummary[]>('../../../content/routes/index.json', {
    eager: true,
    import: 'default',
  }),
).flat()
const packs = import.meta.glob<RoutePack>(['../../../content/routes/*.json', '!**/index.json'], {
  import: 'default',
})

/** Pack to Route: cumulative haversine distance, then the same resampling as an imported GPX. */
export function packToRoute(pack: RoutePack): Route {
  let d = 0
  const raw: RawPoint[] = pack.pts.map(([lat, lon, ele], i) => {
    if (i) d += haversine(pack.pts[i - 1][0], pack.pts[i - 1][1], lat, lon)
    return { d, lat, lon, ele }
  })
  return buildRoute(pack.id, pack.name, raw, pack.blurb, {
    region: pack.region,
    loop: pack.loop,
    terrain: pack.terrain,
    features: pack.features,
  })
}

export async function loadRoute(id: string): Promise<Route> {
  const load = packs[`../../../content/routes/${id}.json`]
  if (!load) throw new Error(`No bundled route called ${id}`)
  const pack = await load()
  packLoaded(id)
  return packToRoute(pack)
}

/** Difficulty 1 to 5 from total climb, plus one for a steep average gradient. */
export function difficulty(gainM: number, avgGrade: number) {
  const level = 1 + L.gainForLevel.filter((g) => gainM >= g).length
  return Math.min(5, level + (avgGrade >= L.steepPct ? 1 : 0))
}

export const lengthClass = (km: number) =>
  km < L.lengthKm.short ? 'short' : km >= L.lengthKm.long ? 'long' : 'medium'

/** Rough ride time without the full pack: flat riding for the distance plus the climb's work at `power`. */
export function estimateSeconds(km: number, gainM: number, power: number, weightKg?: number) {
  const mass = totalMass(weightKg)
  return rideSeconds([0], km * 1000, power, mass) + (gainM * mass * 9.81) / Math.max(1, power)
}
