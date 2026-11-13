import type { RoadPath } from './roadPath'

const CAP = 2048

/** Spatial hash of centreline segments, for "which bits of road are near this spot" over the whole route. */
export class RoadIndex {
  /** Results of the last `scan`: distance to each nearby segment, the road height there and metres along. */
  readonly dist = new Float64Array(CAP)
  readonly h = new Float64Array(CAP)
  readonly d = new Float64Array(CAP)
  private cells = new Map<number, number[]>()
  private reach: number

  /** `stride` joins that many route points into one segment, for a coarser and cheaper index. */
  constructor(
    private path: RoadPath,
    private cell: number,
    private stride = 1,
  ) {
    for (let i = 0; i < path.n - 1; i += stride) {
      const k = this.key(Math.floor(path.x[i] / cell), Math.floor(path.z[i] / cell))
      const list = this.cells.get(k)
      if (list) list.push(i)
      else this.cells.set(k, [i])
    }
    this.reach = path.space * stride
  }

  private key(ix: number, iz: number) {
    return (ix + 32768) * 65536 + iz + 32768
  }

  /** Fills `dist`, `h` and `d` with every segment within `r` metres of (x, z); returns how many. */
  scan(x: number, z: number, r: number): number {
    const { path, cell, stride } = this
    const pad = r + this.reach
    const x1 = Math.floor((x + pad) / cell)
    const z0 = Math.floor((z - pad) / cell)
    const z1 = Math.floor((z + pad) / cell)
    let n = 0
    for (let ix = Math.floor((x - pad) / cell); ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(this.key(ix, iz))
        if (!list) continue
        for (let k = 0; k < list.length && n < CAP; k++) {
          const i = list[k]
          const j = Math.min(i + stride, path.n - 1)
          const ax = path.x[i]
          const az = path.z[i]
          const sx = path.x[j] - ax
          const sz = path.z[j] - az
          const l2 = sx * sx + sz * sz
          const t = l2 ? Math.min(1, Math.max(0, ((x - ax) * sx + (z - az) * sz) / l2)) : 0
          const dist = Math.hypot(x - ax - sx * t, z - az - sz * t)
          if (dist > r) continue
          this.dist[n] = dist
          this.h[n] = path.y[i] + (path.y[j] - path.y[i]) * t
          this.d[n++] = (i + (j - i) * t) * path.space
        }
      }
    return n
  }

  /** True when any of the centreline is within `r` metres of (x, z). */
  any(x: number, z: number, r: number): boolean {
    const { path, cell, stride } = this
    const pad = r + this.reach
    const x1 = Math.floor((x + pad) / cell)
    const z0 = Math.floor((z - pad) / cell)
    const z1 = Math.floor((z + pad) / cell)
    for (let ix = Math.floor((x - pad) / cell); ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(this.key(ix, iz))
        if (!list) continue
        for (let k = 0; k < list.length; k++) {
          const i = list[k]
          const j = Math.min(i + stride, path.n - 1)
          const ax = path.x[i]
          const az = path.z[i]
          const sx = path.x[j] - ax
          const sz = path.z[j] - az
          const l2 = sx * sx + sz * sz
          const t = l2 ? Math.min(1, Math.max(0, ((x - ax) * sx + (z - az) * sz) / l2)) : 0
          if (Math.hypot(x - ax - sx * t, z - az - sz * t) <= r) return true
        }
      }
    return false
  }

  /** Nearest point of the centreline within `r`: returns its distance (Infinity if none) and sets `at` and `height`. */
  at = 0
  height = 0
  nearest(x: number, z: number, r: number): number {
    const n = this.scan(x, z, r)
    let best = Infinity
    for (let k = 0; k < n; k++)
      if (this.dist[k] < best) {
        best = this.dist[k]
        this.at = this.d[k]
        this.height = this.h[k]
      }
    return best
  }
}
