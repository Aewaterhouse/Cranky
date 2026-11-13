import { clamp, noise2, smooth } from '../math'
import { VIS } from '../params'
import { RoadIndex } from './roadIndex'
import type { RoadPath } from './roadPath'
import type { TerrainGrid } from './terrainGrid'

const R = VIS.route
/** Index cell sizes, the coarse segment length, and how far the made-up ground looks for road. */
const FINE_CELL = 50
const COARSE_CELL = 250
const COARSE_SEG = 40
const FAR = 600
const SOFT = 30
/** Slack on the "is this spot nearest to my bit of road" test: the curve and its straight segments differ a little. */
const SLACK = 1.5

/** Ground height everywhere: the pack's grid where known, made-up hills elsewhere, cut and filled to the road. */
export class HeightField {
  readonly fine: RoadIndex
  readonly coarse: RoadIndex
  private mean: number
  private relief: number

  constructor(
    readonly path: RoadPath,
    readonly grid?: TerrainGrid,
  ) {
    this.fine = new RoadIndex(path, FINE_CELL)
    this.coarse = new RoadIndex(path, COARSE_CELL, Math.max(1, Math.round(COARSE_SEG / path.space)))
    let lo = Infinity
    let hi = -Infinity
    let sum = 0
    for (const y of path.y) {
      lo = Math.min(lo, y)
      hi = Math.max(hi, y)
      sum += y
    }
    this.mean = sum / path.n
    // Flat routes get gentle made-up hills, mountain routes get the full amplitude.
    this.relief = clamp((hi - lo) / 300, 0.15, 1)
  }

  /** Made-up ground: road heights spread sideways (nearer road counts for more) plus rolling noise away from it. */
  private fallback(x: number, z: number) {
    const c = this.coarse
    const n = c.scan(x, z, FAR)
    let su = 0
    let sh = 0
    let min = FAR
    for (let k = 0; k < n; k++) {
      const dist = c.dist[k]
      if (dist < min) min = dist
      const q = dist * dist + SOFT * SOFT
      const u = 1 / (q * q)
      su += u
      sh += u * c.h[k]
    }
    const amp = R.hillAmp * this.relief * smooth(R.shoulder, 300, min)
    const s = R.hillScale
    const roll = (noise2(x / s, z / s) - 0.5) * 2 + (noise2(x / 70 + 9, z / 70) - 0.5) * 0.5
    return (su ? sh / su : this.mean) + amp * roll
  }

  /** Ground before the road is cut in. */
  natural(x: number, z: number) {
    const g = this.grid
    if (!g) return this.fallback(x, z)
    const w = g.sample(x, -z)
    const gh = g.height
    if (w >= 1) return gh
    const fb = this.fallback(x, z)
    return fb + (gh - fb) * w
  }

  /**
   * Ground with the road cut in: level with the nearest stretch of road out to the shoulder, then blending back
   * to natural ground. Every stretch gets its own bench, so stacked hairpins step down the hill between them.
   */
  ground(x: number, z: number) {
    const nat = this.natural(x, z)
    const f = this.fine
    const n = f.scan(x, z, R.shoulder + R.blend)
    let wmax = 0
    let su = 0
    let sh = 0
    for (let k = 0; k < n; k++) {
      const dist = f.dist[k]
      const w = 1 - smooth(R.shoulder, R.shoulder + R.blend, dist)
      if (w <= 0) continue
      if (w > wmax) wmax = w
      // Benches at full weight swamp everything else; among equals the nearer segment wins sharply.
      const q = dist * dist + 1
      const u = (w / (1 - w + 1e-3)) ** 2 / (q * q * q * q)
      su += u
      sh += u * f.h[k]
    }
    return su > 0 ? nat + (sh / su - nat) * wmax : nat
  }

  /** True when no road anywhere is nearer to (x, z) than `o`, the distance to the bit of road asking. */
  clear(x: number, z: number, o: number) {
    return !this.fine.any(x, z, o - SLACK)
  }
}
