import { CFG } from '../config'
import { rideSeconds, totalMass } from './physics'

const R = CFG.freeRide

export interface RoutePoint {
  d: number
  ele: number
  grade: number
  lat?: number
  lon?: number
}
/**
 * Coarse heights for the land near a route. Row r is `r * cell` metres north of (lat0, lon0) and
 * column c is `c * cell` metres east. Each row is a list of runs of known cells `[startCol, heights]`.
 */
export interface TerrainData {
  cell: number
  lat0: number
  lon0: number
  cols: number
  rows: number
  runs: ([number, number[]][] | null)[]
  /**
   * Land cover, parallel to `runs`: one string per run, one letter per cell. g grass, f forest, b bush, s scrub,
   * u built-up, p park, a sand, r rock, w water.
   */
  cover?: (string[] | null)[]
}
/** Map features near a route, in the terrain grid's local metres `[east, north]`. Every part is optional. */
export interface RouteFeatures {
  roads?: { n: string; k: 'main' | 'street'; p: [number, number][] }[]
  /** `[east, north, width, depth, rot, height]`; `rot` is degrees anticlockwise from east. */
  buildings?: [number, number, number, number, number, number][]
  pois?: { n: string; k: 'peak' | 'viewpoint' | 'tower' | 'cafe'; at: [number, number] }[]
}
export interface Route {
  id: string
  name: string
  desc?: string
  country?: string
  /** Australian state code for bundled routes. */
  region?: string
  /** Hand-built from published gradients rather than a recorded track. */
  approx?: boolean
  points: RoutePoint[]
  distance: number
  ascent: number
  /** Bundled routes only; never stored with imported routes. */
  terrain?: TerrainData
  features?: RouteFeatures
}
/** A raw track point: `d` is metres along the route. */
export interface RawPoint {
  d?: number
  ele?: number
  lat?: number
  lon?: number
}

/** Great-circle distance in metres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)))
}

const attr = (s: string, name: string) =>
  s.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
const tag = (s: string, name: string) =>
  s.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1]

/** Tolerant GPX reader: regex over track (or route) points, no DOM. Missing elevations are filled in by `buildRoute`. */
export function parseGpx(text: string, id = `my-${Date.now().toString(36)}`): Route {
  const raw: RawPoint[] = []
  const re = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  let prev: RawPoint | undefined
  let d = 0
  for (const m of text.matchAll(re)) {
    const lat = parseFloat(attr(m[2], 'lat') ?? '')
    const lon = parseFloat(attr(m[2], 'lon') ?? '')
    if (!isFinite(lat) || !isFinite(lon)) continue
    const e = parseFloat(tag(m[3] ?? '', 'ele') ?? '')
    if (prev) d += haversine(prev.lat!, prev.lon!, lat, lon)
    prev = { d, lat, lon, ele: isFinite(e) ? e : undefined }
    raw.push(prev)
  }
  if (raw.length < 2) throw new Error('No track points found in that GPX file')
  const trk = tag(text, 'trk')
  const name = decode(tag(trk ?? text, 'name') ?? '') || 'Imported route'
  const desc = decode(tag(trk ?? text, 'desc') ?? '') || undefined
  return buildRoute(id, name, raw, desc)
}

/** Fills gaps in elevation by linear interpolation between known values (flat at the ends). */
function fillEle(pts: RawPoint[]): number[] {
  const known = pts.map((p, i) => (p.ele === undefined ? -1 : i)).filter((i) => i >= 0)
  if (!known.length) return pts.map(() => 0)
  return pts.map((p, i) => {
    if (p.ele !== undefined) return p.ele
    const b = known.filter((k) => k < i).pop()
    const a = known.find((k) => k > i)
    if (b === undefined) return pts[a!].ele!
    if (a === undefined) return pts[b].ele!
    const f = (p.d! - pts[b].d!) / (pts[a].d! - pts[b].d! || 1)
    return pts[b].ele! + (pts[a].ele! - pts[b].ele!) * f
  })
}

const round = (v: number, dp: number) => +v.toFixed(dp)

/** Raw points (with `d`) to an evenly spaced, smoothed route with gradients and totals. */
export function buildRoute(
  id: string,
  name: string,
  raw: RawPoint[],
  desc?: string,
  extra: Partial<Route> = {},
): Route {
  const src = raw.filter((p) => p.d !== undefined)
  if (src.length < 2 || src[src.length - 1].d! <= 0) throw new Error('A route needs some distance')
  const ele = fillEle(src)
  const total = src[src.length - 1].d!
  // Very long routes get a wider spacing so they stay under the stored-sample cap.
  const space = Math.max(R.spacingM, Math.ceil(total / R.maxStored / R.spacingM) * R.spacingM)
  const n = Math.floor(total / space) + 1
  const hasPos = src.every((p) => p.lat !== undefined && p.lon !== undefined)
  const el: number[] = []
  const lat: number[] = []
  const lon: number[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const d = i * space
    while (j < src.length - 2 && src[j + 1].d! < d) j++
    const span = src[j + 1].d! - src[j].d!
    const f = span > 0 ? Math.min(1, Math.max(0, (d - src[j].d!) / span)) : 0
    const mix = (a: number, b: number) => a + (b - a) * f
    el.push(mix(ele[j], ele[j + 1]))
    if (hasPos) {
      lat.push(mix(src[j].lat!, src[j + 1].lat!))
      lon.push(mix(src[j].lon!, src[j + 1].lon!))
    }
  }
  const half = Math.max(1, Math.round(R.smoothM / space / 2))
  const sm = el.map((_, i) => {
    // Symmetric window that shrinks at the ends, so the start and finish heights stay put.
    const w = Math.min(half, i, n - 1 - i)
    const lo = i - w
    const hi = i + w
    let s = 0
    for (let k = lo; k <= hi; k++) s += el[k]
    return s / (hi - lo + 1)
  })
  let ascent = 0
  const points: RoutePoint[] = sm.map((e, i) => {
    const prev = sm[Math.max(0, i - 1)]
    const g = i === n - 1 ? (e - prev) / space : (sm[i + 1] - e) / space
    if (i > 0 && e > prev) ascent += e - prev
    const p: RoutePoint = {
      d: i * space,
      ele: round(e, 1),
      grade: round(Math.max(-R.maxGradePct, Math.min(R.maxGradePct, g * 100)), 2),
    }
    if (hasPos) Object.assign(p, { lat: round(lat[i], 5), lon: round(lon[i], 5) })
    return p
  })
  return {
    id,
    name,
    desc,
    ...extra,
    points,
    distance: points[points.length - 1].d,
    ascent: Math.round(ascent),
  }
}

/** Position, elevation and gradient at `d` metres, interpolated and clamped to the route. */
export function routeAt(r: Route, d: number): RoutePoint {
  const p = r.points
  const space = p[1].d - p[0].d
  const x = Math.min(Math.max(d, 0) / space, p.length - 1)
  const i = Math.min(Math.floor(x), p.length - 2)
  const f = x - i
  const a = p[i]
  const b = p[i + 1]
  const mix = (u: number, v: number) => u + (v - u) * f
  return {
    d,
    ele: mix(a.ele, b.ele),
    grade: a.grade,
    lat: a.lat === undefined ? undefined : mix(a.lat, b.lat!),
    lon: a.lon === undefined ? undefined : mix(a.lon, b.lon!),
  }
}

/** Ascent still to climb from `d` onwards, in metres. */
export function ascentFrom(r: Route, d: number) {
  const p = r.points
  const space = p[1].d - p[0].d
  let up = 0
  for (let i = Math.max(0, Math.ceil(d / space)); i < p.length - 1; i++)
    if (p[i + 1].ele > p[i].ele) up += p[i + 1].ele - p[i].ele
  return up
}

/** Headline numbers for a route card. */
export function routeStats(r: Route) {
  const avg = r.distance ? (r.points[r.points.length - 1].ele - r.points[0].ele) / r.distance : 0
  const sorted = r.points.map((p) => p.grade).sort((a, b) => a - b)
  return {
    avgGrade: +(avg * 100).toFixed(1),
    /** The 99th percentile of sample gradients, so one noisy sample doesn't count. */
    maxGrade: Math.max(0, +(sorted[Math.floor(sorted.length * 0.99)] ?? 0).toFixed(1)),
    hasMap: r.points[0].lat !== undefined,
  }
}

/** Seconds to ride the whole route at a steady `power` (W) for a rider of `weightKg`. */
export const routeSeconds = (r: Route, power: number, weightKg?: number) =>
  rideSeconds(
    r.points.map((p) => p.grade),
    r.points[1].d - r.points[0].d,
    power,
    totalMass(weightKg),
  )
