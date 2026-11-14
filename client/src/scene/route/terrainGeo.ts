import * as THREE from 'three'
import { hash, noise2, smooth } from '../math'
import { VIS } from '../params'
import type { RoadIndex } from './roadIndex'
import type { Cover, LandCover } from './landCover'
import type { Patch } from './patch'
import type { Tris } from './roadGeo'

const R = VIS.route
const G = R.ground
const rock = new THREE.Color()
const snow = new THREE.Color()
const gravel = new THREE.Color()
const sea = new THREE.Color()
const sand = new THREE.Color()
const tint = new THREE.Color()
const other = new THREE.Color()
const mix = new THREE.Color()
const SKIRT_M = 30
/** Fill-in triangles keep this far (plus half the road) from any road: near band, far band. */
const FAN_CLEAR = 1
const FAN_CLEAR_FAR = 9
/** Each cover class is its own colour drifting towards a second one with slow noise: [base, towards, how far]. */
const PAINT: Record<Cover, [keyof typeof G, keyof typeof G, number]> = {
  g: ['grass', 'dry', 0.6],
  f: ['forest', 'bush', 0.5],
  b: ['bush', 'grass', 0.45],
  s: ['scrub', 'dry', 0.5],
  u: ['built', 'grass', 0.35],
  p: ['park', 'grass', 0.3],
  a: ['sand', 'dry', 0.15],
  r: ['rock', 'scrub', 0.25],
  w: ['waterBed', 'waterBed', 0],
}

function paint(c: Cover, x: number, z: number, out: THREE.Color) {
  const [a, b, k] = PAINT[c]
  return out.set(G[a]).lerp(mix.set(G[b]), smooth(0.35, 0.75, noise2(x / 110 + 3, z / 110)) * k)
}

/** Face colour from land cover, height and steepness; returns true when the face is water. */
function shade(cover: LandCover, x: number, y: number, z: number, up: number, verge: boolean) {
  const c = cover.at(x, z, y)
  const c2 = cover.at(x, z, y, 1)
  paint(c, x, z, tint)
  // Two samples with different boundary noise: where they disagree the face is a half-way colour.
  if (c2 !== c) tint.lerp(paint(c2, x, z, other), 0.5)
  // On the coast the sea sheet is the water; ground poking through it is beach.
  if (cover.coast && c === 'w') tint.copy(sand)
  if (c !== 'w') {
    if (verge) tint.lerp(gravel, 0.2)
    if (cover.coast) tint.lerp(sand, smooth(R.seaLevel + R.sandBand, R.seaLevel + R.sandBand * 0.4, y))
    tint.lerp(rock, smooth(R.rockSlope, R.rockSlope - 0.12, up))
    const line = y + (noise2(x / 120, z / 120 + 7) - 0.5) * 200
    tint.lerp(snow, smooth(R.snowLine, R.snowLine + 150, line) * smooth(0.45, 0.7, up))
  }
  tint.multiplyScalar(0.9 + hash(x * 13.7 + z * 7.3) * 0.2)
  return c === 'w'
}

const flat = new Float64Array(9)
/** Adds the triangle a, b, c (offsets into `p`) facing up, coloured by where it is; water gets a level sheet on top. */
function face(
  cover: LandCover,
  out: Tris,
  water: Tris,
  p: Float64Array,
  a: number,
  b: number,
  c: number,
  verge: boolean,
) {
  const ux = p[b] - p[a]
  const uy = p[b + 1] - p[a + 1]
  const uz = p[b + 2] - p[a + 2]
  const vx = p[c] - p[a]
  const vy = p[c + 1] - p[a + 1]
  const vz = p[c + 2] - p[a + 2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz)
  if (len < 1e-4) return
  const x = (p[a] + p[b] + p[c]) / 3
  const y = (p[a + 1] + p[b + 1] + p[c + 1]) / 3
  const z = (p[a + 2] + p[b + 2] + p[c + 2]) / 3
  const wet = shade(cover, x, y, z, Math.abs(ny) / len, verge)
  if (ny < 0) [b, c] = [c, b]
  out.add(p, a, b, c, tint)
  // On the coast the sea sheet covers anything below sea level.
  if (!wet || (cover.coast && y < R.seaLevel + 0.3)) return
  ;[a, b, c].forEach((i, k) => {
    flat[k * 3] = p[i]
    flat[k * 3 + 1] = y + R.waterLift
    flat[k * 3 + 2] = p[i + 2]
  })
  water.add(flat, 0, 3, 6, tint.copy(sea).multiplyScalar(0.94 + hash(x * 3.1 + z * 5.7) * 0.12))
}

const sk = new Float64Array(12)
const SKIRT_TRIS = [0, 3, 9, 0, 9, 6, 0, 9, 3, 0, 6, 9]
/** A wall straight down from the edge a-b, drawn both ways round, hiding the gap where two strips meet. */
function skirt(cover: LandCover, out: Tris, p: Float64Array, a: number, b: number) {
  for (let k = 0; k < 3; k++) {
    sk[k] = sk[6 + k] = p[a + k]
    sk[3 + k] = sk[9 + k] = p[b + k]
  }
  sk[7] -= SKIRT_M
  sk[10] -= SKIRT_M
  shade(cover, (sk[0] + sk[3]) / 2, (sk[1] + sk[4]) / 2, (sk[2] + sk[5]) / 2, 0, false)
  for (let t = 0; t < 12; t += 3)
    out.add(sk, SKIRT_TRIS[t], SKIRT_TRIS[t + 1], SKIRT_TRIS[t + 2], tint)
}

/**
 * The terrain mesh for one patch. Where a row stops short of its neighbour the gap is filled with a fan and the
 * open edge gets a skirt, so strips from different stretches of road meet instead of crossing.
 */
export function buildTerrain(
  pt: Patch,
  roads: RoadIndex,
  cover: LandCover,
  out: Tris,
  water: Tris,
) {
  rock.set(G.rock)
  snow.set(R.snow)
  gravel.set(R.gravel)
  sea.set(R.sea)
  sand.set(G.sand)
  const { p, end, cut, NI, NC, full } = pt
  const at = (j: number, c: number) => pt.at(j, c)
  /** True when the triangle a, b, c keeps `r` metres clear of every road (centre and edge midpoints). */
  const safe = (a: number, b: number, c: number, r: number) => {
    const any = (x: number, z: number) => roads.any(x, z, r)
    return !(
      any((p[a] + p[b] + p[c]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3) ||
      any((p[a] + p[b]) / 2, (p[a + 2] + p[b + 2]) / 2) ||
      any((p[b] + p[c]) / 2, (p[b + 2] + p[c + 2]) / 2) ||
      any((p[a] + p[c]) / 2, (p[a + 2] + p[c + 2]) / 2)
    )
  }
  /** Rows j0 and j1 joined over columns c0..c1: quads while both have ground, then a fan to the longer one. */
  const band = (j0: number, j1: number, c0: number, c1: number) => {
    const e0 = Math.min(end[j0], c1)
    const e1 = Math.min(end[j1], c1)
    const m = Math.min(e0, e1)
    for (let c = c0; c < m; c++) {
      face(cover, out, water, p, at(j0, c), at(j0, c + 1), at(j1, c + 1), c === 0)
      face(cover, out, water, p, at(j0, c), at(j1, c + 1), at(j1, c), c === 0)
    }
    const [short, long, eS, eL] = e0 < e1 ? [j0, j1, e0, e1] : [j1, j0, e1, e0]
    const clearance = R.roadHalf + (c1 >= NI ? FAN_CLEAR_FAR : FAN_CLEAR)
    for (let c = Math.max(m, c0); c < eL; c++)
      if (safe(at(short, eS), at(long, c), at(long, c + 1), clearance))
        face(cover, out, water, p, at(short, eS), at(long, c), at(long, c + 1), false)
    if (Math.max(e0, e1) >= c0 && ((cut[j0] && end[j0] <= c1) || (cut[j1] && end[j1] <= c1)))
      skirt(cover, out, p, at(j0, e0), at(j1, e1))
  }
  for (let f = 0; f < full.length - 1 && NC > NI; f++) band(full[f], full[f + 1], NI - 1, NC - 1)
  for (let j = 0; j < pt.rows; j++) band(j, j + 1, 0, NI - 1)
}
