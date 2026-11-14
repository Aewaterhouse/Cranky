import { describe, expect, it } from 'vitest'
import { RollingAvg, score, inBand } from '../src/core/compliance'
import { EffectsBus } from '../src/core/effects'

describe('compliance', () => {
  it('scores 1 in band and decays to 0 at 20%', () => {
    expect(score(200, 200)).toBe(1)
    expect(score(209, 200)).toBe(1)
    expect(score(225, 200)).toBeCloseTo(0.5)
    expect(score(175, 200)).toBeCloseTo(0.5)
    expect(score(100, 200)).toBe(0)
    expect(score(100, null)).toBeNull()
    expect(inBand(195, 200)).toBe(true)
  })
  it('averages over a 3 s window', () => {
    const r = new RollingAvg(3)
    for (let t = 0; t <= 10; t += 0.5) r.push(t, t < 7 ? 100 : 300)
    expect(r.avg).toBe(300)
  })
  it('effects stack and cap', () => {
    const e = new EffectsBus()
    e.add(1.1, 30, 0)
    expect(e.multiplier(1)).toBeCloseTo(1.1)
    e.add(1.2, 30, 0)
    expect(e.multiplier(1)).toBe(1.25)
    expect(e.multiplier(31)).toBe(1)
  })
})

describe("a crew game's own band", () => {
  it('scores full marks anywhere inside it, however wide', () => {
    expect(score(130, 150, [130, 170])).toBe(1)
    expect(score(170, 150, [130, 170])).toBe(1)
    expect(inBand(131, 150, [130, 170])).toBe(true)
  })
  it('falls away from the edge of the band, not from the middle', () => {
    expect(inBand(129, 150, [130, 170])).toBe(false)
    expect(score(115, 150, [130, 170])).toBeCloseTo(1 - 0.1 / 0.15)
    expect(score(60, 150, [130, 170])).toBe(0)
  })
  it('a tight band is stricter than the usual five per cent', () => {
    expect(inBand(155, 150)).toBe(true)
    expect(inBand(155, 150, [148, 152])).toBe(false)
  })
})
