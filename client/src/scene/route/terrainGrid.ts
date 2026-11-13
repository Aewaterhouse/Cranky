import type { TerrainData } from '../../core/route'

/** The pack's height grid, with a 0..1 trust weight that fades to nothing at the edge of the known cells. */
export class TerrainGrid {
  readonly h: Float32Array
  readonly w: Float32Array
  /** Height from the last `sample`. */
  height = 0

  /** `fade` is how many cells in from an unknown cell the grid is fully trusted. */
  constructor(
    readonly t: TerrainData,
    fade = 3,
  ) {
    const { cols, rows } = t
    const h = (this.h = new Float32Array(cols * rows).fill(NaN))
    t.runs.forEach((row, r) => {
      for (const [c0, hs] of row ?? []) h.set(hs, r * cols + c0)
    })
    // Steps to the nearest unknown cell (the grid's border counts as unknown).
    const dist = new Float32Array(cols * rows)
    const at = (c: number, r: number) =>
      c < 0 || r < 0 || c >= cols || r >= rows ? 0 : dist[r * cols + c]
    for (let i = 0; i < dist.length; i++) dist[i] = isNaN(h[i]) ? 0 : fade
    for (let k = 0; k < fade; k++)
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const m = Math.min(at(c - 1, r), at(c + 1, r), at(c, r - 1), at(c, r + 1))
          if (dist[i] > m + 1) dist[i] = m + 1
        }
    this.w = dist.map((d) => d / fade)
    // Unknown cells take the mean of their known neighbours so sampling next to them stays finite.
    for (let k = 0; k < 2; k++) {
      const src = h.slice()
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (!isNaN(src[r * cols + c])) continue
          let s = 0
          let m = 0
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const v = c + dc < 0 || c + dc >= cols ? NaN : src[(r + dr) * cols + c + dc]
              if (!isNaN(v)) {
                s += v
                m++
              }
            }
          if (m) h[r * cols + c] = s / m
        }
    }
    for (let i = 0; i < h.length; i++) if (isNaN(h[i])) h[i] = 0
  }

  /** Bilinear sample at metres east and north of the grid origin: returns the trust weight, sets `height`. */
  sample(east: number, north: number): number {
    const { cols, rows, cell } = this.t
    const fc = east / cell
    const fr = north / cell
    const c = Math.floor(fc)
    const r = Math.floor(fr)
    if (c < 0 || r < 0 || c >= cols - 1 || r >= rows - 1) return 0
    const u = fc - c
    const v = fr - r
    const i = r * cols + c
    const j = i + cols
    const { h, w } = this
    this.height = (h[i] * (1 - u) + h[i + 1] * u) * (1 - v) + (h[j] * (1 - u) + h[j + 1] * u) * v
    return (w[i] * (1 - u) + w[i + 1] * u) * (1 - v) + (w[j] * (1 - u) + w[j + 1] * u) * v
  }
}
