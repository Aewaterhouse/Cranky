import * as THREE from 'three'
import { hash, noise2, smooth } from '../math'
import { VIS } from '../params'
import type { HeightField } from './heightField'
import { across, type Tris } from './roadGeo'
import { newPose } from './roadPath'

const R = VIS.route
const pose = newPose()
const grass = new THREE.Color()
const bush = new THREE.Color()
const rock = new THREE.Color()
const snow = new THREE.Color()
const gravel = new THREE.Color()
const dry = new THREE.Color()
const sea = new THREE.Color()
const tint = new THREE.Color()
/** A row's ground runs this far past the half-way line to the next bit of road, then drops a skirt this deep. */
const OVERLAP_M = 2.5
const SKIRT_M = 30
/** Far rows are no more than this many radians of bend apart. */
const FAN_RAD = 0.2
/** Fill-in triangles keep this far (plus half the road) from any road: near band, far band. */
const FAN_CLEAR = 1
const FAN_CLEAR_FAR = 9

/** Face colour from height and steepness: grass and bush, rock on steep faces, snow up high. */
function shade(x: number, y: number, z: number, up: number, verge: boolean) {
  // The height data reads zero over the sea, so flat ground at zero is drawn as water.
  if (y < R.seaLevel) return tint.copy(sea).multiplyScalar(0.97 + hash(x * 13.7 + z * 7.3) * 0.06)
  tint.copy(grass).lerp(bush, smooth(0.35, 0.7, noise2(x / 90 + 3, z / 90)))
  tint.lerp(dry, smooth(0.5, 0.8, noise2(x / 150 + 20, z / 150 + 4)) * 0.6)
  if (verge) tint.lerp(gravel, 0.2)
  tint.lerp(rock, smooth(R.rockSlope, R.rockSlope - 0.12, up))
  const line = y + (noise2(x / 120, z / 120 + 7) - 0.5) * 200
  tint.lerp(snow, smooth(R.snowLine, R.snowLine + 150, line) * smooth(0.45, 0.7, up))
  return tint.multiplyScalar(0.9 + hash(x * 13.7 + z * 7.3) * 0.2)
}

/** Adds the triangle a, b, c (offsets into `p`) facing up, coloured by where it is. */
function face(out: Tris, p: Float64Array, a: number, b: number, c: number, verge: boolean) {
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
  const col = shade(
    (p[a] + p[b] + p[c]) / 3,
    (p[a + 1] + p[b + 1] + p[c + 1]) / 3,
    (p[a + 2] + p[b + 2] + p[c + 2]) / 3,
    Math.abs(ny) / len,
    verge,
  )
  if (ny > 0) out.add(p, a, b, c, col)
  else out.add(p, a, c, b, col)
}

const sk = new Float64Array(12)
const SKIRT_TRIS = [0, 3, 9, 0, 9, 6, 0, 9, 3, 0, 6, 9]
/** A wall straight down from the edge a-b, drawn both ways round, hiding the gap where two strips meet. */
function skirt(out: Tris, p: Float64Array, a: number, b: number) {
  for (let k = 0; k < 3; k++) {
    sk[k] = sk[6 + k] = p[a + k]
    sk[3 + k] = sk[9 + k] = p[b + k]
  }
  sk[7] -= SKIRT_M
  sk[10] -= SKIRT_M
  const col = shade((sk[0] + sk[3]) / 2, (sk[1] + sk[4]) / 2, (sk[2] + sk[5]) / 2, 0, false)
  for (let t = 0; t < 12; t += 3)
    out.add(sk, SKIRT_TRIS[t], SKIRT_TRIS[t + 1], SKIRT_TRIS[t + 2], col)
}

/**
 * Terrain either side of the road for d0..d1, as rows across the road. Near columns have a vertex every row; far
 * columns every `outerEvery` rows. A row stops where its ground is nearer to another bit of road (the inside of a
 * hairpin, the next leg of a switchback); the gap to a longer neighbour is filled with a fan and the open edge
 * gets a skirt, so strips from different stretches meet instead of crossing.
 */
export function buildTerrain(field: HeightField, d0: number, d1: number, far: boolean, out: Tris) {
  grass.set(R.grass)
  bush.set(R.bush)
  rock.set(R.rock)
  snow.set(R.snow)
  gravel.set(R.gravel)
  dry.set(R.dry)
  sea.set(R.sea)
  const step = R.rowStep
  const rows = Math.round((d1 - d0) / step)
  const offs = [R.roadHalf + R.verge, ...R.inner, ...(far ? R.outer : [])]
  const NI = R.inner.length + 1
  const NC = offs.length
  const p = new Float64Array((rows + 1) * NC * 3)
  const at = (j: number, c: number) => (j * NC + c) * 3
  /** Last column of each row, and whether the row stopped there because another road's ground begins. */
  const end = new Int16Array(rows + 1)
  const cut = new Uint8Array(rows + 1)
  // Far columns get a vertex every `outerEvery` rows, and more often round a bend so their fan stays fine.
  const full: number[] = []
  const isFull = new Uint8Array(rows + 1)
  let turned = 0
  let heading = 0
  for (let j = 0; j <= rows; j++) {
    field.path.poseAt(d0 + j * step, pose)
    const h = Math.atan2(pose.fx, -pose.fz)
    if (j) turned += Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)))
    heading = h
    if (j % R.outerEvery && j < rows && turned < FAN_RAD) continue
    full.push(j)
    isFull[j] = 1
    turned = 0
  }
  /** True when the triangle a, b, c keeps `r` metres clear of every road (centre and edge midpoints). */
  const safe = (a: number, b: number, c: number, r: number) => {
    const any = (x: number, z: number) => field.fine.any(x, z, r)
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
      face(out, p, at(j0, c), at(j0, c + 1), at(j1, c + 1), c === 0)
      face(out, p, at(j0, c), at(j1, c + 1), at(j1, c), c === 0)
    }
    const [short, long, eS, eL] = e0 < e1 ? [j0, j1, e0, e1] : [j1, j0, e1, e0]
    const clearance = R.roadHalf + (c1 >= NI ? FAN_CLEAR_FAR : FAN_CLEAR)
    for (let c = Math.max(m, c0); c < eL; c++)
      if (safe(at(short, eS), at(long, c), at(long, c + 1), clearance))
        face(out, p, at(short, eS), at(long, c), at(long, c + 1), false)
    if (Math.max(e0, e1) >= c0 && ((cut[j0] && end[j0] <= c1) || (cut[j1] && end[j1] <= c1)))
      skirt(out, p, at(j0, e0), at(j1, e1))
  }
  for (const s of [-1, 1]) {
    for (let j = 0; j <= rows; j++) {
      field.path.poseAt(d0 + j * step, pose)
      across(pose, s * offs[0], p, at(j, 0))
      const n = isFull[j] ? NC : NI
      end[j] = n - 1
      cut[j] = 0
      const spot = (o: number) => field.clear(pose.x + pose.rx * s * o, pose.z + pose.rz * s * o, o)
      for (let c = 1; c < n && !cut[j]; c++) {
        const i = at(j, c)
        let o = offs[c]
        if (!spot(o)) {
          let lo = offs[c - 1]
          for (let k = 0; k < 5; k++) {
            const mid = (lo + o) / 2
            if (spot(mid)) lo = mid
            else o = mid
          }
          o = lo + Math.min(OVERLAP_M, lo * 0.2)
          end[j] = c
          cut[j] = 1
        }
        p[i] = pose.x + pose.rx * s * o
        p[i + 2] = pose.z + pose.rz * s * o
        p[i + 1] = field.ground(p[i], p[i + 2])
      }
    }
    for (let f = 0; f < full.length - 1 && NC > NI; f++) {
      const j0 = full[f]
      const j1 = full[f + 1]
      // Where the near band meets the far band, in-between rows sit on the far band's edge so no cracks open.
      if (end[j0] >= NI - 1 && end[j1] >= NI - 1)
        for (let j = j0 + 1; j < j1; j++)
          for (let k = 0; k < 3 && end[j] >= NI - 1; k++) {
            const a = p[at(j0, NI - 1) + k]
            p[at(j, NI - 1) + k] = a + ((p[at(j1, NI - 1) + k] - a) * (j - j0)) / (j1 - j0)
          }
      band(j0, j1, NI - 1, NC - 1)
    }
    for (let j = 0; j < rows; j++) band(j, j + 1, 0, NI - 1)
  }
}
