import { describe, expect, it } from 'vitest'
import { bestEfforts } from '../src/core/curve'
import { smoothPath } from '../src/ui/svg'

/** Samples the cubic segments of a path, returning every y it passes through. */
function ys(d: string): number[] {
  const nums = d.match(/-?[\d.]+/g)!.map(Number)
  let [x0, y0] = nums
  const out = [y0]
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const [c1x, c1y, c2x, c2y, x1, y1] = nums.slice(i, i + 6)
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t
      out.push(u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1)
    }
    ;[x0, y0] = [x1, y1]
    void x0
    void c1x
    void c2x
  }
  return out
}

describe('smooth curve', () => {
  it('never dips below or above its points on a falling curve', () => {
    const pts: [number, number][] = [
      [0, 100],
      [10, 102],
      [20, 105],
      [30, 140],
      [40, 145],
      [50, 160],
    ]
    const all = ys(smoothPath(pts))
    for (let i = 1; i < all.length; i++) expect(all[i]).toBeGreaterThanOrEqual(all[i - 1] - 1e-6)
  })
  it('a ride has a falling curve of bests', () => {
    const power = Array.from(
      { length: 900 },
      (_, i) => 150 + (i % 120 < 30 ? 120 : 0) + Math.sin(i) * 5,
    )
    const b = bestEfforts(power)
    const ds = Object.keys(b)
      .map(Number)
      .sort((a, c) => a - c)
    for (let i = 1; i < ds.length; i++) expect(b[ds[i]]).toBeLessThanOrEqual(b[ds[i - 1]])
  })
})
