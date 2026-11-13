import * as THREE from 'three'
import { hash } from '../math'
import { VIS } from '../params'
import { newPose, type Pose, type RoadPath } from './roadPath'

const R = VIS.route
const pose = newPose()
const next = newPose()
const tarmac = new THREE.Color()
const line = new THREE.Color()
const gravel = new THREE.Color()
const tint = new THREE.Color()

/** Triangle soup with one colour per face, in metres from an anchor so the numbers stay small. */
export class Tris {
  pos: number[] = []
  col: number[] = []
  constructor(
    readonly ax: number,
    readonly ay: number,
    readonly az: number,
  ) {}

  /** Adds a triangle from three xyz triples held in `p` at offsets a, b, c. */
  add(p: ArrayLike<number>, a: number, b: number, c: number, colour: THREE.Color) {
    for (const i of [a, b, c]) {
      this.pos.push(p[i] - this.ax, p[i + 1] - this.ay, p[i + 2] - this.az)
      this.col.push(colour.r, colour.g, colour.b)
    }
  }

  build() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.computeBoundingSphere()
    return g
  }
}

/** Writes the point `o` metres right of the centreline (on the banked surface) into `out` at `i`. */
export function across(p: Pose, o: number, out: Float64Array, i: number) {
  out[i] = p.x + p.rx * o
  out[i + 1] = p.y - o * Math.sin(p.bank)
  out[i + 2] = p.z + p.rz * o
}

/** Road ribbon for d0..d1: gravel verges, edge lines, tarmac and a dashed centre line, left out inside `gaps`. */
export function buildRoad(
  path: RoadPath,
  d0: number,
  d1: number,
  out: Tris,
  gaps: [number, number][] = [],
) {
  tarmac.set(R.tarmac)
  line.set(R.line)
  gravel.set(R.gravel)
  const H = R.roadHalf
  const E = H + R.verge
  const L = R.lineW
  const offs = [-E, -H, -H + L, -L / 2, L / 2, H - L, H, E]
  const cols = [gravel, line, tarmac, line, tarmac, line, gravel]
  const n = offs.length
  const p = new Float64Array(n * 6)
  const rows = Math.round((d1 - d0) / R.rowStep)
  for (let j = 0; j < rows; j++) {
    const d = d0 + j * R.rowStep
    path.poseAt(d, pose)
    path.poseAt(d + R.rowStep, next)
    const row = Math.round(d / R.rowStep)
    offs.forEach((o, c) => {
      across(pose, o, p, c * 3)
      across(next, o, p, (n + c) * 3)
    })
    for (let c = 0; c < n - 1; c++) {
      // One dash in three along the centre; every face gets a slightly different shade.
      const bare = row % 3 || gaps.some(([a, b]) => d + R.rowStep > a && d < b)
      const base = c === 3 && bare ? tarmac : cols[c]
      tint.copy(base).multiplyScalar(0.94 + hash(row * 7 + c) * (base === gravel ? 0.2 : 0.08))
      const a = c * 3
      const f = (n + c) * 3
      out.add(p, a, a + 3, f + 3, tint)
      out.add(p, a, f + 3, f, tint)
    }
  }
}

const corner = new Float64Array(24)
const QUADS = [1, 3, 7, 5, 0, 4, 6, 2, 2, 6, 7, 3, 0, 1, 5, 4, 4, 5, 7, 6, 0, 2, 3, 1]
/** Adds a box centred at (cx, cy, cz) with the given half sizes, turned `yaw` radians about the vertical. */
export function addBox(
  out: Tris,
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  yaw: number,
  colour: THREE.Color,
) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? hx : -hx
    const z = i & 4 ? hz : -hz
    corner[i * 3] = cx + x * c + z * s
    corner[i * 3 + 1] = cy + (i & 2 ? hy : -hy)
    corner[i * 3 + 2] = cz - x * s + z * c
  }
  for (let q = 0; q < 24; q += 4) {
    const [a, b, e, f] = [QUADS[q] * 3, QUADS[q + 1] * 3, QUADS[q + 2] * 3, QUADS[q + 3] * 3]
    out.add(corner, a, b, e, colour)
    out.add(corner, a, e, f, colour)
  }
}

/** Adds a bar from a to b (xyz triples) that follows the slope between them: `lo`..`hi` above the line, `thick` across. */
export function addBeam(
  out: Tris,
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  lo: number,
  hi: number,
  thick: number,
  colour: THREE.Color,
) {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1
  const lx = (((b[2] - a[2]) / len) * thick) / 2
  const lz = ((-(b[0] - a[0]) / len) * thick) / 2
  for (let i = 0; i < 8; i++) {
    const e = i & 4 ? b : a
    const s = i & 1 ? 1 : -1
    corner[i * 3] = e[0] + lx * s
    corner[i * 3 + 1] = e[1] + (i & 2 ? hi : lo)
    corner[i * 3 + 2] = e[2] + lz * s
  }
  for (let q = 0; q < 24; q += 4) {
    const [c, d, e, f] = [QUADS[q] * 3, QUADS[q + 1] * 3, QUADS[q + 2] * 3, QUADS[q + 3] * 3]
    out.add(corner, c, d, e, colour)
    out.add(corner, c, e, f, colour)
  }
}
