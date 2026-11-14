import { describe, expect, it } from 'vitest'
import { extraMetrics, wBalance } from '../src/core/rideMetrics'

const steady = (secs: number, w: number) => Array<number>(secs).fill(w)

describe('extra ride metrics', () => {
  it('a steady ride has a variability index of one', () => {
    const m = extraMetrics(steady(1800, 200), steady(1800, 140), steady(1800, 90), 250)
    expect(m.vi).toBeCloseTo(1, 2)
    expect(m.ef).toBeCloseTo(200 / 140, 2)
    expect(m.drift).toBeCloseTo(0, 5)
  })
  it('intervals vary more than steady riding', () => {
    const p = Array.from({ length: 1800 }, (_, i) => (Math.floor(i / 60) % 2 ? 300 : 100))
    expect(extraMetrics(p, [], [], 250).vi!).toBeGreaterThan(1.1)
  })
  it('heart rate creeping up at the same power shows as drift', () => {
    const hr = Array.from({ length: 3600 }, (_, i) => 130 + (i / 3600) * 20)
    const d = extraMetrics(steady(3600, 200), hr, [], 250).drift!
    expect(d).toBeGreaterThan(4)
    expect(d).toBeLessThan(10)
  })
  it('needs heart rate for most of the ride and a long enough ride', () => {
    const someHr = [...steady(600, 140), ...Array<null>(1200).fill(null)]
    expect(extraMetrics(steady(1800, 200), someHr, [], 250).ef).toBeNull()
    expect(extraMetrics(steady(300, 200), steady(300, 140), [], 250).vi).toBeNull()
    expect(extraMetrics(steady(900, 200), steady(900, 140), [], 250).drift).toBeNull()
  })
  it('counts seconds in each cadence band and leaves out coasting', () => {
    const cad = [...steady(10, 65), ...steady(20, 95), ...steady(5, 0), ...steady(3, 115)]
    expect(extraMetrics([], [], cad, 250).cadence).toEqual([
      ['under 70', 10],
      ['70–80', 0],
      ['80–90', 0],
      ['90–100', 20],
      ['100–110', 0],
      ['110+', 3],
    ])
  })
  it('W′ drains above CP and comes back below it', () => {
    const wb = wBalance([...steady(60, 450), ...steady(600, 100)], 250, 20000)
    expect(wb[59]).toBe(20000 - 60 * 200)
    expect(wb[659]).toBeGreaterThan(wb[59])
    expect(wb[659]).toBeLessThan(20000)
    const m = extraMetrics([...steady(60, 450), ...steady(600, 100)], [], [], 250)
    expect(m.wbalMin).toBe(8000)
    expect(m.wbalPct).toBeCloseTo(0.4)
  })
})
