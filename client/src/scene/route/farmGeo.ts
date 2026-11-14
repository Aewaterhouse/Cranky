import * as THREE from 'three'
import { hash, noise2 } from '../math'
import { VIS } from '../params'
import type { Level } from '../quality'
import { Mesher, box, cyl, ico } from '../util'
import { col, instances, pos, quat, scale, type Anchor } from './chunkProps'
import type { Features } from './features'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { BUSH } from './oddGeoBush'
import { drawnHeight, type Patch } from './patch'
import { addBeam, addBox, type Tris } from './roadGeo'
import { newPose } from './roadPath'

const R = VIS.route
const F = R.place.farm
const pose = newPose()
const a3 = new Float64Array(3)
const b3 = new Float64Array(3)
const H = Math.PI / 2
const euler = new THREE.Euler()
const autumn = new THREE.Color()

const MAKE = {
  bale: () => {
    const m = new Mesher(0.12)
    m.add(cyl(0.8, 0.8, 1.3, 10), F.straw, [0, 0.8, 0], [0, 0, H])
    return m.build()
  },
  shed: () => {
    const m = new Mesher(0.05)
    m.add(box(7, 3, 5), F.shedWall, [0, 1.5, 0])
    m.add(box(5, 2.4, 0.1), F.shedDark, [0, 1.2, 2.5])
    // A gable roof of two tin slopes, slightly overhanging.
    for (const s of [-1, 1])
      m.add(box(7.6, 0.12, 3.1), F.shedRoof, [0, 3.65, s * 1.35], [s * 0.42, 0, 0])
    return m.build()
  },
  windmill: () => BUSH.windmill(),
  vine: () => {
    const m = new Mesher(0.3)
    m.add(box(0.6, 0.8, F.vineSeg), '#ffffff', [0, 1, 0])
    return m.build()
  },
  rowEnd: () => {
    const m = new Mesher(0.1)
    m.add(box(0.1, 1.5, 0.1), F.post, [0, 0.75, 0])
    m.add(ico(0.2), F.rose, [0, 0.45, -0.45])
    return m.build()
  },
}
type Kind = keyof typeof MAKE
let geos: Partial<Record<Kind, THREE.BufferGeometry>> = {}
export function dropFarmGeos() {
  for (const g of Object.values(geos)) g.dispose()
  geos = {}
}

interface Prop {
  kind: Kind
  x: number
  z: number
  face: number
  /** Vines only: their slope, middle height and how autumnal (0..1). */
  tilt?: number
  y?: number
  tint?: number
}

/**
 * Farm dressing for the open grass either side of chunk `k`: a post-and-wire fence along the road (into `solid`),
 * and round bales, a shed or a windmill out in the paddock, or vine rows on a vineyard route (instanced, returned).
 * Nothing near streets or buildings.
 */
export function buildFarm(
  k: number,
  field: HeightField,
  patches: Patch[],
  cover: LandCover,
  features: Features,
  level: Level,
  solid: Tris,
): THREE.Object3D[] {
  if (level === 'lowpower') return []
  const { path } = field
  const d0 = k * R.chunk
  const edge = R.roadHalf + R.verge
  const props: Prop[] = []
  const at = (d: number, o: number) => {
    path.poseAt(d, pose)
    const x = pose.x + pose.rx * o
    const z = pose.z + pose.rz * o
    const y = drawnHeight(field, patches, x, z)
    const ok = field.clear(x, z, Math.abs(o)) && !features.blocked(x, z, F.clear)
    return { x, y, z, ok: ok && cover.at(x, z, y) === 'g' }
  }
  for (const side of [-1, 1]) {
    const seed = hash(k * 12.9 + side * 3.3 + path.length * 0.001)
    // A farm side: open grass at most sample points beside the whole chunk.
    let grass = 0
    for (let i = 0; i < 5; i++)
      for (const o of [edge + 10, edge + 35]) grass += at(d0 + 20 + i * 40, side * o).ok ? 1 : 0
    if (grass < F.grassShare * 10) continue
    col.set(F.post)
    const wire = new THREE.Color(F.wire)
    let last: { x: number; y: number; z: number } | undefined
    const o = side * (edge + F.fenceOut)
    for (let d = d0; d <= d0 + R.chunk; d += F.postEvery) {
      const p = at(d, o)
      // Gates and gaps: the odd span is left open.
      if (!p.ok || hash(d * 0.71 + seed) < F.gapChance) {
        last = undefined
        continue
      }
      a3.set([p.x, p.y, p.z])
      addBox(solid, p.x, p.y + F.fenceH / 2 - 0.1, p.z, 0.06, F.fenceH / 2 + 0.1, 0.06, 0, col)
      if (last) {
        b3.set([last.x, last.y, last.z])
        for (const h of [F.fenceH * 0.55, F.fenceH * 0.9])
          addBeam(solid, a3, b3, h - 0.03, h, 0.04, wire)
      }
      last = p
    }
    // Vine rows at right angles to the road, each in lengths that follow the ground, a rose at the road end.
    const segs = cover.vineyard ? F.vineSegs[level] : 0
    const before = props.length
    for (let d = d0 + seed * F.vineGap; segs && d < d0 + R.chunk; d += F.vineGap)
      for (let i = 0; i < segs; i++) {
        const o = edge + F.fenceOut + F.vineOut + i * F.vineSeg
        const [p, q] = [at(d, side * o), at(d, side * (o + F.vineSeg))]
        if (!p.ok || !q.ok || !cover.vine(p.x, p.z, p.y) || !cover.vine(q.x, q.z, q.y)) break
        const face = Math.atan2(q.x - p.x, q.z - p.z)
        if (!i) props.push({ kind: 'rowEnd', x: p.x, z: p.z, face })
        const tint = Math.max(0, F.autumnShare - noise2(p.x / 90 + 3, p.z / 90)) / F.autumnShare
        const [x, y, z] = [(p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2]
        props.push({ kind: 'vine', x, z, face, y, tint, tilt: Math.atan2(q.y - p.y, F.vineSeg) })
      }
    if (props.length > before) continue
    const out = (lo: number, hi: number, r: number) => {
      const d = d0 + 20 + hash(seed * 7 + r) * (R.chunk - 40)
      return at(d, side * (edge + lo + hash(seed * 11 + r) * (hi - lo)))
    }
    const face = Math.atan2(pose.fx, pose.fz)
    if (seed < F.baleChance) {
      const c = out(14, 40, 1)
      const n = 2 + Math.floor(hash(seed * 5) * 5)
      for (let i = 0; i < n && c.ok; i++) {
        const b = {
          x: c.x + (hash(seed + i) - 0.5) * 14,
          z: c.z + (hash(seed + i * 2.7) - 0.5) * 14,
        }
        props.push({ kind: 'bale', ...b, face: hash(i * 3.3 + seed) * 6.3 })
      }
    }
    const big = hash(seed * 31)
    const spot = out(30, 70, 2)
    if (spot.ok && big < F.shedChance) props.push({ kind: 'shed', ...spot, face: face + H * side })
    else if (spot.ok && big < F.shedChance + F.windmillChance)
      props.push({ kind: 'windmill', ...spot, face: hash(seed * 9) * 6.3 })
  }
  const a: Anchor = solid
  const meshes: THREE.Object3D[] = []
  for (const kind of Object.keys(MAKE) as Kind[]) {
    const mine = props.filter((p) => p.kind === kind)
    if (!mine.length) continue
    const m = instances((geos[kind] ??= MAKE[kind]()), mine.length, a, (i) => {
      const { x, z, y, face, tilt = 0, tint } = mine[i]
      pos.set(x, y ?? drawnHeight(field, patches, x, z), z)
      quat.setFromEuler(euler.set(-tilt, face, 0, 'YXZ'))
      scale.setScalar(1)
      if (tint !== undefined) col.set(F.leaf).lerp(autumn.set(F.autumn), tint)
    })
    m.castShadow = kind !== 'vine'
    meshes.push(m)
  }
  return meshes
}
