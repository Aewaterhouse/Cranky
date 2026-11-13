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

/** Road ribbon for d0..d1: gravel verges, edge lines, tarmac and a dashed centre line. */
export function buildRoad(path: RoadPath, d0: number, d1: number, out: Tris) {
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
      const base = c === 3 && row % 3 ? tarmac : cols[c]
      tint.copy(base).multiplyScalar(0.94 + hash(row * 7 + c) * (base === gravel ? 0.2 : 0.08))
      const a = c * 3
      const f = (n + c) * 3
      out.add(p, a, a + 3, f + 3, tint)
      out.add(p, a, f + 3, f, tint)
    }
  }
}
