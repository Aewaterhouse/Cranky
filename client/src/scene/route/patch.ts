import { VIS } from '../params'
import type { HeightField } from './heightField'
import { newPose } from './roadPath'

const R = VIS.route
const pose = newPose()
/** A row's ground runs this far past the half-way line to the next bit of road. */
const OVERLAP_M = 2.5
/** Far rows are no more than this many radians of bend apart. */
const FAN_RAD = 0.2

export interface P3 {
  x: number
  y: number
  z: number
}

/**
 * The terrain vertices on one side of the road for d0..d1, as rows across the road. Near columns have a vertex
 * every row; far columns only on `full` rows. A row stops where its ground is nearer to another bit of road (the
 * inside of a hairpin, the next leg of a switchback). The terrain mesh and everything standing on it are built
 * from this, so props sit exactly on the drawn ground.
 */
export class Patch {
  readonly offs: number[]
  /** Columns in the near band, and in all. */
  readonly NI: number
  readonly NC: number
  readonly rows: number
  readonly p: Float64Array
  /** Last column of each row, and whether the row stopped there because another road's ground begins. */
  readonly end: Int16Array
  readonly cut: Uint8Array
  readonly full: number[] = []

  constructor(
    field: HeightField,
    readonly d0: number,
    d1: number,
    far: boolean,
    readonly side: -1 | 1,
  ) {
    const step = R.rowStep
    const rows = (this.rows = Math.round((d1 - d0) / step))
    const offs = (this.offs = [R.roadHalf + R.verge, ...R.inner, ...(far ? R.outer : [])])
    this.NI = R.inner.length + 1
    const NC = (this.NC = offs.length)
    const p = (this.p = new Float64Array((rows + 1) * NC * 3))
    this.end = new Int16Array(rows + 1)
    this.cut = new Uint8Array(rows + 1)
    const s = side
    // Far columns get a vertex every `outerEvery` rows, and more often round a bend so their fan stays fine.
    let turned = 0
    let heading = 0
    for (let j = 0; j <= rows; j++) {
      field.path.poseAt(d0 + j * step, pose)
      const h = Math.atan2(pose.fx, -pose.fz)
      if (j) turned += Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)))
      heading = h
      const isFull = !(j % R.outerEvery && j < rows && turned < FAN_RAD)
      if (isFull) {
        this.full.push(j)
        turned = 0
      }
      const i0 = this.at(j, 0)
      p[i0] = pose.x + pose.rx * s * offs[0]
      p[i0 + 1] = pose.y - s * offs[0] * Math.sin(pose.bank)
      p[i0 + 2] = pose.z + pose.rz * s * offs[0]
      const n = isFull ? NC : this.NI
      this.end[j] = n - 1
      const spot = (o: number) => field.clear(pose.x + pose.rx * s * o, pose.z + pose.rz * s * o, o)
      for (let c = 1; c < n && !this.cut[j]; c++) {
        const i = this.at(j, c)
        let o = offs[c]
        if (!spot(o)) {
          let lo = offs[c - 1]
          for (let k = 0; k < 5; k++) {
            const mid = (lo + o) / 2
            if (spot(mid)) lo = mid
            else o = mid
          }
          o = lo + Math.min(OVERLAP_M, lo * 0.2)
          this.end[j] = c
          this.cut[j] = 1
        }
        p[i] = pose.x + pose.rx * s * o
        p[i + 2] = pose.z + pose.rz * s * o
        p[i + 1] = field.ground(p[i], p[i + 2])
      }
    }
    // Where the near band meets the far band, in-between rows sit on the far band's edge so no cracks open.
    const e = this.NI - 1
    for (let f = 0; f < this.full.length - 1 && NC > this.NI; f++) {
      const j0 = this.full[f]
      const j1 = this.full[f + 1]
      if (this.end[j0] < e || this.end[j1] < e) continue
      for (let j = j0 + 1; j < j1; j++)
        for (let k = 0; k < 3 && this.end[j] >= e; k++) {
          const a = p[this.at(j0, e) + k]
          p[this.at(j, e) + k] = a + ((p[this.at(j1, e) + k] - a) * (j - j0)) / (j1 - j0)
        }
    }
  }

  /** Offset of row j, column c in `p`. */
  at(j: number, c: number) {
    return (j * this.NC + c) * 3
  }

  /**
   * The point on the drawn ground `u` of the way from row j0 to j1 and `v` of the way from column c to c + 1.
   * Returns false when either row has no ground that far out.
   */
  point(j0: number, j1: number, c: number, u: number, v: number, out: P3): boolean {
    if (c + 1 > Math.min(this.end[j0], this.end[j1])) return false
    const { p } = this
    const a = this.at(j0, c)
    // The quad is two triangles split along the diagonal from (j0, c) to (j1, c + 1), as the mesh is.
    const b = v >= u ? this.at(j0, c + 1) : this.at(j1, c)
    const e = this.at(j1, c + 1)
    const s = v >= u ? v : u
    const t = v >= u ? u : v
    out.x = p[a] + (p[b] - p[a]) * s + (p[e] - p[b]) * t
    out.y = p[a + 1] + (p[b + 1] - p[a + 1]) * s + (p[e + 1] - p[b + 1]) * t
    out.z = p[a + 2] + (p[b + 2] - p[a + 2]) * s + (p[e + 2] - p[b + 2]) * t
    return true
  }

  /** Height of the drawn ground `o` metres out on this side at `d` along the route; NaN where the patch has none. */
  height(d: number, o: number): number {
    const { offs, full } = this
    const jf = (d - this.d0) / R.rowStep
    if (jf < 0 || jf > this.rows || o < offs[0] || o >= offs[this.NC - 1]) return NaN
    let c = 0
    while (offs[c + 1] <= o) c++
    let j0 = Math.min(Math.floor(jf), this.rows - 1)
    let j1 = j0 + 1
    if (c >= this.NI - 1) {
      let f = 0
      while (f < full.length - 2 && full[f + 1] <= jf) f++
      j0 = full[f]
      j1 = full[f + 1]
    }
    // A cut row's last vertex is not at its column's offset, so that cell cannot be read back this way.
    if ((this.cut[j0] && this.end[j0] <= c + 1) || (this.cut[j1] && this.end[j1] <= c + 1))
      return NaN
    const ok = this.point(
      j0,
      j1,
      c,
      (jf - j0) / (j1 - j0),
      (o - offs[c]) / (offs[c + 1] - offs[c]),
      tmp,
    )
    return ok ? tmp.y : NaN
  }
}
const tmp: P3 = { x: 0, y: 0, z: 0 }

/** Height of the ground as drawn under (x, z): read off the chunk's patches where they cover it, else worked out. */
export function drawnHeight(field: HeightField, patches: Patch[], x: number, z: number): number {
  const near = field.fine.nearest(x, z, 100) < Infinity
  if (near || field.coarse.nearest(x, z, 700) < Infinity) {
    field.path.poseAt(near ? field.fine.at : field.coarse.at, pose)
    const o = (x - pose.x) * pose.rx + (z - pose.z) * pose.rz
    const d =
      (near ? field.fine.at : field.coarse.at) + (x - pose.x) * pose.fx + (z - pose.z) * pose.fz
    if (Math.abs(o) < R.roadHalf + R.verge) return pose.y - o * Math.sin(pose.bank)
    for (const p of patches) {
      const h = p.side * o > 0 ? p.height(d, Math.abs(o)) : NaN
      if (!isNaN(h)) return h
    }
  }
  return field.ground(x, z)
}
