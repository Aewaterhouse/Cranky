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

/**
 * Terrain either side of the road for d0..d1, as rows across the road. Near columns have a vertex every row; far
 * columns every `outerEvery` rows. A row stops where its ground is nearer to another bit of road (the inside of a
 * hairpin, the next leg of a switchback), so strips from different stretches meet instead of crossing.
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
  // Far columns get a vertex every `outerEvery` rows, and more often round a bend so their fan stays fine.
  const full: number[] = []
  let turned = 0
  let heading = 0
  for (let j = 0; j <= rows; j++) {
    field.path.poseAt(d0 + j * step, pose)
    const h = Math.atan2(pose.fx, -pose.fz)
    if (j) turned += Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)))
    heading = h
    if (j % R.outerEvery && j < rows && turned < FAN_RAD) continue
    full.push(j)
    turned = 0
  }
  for (const s of [-1, 1]) {
    for (let j = 0; j <= rows; j++) {
      field.path.poseAt(d0 + j * step, pose)
      across(pose, s * offs[0], p, at(j, 0))
      let stuck = 0
      const n = full.includes(j) ? NC : NI
      for (let c = 1; c < n; c++) {
        const i = at(j, c)
        if (stuck) {
          // Past the end of this row's ground: one vertex straight down as a skirt, then nothing.
          p.copyWithin(i, i - 3, i)
          if (stuck++ === 1) p[i + 1] -= SKIRT_M
          continue
        }
        const spot = (o: number) =>
          field.clear(pose.x + pose.rx * s * o, pose.z + pose.rz * s * o, o)
        let o = offs[c]
        if (!spot(o)) {
          stuck = 1
          let lo = offs[c - 1]
          for (let k = 0; k < 5; k++) {
            const mid = (lo + o) / 2
            if (spot(mid)) lo = mid
            else o = mid
          }
          o = lo + Math.min(OVERLAP_M, lo * 0.2)
        }
        p[i] = pose.x + pose.rx * s * o
        p[i + 2] = pose.z + pose.rz * s * o
        p[i + 1] = field.ground(p[i], p[i + 2])
      }
    }
    const quad = (j0: number, j1: number, c: number) => {
      face(out, p, at(j0, c), at(j0, c + 1), at(j1, c + 1), c === 0)
      face(out, p, at(j0, c), at(j1, c + 1), at(j1, c), c === 0)
    }
    for (let f = 0; f < full.length - 1 && NC > NI; f++) {
      const j0 = full[f]
      const j1 = full[f + 1]
      // Where the near band meets the far band, in-between rows sit on the far band's edge so no cracks open.
      for (let j = j0 + 1; j < j1; j++)
        for (let k = 0; k < 3; k++) {
          const a = p[at(j0, NI - 1) + k]
          p[at(j, NI - 1) + k] = a + ((p[at(j1, NI - 1) + k] - a) * (j - j0)) / (j1 - j0)
        }
      for (let c = NI - 1; c < NC - 1; c++) quad(j0, j1, c)
    }
    for (let j = 0; j < rows; j++) for (let c = 0; c < NI - 1; c++) quad(j, j + 1, c)
  }
}
