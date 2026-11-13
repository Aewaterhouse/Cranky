import type { TerrainData } from '../../core/route'
import { noise2 } from '../math'
import { VIS } from '../params'

const R = VIS.route
/** g grass, f forest, b bush, s scrub, u built-up, p park, a sand, r rock, w water. */
export type Cover = 'g' | 'f' | 'b' | 's' | 'u' | 'p' | 'a' | 'r' | 'w'
const KNOWN = 'gfbsuparw'

/** What grows where: the pack's land cover grid when it has one, otherwise a guess from height. */
export class LandCover {
  /** Trees thin out above this height and stop a little higher. */
  readonly treeline: number
  private grid?: Uint8Array

  constructor(
    private t?: TerrainData,
    region?: string,
  ) {
    this.treeline = region === 'TAS' ? R.treelineTas : R.treeline
    if (!t?.cover) return
    const grid = (this.grid = new Uint8Array(t.cols * t.rows))
    t.runs.forEach((row, r) =>
      row?.forEach(([c0], k) => {
        const s = t.cover![r]?.[k] ?? ''
        for (let i = 0; i < s.length; i++)
          grid[r * t.cols + c0 + i] = KNOWN.includes(s[i]) ? s.charCodeAt(i) : 0
      }),
    )
  }

  /**
   * Cover at scene (x, z) where the ground is `y` high. Boundaries between classes wander with noise; a
   * different `seed` wanders differently, so two samples can be blended for a soft edge.
   */
  at(x: number, z: number, y: number, seed = 0): Cover {
    if (y < R.seaLevel) return 'w'
    const { grid, t } = this
    if (grid && t) {
      const j = R.coverJitter * t.cell * 2
      const s = R.coverNoise
      const e = x + (noise2(x / s + seed * 31, z / s) - 0.5) * j
      const n = -z + (noise2(x / s + 60, z / s + 9 + seed * 17) - 0.5) * j
      const c = Math.round(e / t.cell)
      const r = Math.round(n / t.cell)
      const code = c < 0 || r < 0 || c >= t.cols || r >= t.rows ? 0 : grid[r * t.cols + c]
      // Unmapped ground reads as grass; above the treeline the guess (heath, then rock) is nearer the truth.
      if (code && !(code === 103 && y > this.treeline)) return String.fromCharCode(code) as Cover
    }
    return this.guess(x, z, y)
  }

  /** No map: sand by the sea, bush with patches of forest and clearings, heath then rock above the treeline. */
  guess(x: number, z: number, y: number): Cover {
    if (y < R.seaLevel + R.sandBand) return 'a'
    const line = y + (noise2(x / 140 + 5, z / 140) - 0.5) * 160
    if (line > this.treeline + R.alpineBand) return 'r'
    if (line > this.treeline) return 's'
    const n = noise2(x / 260 + 11, z / 260 + 3)
    return n > 0.62 ? 'f' : n < 0.2 ? 'g' : 'b'
  }
}
