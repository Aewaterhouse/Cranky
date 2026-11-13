import * as THREE from 'three'
import { hash } from '../math'
import { VIS } from '../params'
import { VC } from '../util'
import { BUILDING_KINDS, buildingGeo, type BuildingKind } from './buildingGeo'
import type { Building } from './features'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { drawnHeight, type Patch } from './patch'
import { plantGeo } from './plantGeo'
import { newPose } from './roadPath'
import { KINDS, TREES, type Spot } from './scatter'

const P = VIS.route.place
const pose = newPose()
const mat = new THREE.Matrix4()
export const pos = new THREE.Vector3()
export const quat = new THREE.Quaternion()
export const scale = new THREE.Vector3()
export const UP = new THREE.Vector3(0, 1, 0)
export const col = new THREE.Color()
export type Anchor = { ax: number; ay: number; az: number }

/** One instanced mesh of `geo` for `n` things; `place` sets pos (scene metres), quat, scale and col for each. */
export function instances(
  geo: THREE.BufferGeometry,
  n: number,
  a: Anchor,
  place: (i: number) => void,
) {
  const m = new THREE.InstancedMesh(geo, VC, n)
  for (let i = 0; i < n; i++) {
    col.set('#ffffff')
    place(i)
    pos.x -= a.ax
    pos.y -= a.ay
    pos.z -= a.az
    m.setMatrixAt(i, mat.compose(pos, quat, scale))
    m.setColorAt(i, col)
  }
  m.receiveShadow = true
  return m
}

/** Plants as one instanced mesh per kind, each a little differently sized, turned and tinted. */
export function buildPlants(spots: Spot[], a: Anchor): THREE.Object3D[] {
  return KINDS.flatMap((kind) => {
    const mine = spots.filter((s) => s.kind === kind)
    if (!mine.length) return []
    const m = instances(plantGeo(kind), mine.length, a, (i) => {
      const s = mine[i]
      pos.set(s.x, s.y - 0.15 * s.s, s.z)
      quat.setFromAxisAngle(UP, s.rot)
      scale.setScalar(s.s)
      col.setRGB(0.82 + s.tint * 0.3, 0.88 + s.tint * 0.2, 0.8 + (1 - s.tint) * 0.25)
    })
    m.castShadow = TREES.includes(kind)
    return [m]
  })
}

/** Which kind of building a footprint becomes: big and tall is the pub, big and low the odd servo. */
export function buildingKind(b: Building): BuildingKind {
  const area = b.w * b.d
  const r = hash(b.x * 0.37 + b.z * 0.91)
  if (b.h >= P.pubHeight && area >= P.pubArea) return 'pub'
  if (area >= P.servoArea && b.h < P.pubHeight) return r < 0.5 ? 'servo' : 'shop'
  return r < 0.4 ? 'gable' : r < 0.65 ? 'verandah' : r < 0.9 ? 'hip' : 'shop'
}

/**
 * Houses and shops at their mapped place, size and angle: walls and roof are separate instanced meshes so each
 * takes its own colour. The ridge runs along the longer side and the front door faces the route.
 */
export function buildBuildings(
  list: Building[],
  field: HeightField,
  patches: Patch[],
  cover: LandCover,
  a: Anchor,
): THREE.Object3D[] {
  const dry = list.filter((b) => cover.at(b.x, b.z, field.ground(b.x, b.z)) !== 'w')
  return BUILDING_KINDS.flatMap((kind) => {
    const mine = dry.filter((b) => buildingKind(b) === kind)
    if (!mine.length) return []
    const geo = buildingGeo(kind)
    const roofH = (w: number, d: number, h: number) =>
      kind === 'servo'
        ? h / 4
        : kind === 'shop'
          ? 1
          : Math.min(P.roofMax, Math.min(w, d) * P.roofPitch)
    const set = (i: number, roof: boolean) => {
      const b = mine[i]
      const turn = b.d > b.w
      const [w, d] = turn ? [b.d, b.w] : [b.w, b.d]
      let rot = b.rot + (turn ? Math.PI / 2 : 0)
      // Front (+z after turning) towards the nearest bit of the route, when one is close.
      if (field.fine.nearest(b.x, b.z, 120) < Infinity) {
        field.path.poseAt(field.fine.at, pose)
        if ((pose.x - b.x) * Math.sin(rot) + (pose.z - b.z) * Math.cos(rot) < 0) rot += Math.PI
      }
      const [cx, cz] = [(Math.cos(b.rot) * b.w) / 2, (-Math.sin(b.rot) * b.w) / 2]
      const [sx, sz] = [(Math.sin(b.rot) * b.d) / 2, (Math.cos(b.rot) * b.d) / 2]
      let top = -Infinity
      for (const [u, v] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        top = Math.max(
          top,
          drawnHeight(field, patches, b.x + cx * u + sx * v, b.z + cz * u + sz * v),
        )
      const y = (top + drawnHeight(field, patches, b.x, b.z)) / 2
      pos.set(b.x, roof ? y + b.h : y, b.z)
      quat.setFromAxisAngle(UP, rot)
      scale.set(w, roof ? roofH(w, d, b.h) : b.h, d)
      const r = hash(b.x * 1.31 + b.z * 0.53 + (roof ? 7 : 0))
      const list = roof ? P.roofs : P.walls
      col.set(
        roof && (kind === 'shop' || kind === 'servo') ? P.trim : list[Math.floor(r * list.length)],
      )
    }
    const wallMesh = instances(geo.walls, mine.length, a, (i) => set(i, false))
    const roofMesh = instances(geo.roof, mine.length, a, (i) => set(i, true))
    wallMesh.castShadow = roofMesh.castShadow = true
    return [wallMesh, roofMesh]
  })
}
