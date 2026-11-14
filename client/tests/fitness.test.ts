import { describe, expect, it } from 'vitest'
import { dailyTss, dayKey, fitness, heatmap, rideTss, weeklyTss } from '../src/core/fitness'

// Wednesday 10 June 2026, local time.
const END = new Date(2026, 5, 10, 20)
const ride = (daysAgo: number, tss?: number, extra = {}) => ({
  date: new Date(2026, 5, 10 - daysAgo, 9).toISOString(),
  secs: 3600,
  kj: 600,
  best: {},
  zones: [],
  tss,
  ...extra,
})

describe('TSS', () => {
  it('uses the recorded value, else estimates from zones, else from time', () => {
    expect(rideTss(ride(0, 77))).toBe(77)
    // One hour at threshold-ish (Z4, IF 0.98) is about 96 TSS.
    expect(Math.round(rideTss(ride(0, undefined, { zones: [0, 0, 0, 3600, 0, 0, 0] })))).toBe(96)
    expect(Math.round(rideTss(ride(0)))).toBe(42)
  })
  it('sums rides on the same local day', () => {
    const d = dailyTss([ride(0, 50), ride(0, 30), ride(2, 10)])
    expect(d.get(dayKey(END))).toBe(80)
    expect(d.size).toBe(2)
  })
})

describe('fitness, fatigue and form', () => {
  it('rises with load, fatigue faster than fitness, form goes negative', () => {
    const d = dailyTss([ride(0, 100), ride(1, 100), ride(2, 100)])
    const f = fitness(d, END, 90)
    expect(f).toHaveLength(90)
    const last = f[89]
    expect(last.ctl).toBeGreaterThan(0)
    expect(last.atl).toBeGreaterThan(last.ctl)
    expect(f[89].tsb).toBeLessThan(0)
  })
  it('decays to rest and form recovers', () => {
    const d = dailyTss([ride(30, 150), ride(31, 150), ride(32, 150)])
    const f = fitness(d, END, 30)
    expect(f[29].atl).toBeLessThan(f[0].atl)
    expect(f[29].tsb).toBeGreaterThan(0)
  })
  it('is all zero with no rides', () => {
    expect(fitness(new Map(), END, 10).every((x) => x.ctl === 0 && x.tsb === 0)).toBe(true)
  })
})

describe('weeks, heatmap and streaks', () => {
  const d = dailyTss([ride(0, 50), ride(1, 20), ride(8, 100)])
  it('weekly TSS runs Monday to Sunday, oldest first', () => {
    const w = weeklyTss(d, END, 3)
    expect(w).toHaveLength(3)
    expect(w[2]).toEqual({ start: '2026-06-08', tss: 70 })
    expect(w[1]).toEqual({ start: '2026-06-01', tss: 100 })
    expect(w[0].tss).toBe(0)
  })
  it('heatmap is weeks of seven days, with future days flagged', () => {
    const g = heatmap(d, END, 2)
    expect(g).toHaveLength(2)
    expect(g[1][0]).toMatchObject({ day: '2026-06-08', tss: null, future: false })
    expect(g[1][1].tss).toBe(20)
    expect(g[1][2]).toMatchObject({ day: '2026-06-10', tss: 50 })
    expect(g[1][3].future).toBe(true)
    expect(g[0][0].day).toBe('2026-06-01')
  })
})
