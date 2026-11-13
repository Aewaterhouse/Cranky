import { describe, expect, it } from 'vitest'
import { crewShares, loadBanner } from '../src/core/hud'

describe('team effort on the bus', () => {
  it("gives each riding rider's share of the crew's watts, and no carrier while everyone is on", () => {
    const r = crewShares({
      a: { w: 300, st: 'riding' },
      b: { w: 100, st: 'riding' },
      c: { w: 0, st: 'spectator' },
    })
    expect(r.share).toEqual({ a: 0.75, b: 0.25 })
    expect(r.carrier).toBeNull()
  })
  it('names whoever carries most while someone is off the bus', () => {
    const r = crewShares({
      a: { w: 200, st: 'riding' },
      b: { w: 260, st: 'riding' },
      c: { w: 0, st: 'fell' },
    })
    expect(r.carrier).toBe('b')
  })
  it('says who is off and what it costs while targets are raised', () => {
    expect(loadBanner(1, [])).toBe('')
    expect(loadBanner(1.05, ['Dazza'])).toBe(
      "Dazza is off the bus: everyone else +5% until they're hauled back",
    )
    expect(loadBanner(1.15, ['A', 'B', 'C'])).toMatch(
      /^3 riders are off the bus: everyone else \+15%/,
    )
  })
})
