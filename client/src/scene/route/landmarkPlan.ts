import { hash } from '../math'
import { VIS } from '../params'
import type { Features, Poi } from './features'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { newPose, project } from './roadPath'

const R = VIS.route
const L = R.place.landmarks
const pose = newPose()

export const LANDMARK_KINDS = [
  'trig',
  'lookout',
  'tower',
  'kiosk',
  'lodge',
  'hut',
  'bathingBox',
  'jetty',
] as const
export type LandmarkKind = (typeof LANDMARK_KINDS)[number]
/** Something to look at: where, which way its front (+z) points, a name for its sign and a 0..1 tint number. */
export interface Landmark {
  kind: LandmarkKind
  x: number
  z: number
  face: number
  name: string
  tint: number
}
const FROM_POI: Record<Poi['kind'], LandmarkKind> = {
  peak: 'trig',
  viewpoint: 'lookout',
  tower: 'tower',
  cafe: 'kiosk',
}
/**
 * Landmarks we know are there, for packs without mapped points of interest: [kind, name, lat, lon]. Positions are
 * approximate and only used when the pack has none of that kind.
 */
const KNOWN: Record<string, [Poi['kind'], string, number, number][]> = {
  'mount-coot-tha': [
    ['viewpoint', 'Mount Coot-tha Lookout', -27.485, 152.959],
    ['cafe', 'Summit Kiosk', -27.4853, 152.9586],
    ['tower', '', -27.4641, 152.9465],
    ['tower', '', -27.4662, 152.9459],
    ['tower', '', -27.4683, 152.9447],
    ['tower', '', -27.4701, 152.9466],
  ],
  'mount-wellington': [
    ['tower', '', -42.8961, 147.2352],
    ['viewpoint', 'The Pinnacle', -42.8957, 147.2372],
  ],
}

/**
 * Every landmark on the route, by chunk: mapped points of interest (peak, lookout, tower, cafe), the ones we
 * know by heart, a ski village at the top of the alpine routes, a summit hut, and jetties and bathing boxes
 * where the road runs beside sand.
 */
export function planLandmarks(
  id: string,
  origin: { lat0: number; lon0: number } | undefined,
  field: HeightField,
  cover: LandCover,
  features: Features,
): Map<number, Landmark[]> {
  const by = new Map<number, Landmark[]>()
  const { path } = field
  /** Files a landmark under its chunk, pushed clear of the route's road, facing the road or away from it. */
  const add = (kind: LandmarkKind, x: number, z: number, name: string, away: boolean) => {
    const k = features.owner(x, z, 1200)
    if (k === undefined) return
    let face = hash(x + z) * 6.28
    if (field.fine.nearest(x, z, 150) < Infinity) {
      path.poseAt(field.fine.at, pose)
      let [dx, dz] = [x - pose.x, z - pose.z]
      const dist = Math.hypot(dx, dz) || 1
      if (dist < 1) [dx, dz] = [pose.rx, pose.rz]
      const clear = R.roadHalf + R.verge + L.clear
      if (dist < clear) [x, z] = [pose.x + (dx / dist) * clear, pose.z + (dz / dist) * clear]
      face = Math.atan2(dx, dz) + (away ? 0 : Math.PI)
    }
    by.set(k, [...(by.get(k) ?? []), { kind, x, z, face, name, tint: hash(x * 0.7 + z * 1.3) }])
  }
  /** A spot `o` metres right of the road at `d`, if it is this road's ground, dry and not on a street. */
  const beside = (d: number, o: number) => {
    path.poseAt(d, pose)
    const [x, z] = [pose.x + pose.rx * o, pose.z + pose.rz * o]
    if (!field.clear(x, z, Math.abs(o)) || features.blocked(x, z, 4)) return undefined
    return cover.at(x, z, field.ground(x, z)) === 'w' ? undefined : ([x, z] as const)
  }

  const pois = [...features.pois]
  if (origin)
    for (const [kind, name, lat, lon] of KNOWN[id] ?? []) {
      if (features.pois.some((p) => p.kind === kind)) continue
      const [e, n] = project(lat, lon, origin.lat0, origin.lon0)
      pois.push({ kind, name, x: e, z: -n })
    }
  for (const p of pois) add(FROM_POI[p.kind], p.x, p.z, p.name, p.kind === 'viewpoint')

  if (L.skiVillages.includes(id))
    for (let i = 0; i < L.lodges; i++) {
      const d = path.length - L.villageFrom - i * L.villageStep - hash(i * 3.1) * 30
      const at = beside(d, (i % 2 ? 1 : -1) * (L.lodgeOut + hash(i * 7.7) * L.lodgeSpread))
      if (at && d > 0) add('lodge', at[0], at[1], '', false)
    }
  let top = 0
  for (let i = 1; i < path.n; i++) if (path.y[i] > path.y[top]) top = i
  if (L.summitHuts.includes(id)) {
    const at = beside(top * path.space, L.lodgeOut)
    if (at) add('hut', at[0], at[1], '', false)
  }

  // Beside sand: a row of bathing boxes on the routes that have them, and now and then a jetty out over the water.
  let lastBoxes = -Infinity
  let lastJetty = -Infinity
  for (let d = 100; d < path.length; d += L.coastStep)
    for (const s of [-1, 1]) {
      path.poseAt(d, pose)
      const { x: px, z: pz, rx, rz, fx, fz } = pose
      const what = (o: number) => {
        const [x, z] = [px + rx * s * o, pz + rz * s * o]
        return field.clear(x, z, o) ? cover.at(x, z, field.ground(x, z)) : undefined
      }
      const sand = L.coastProbe.find((o) => what(o) === 'a' && 'aw'.includes(what(o + 12) ?? '?'))
      if (sand === undefined) continue
      if (L.bathingBoxes.includes(id) && d - lastBoxes >= L.boxesApart) {
        lastBoxes = d
        for (let i = -2; i <= 2; i++)
          add(
            'bathingBox',
            px + rx * s * sand + fx * i * 3.4,
            pz + rz * s * sand + fz * i * 3.4,
            '',
            true,
          )
      }
      const wet = L.coastProbe.map((o) => o + sand).find((o) => what(o) === 'w')
      if (wet !== undefined && d - lastJetty >= L.jettiesApart) {
        lastJetty = d
        add('jetty', px + rx * s * (wet - 6) + fx * 14, pz + rz * s * (wet - 6) + fz * 14, '', true)
      }
    }
  return by
}
