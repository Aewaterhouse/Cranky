import * as THREE from 'three'
import { hash } from '../math'
import { VIS } from '../params'
import type { Level } from '../quality'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { drawnHeight, type Patch } from './patch'
import { addBox, across, type Tris } from './roadGeo'
import { newPose } from './roadPath'

const R = VIS.route
const V = R.place.verge
const pose = newPose()
const col = new THREE.Color()
const dry = new THREE.Color()
const p = new Float64Array(36)

/** A clump of three thin blades fanning out from (x, y, z). */
function tuft(out: Tris, x: number, y: number, z: number, h: number, seed: number) {
  col.set(V.tuft).lerp(dry.set(V.tuftDry), hash(seed * 7))
  for (let k = 0; k < 3; k++) {
    const a = seed * 6 + (k * Math.PI * 2) / 3
    const [cx, cz] = [Math.cos(a), Math.sin(a)]
    p.set([x - cz * 0.05, y - 0.02, z + cx * 0.05, x + cz * 0.05, y - 0.02, z - cx * 0.05])
    p.set([x + cx * h * 0.45, y + h * (0.8 + k * 0.15), z + cz * h * 0.45], 6)
    both(out, 0, 3, 6)
  }
}

/** Adds the triangle a, b, c (xyz offsets into `p`) both ways round, so it shows from either side. */
function both(out: Tris, a: number, b: number, c: number) {
  out.add(p, a, b, c, col)
  out.add(p, a, c, b, col)
}

/** A flat blob in `col` on the road surface round (d, o): `n` corners, `rd` along and `rx` across, lifted a touch. */
function blob(
  out: Tris,
  path: HeightField['path'],
  d: number,
  o: number,
  rx: number,
  rd: number,
  n: number,
  seed: number,
) {
  path.poseAt(d, pose)
  for (let k = 0; k <= n + 1; k++) {
    const a = (k / n) * Math.PI * 2
    const r = k ? 0.75 + hash(seed + (k % n) * 3.1) * 0.5 : 0
    across(pose, o + Math.sin(a) * rx * r, p, 3 * (k % 2) + 3)
    p[3 * (k % 2) + 3] += pose.fx * Math.cos(a) * rd * r
    p[3 * (k % 2) + 4] += 0.03
    p[3 * (k % 2) + 5] += pose.fz * Math.cos(a) * rd * r
    if (!k) p.copyWithin(0, 3, 6)
    else if (k > 1) both(out, 0, 3, 6)
  }
}

/** Board corners for a '>' chevron: two arms as quads in (across, up) metres on the board face. */
const ARMS = [
  [-0.2, 0.2, -0.04, 0.2, 0.16, 0, 0, 0],
  [0, 0, 0.16, 0, -0.04, -0.2, -0.2, -0.2],
]

/** A yellow chevron board on a post at (x, y, z) facing back down the road (`yaw`), pointing right when `turn` is 1. */
function chevron(out: Tris, x: number, y: number, z: number, yaw: number, turn: number) {
  const [nx, nz] = [Math.sin(yaw), Math.cos(yaw)]
  const [ux, uz] = [nz, -nx]
  addBox(out, x, y + 0.6, z, 0.05, 0.6, 0.05, yaw, col.set(R.signs.post))
  addBox(out, x, y + 1.5, z, 0.42, 0.3, 0.03, yaw, col.set(V.chevronBg))
  col.set(V.chevronFg)
  for (const arm of ARMS) {
    for (let k = 0; k < 4; k++) {
      const u = arm[k * 2] * turn * 1.6
      p[k * 3] = x + ux * u + nx * 0.04
      p[k * 3 + 1] = y + 1.5 + arm[k * 2 + 1] * 1.2
      p[k * 3 + 2] = z + uz * u + nz * 0.04
    }
    both(out, 0, 3, 6)
    both(out, 0, 6, 9)
  }
}

/**
 * Close-up detail for a sense of speed, merged into the chunk's solid mesh: grass tufts beyond the verge, gravel
 * specks on it, chevron boards round sharp bends, and (where there are no real shadows) tree shadows on the road.
 */
export function buildVerge(
  field: HeightField,
  patches: Patch[],
  cover: Pick<LandCover, 'at'>,
  d0: number,
  d1: number,
  level: Level,
  out: Tris,
) {
  const { path } = field
  const k = V.density[level]
  if (!k) return
  const edge = R.roadHalf + R.verge
  const seed0 = Math.floor(d0)
  // Tufts and specks: a fixed number per metre, scaled by quality, each seeded by its index.
  const tufts = Math.round((d1 - d0) * V.tufts * k)
  for (let i = 0; i < tufts; i++) {
    const s = hash(seed0 * 1.31 + i * 7.77)
    const d = d0 + hash(seed0 + i * 3.3) * (d1 - d0)
    const side = s < 0.5 ? -1 : 1
    const o = side * (edge + 0.2 + hash(i * 5.1 + seed0) ** 2 * V.tuftOut)
    across(path.poseAt(d, pose), o, p, 0)
    const [x, z] = [p[0], p[2]]
    if (!field.clear(x, z, Math.abs(o))) continue
    const y = drawnHeight(field, patches, x, z)
    if (/[aw]/.test(cover.at(x, z, y))) continue
    tuft(out, x, y, z, V.tuftH * (0.6 + s * 0.8), hash(i + seed0 * 0.7))
  }
  const specks = Math.round((d1 - d0) * V.specks * k)
  for (let i = 0; i < specks; i++) {
    const d = d0 + hash(seed0 * 2.1 + i * 1.9) * (d1 - d0)
    const side = hash(i * 4.4 + seed0) < 0.5 ? -1 : 1
    const o = side * (R.roadHalf + 0.15 + hash(i * 8.8 + seed0) * (R.verge - 0.2))
    col.set(V.speck).multiplyScalar(0.7 + hash(i * 2.2) * 0.6)
    blob(out, path, d, o, 0.07, 0.09, 3, i * 3.7 + seed0)
  }
  // Chevrons on the outside of sharp bends, a few boards round each apex.
  const { curv, space } = path
  const i0 = Math.ceil(d0 / space)
  const i1 = Math.min(path.n - 2, Math.floor(d1 / space))
  for (let i = Math.max(1, i0); i <= i1; i++) {
    const c = curv[i]
    if (
      Math.abs(c) < V.chevronCurve ||
      Math.abs(c) < Math.abs(curv[i - 1]) ||
      Math.abs(c) < Math.abs(curv[i + 1])
    )
      continue
    const turn = Math.sign(c)
    for (const step of [-1, 0, 1]) {
      path.poseAt(i * space + step * V.chevronApart, pose)
      const o = -turn * (edge + R.place.furniture.signOut)
      const x = pose.x + pose.rx * o
      const z = pose.z + pose.rz * o
      if (!field.clear(x, z, Math.abs(o))) continue
      chevron(out, x, drawnHeight(field, patches, x, z), z, Math.atan2(-pose.fx, -pose.fz), turn)
    }
  }
  // Painted-on tree shadows for levels without shadow maps, where trees grow.
  if (level === 'medium' || level === 'high') return
  for (let d = d0; d < d1; d += V.shadowEvery) {
    if (hash(d * 0.37 + 5) > V.shadowChance) continue
    path.poseAt(d, pose)
    if (!/[fb]/.test(cover.at(pose.x + pose.rx * 12, pose.z + pose.rz * 12, pose.y))) continue
    col.set(R.tarmac).multiplyScalar(V.shadowDark)
    const o = (hash(d) - 0.5) * R.roadHalf
    blob(out, path, d, o, 2 + hash(d * 3) * 2, 1 + hash(d * 5) * 1.5, 7, d)
  }
}
