import { describe, expect, it } from 'vitest'
import { applyRide, newProfile } from '../src/core/curve'
import { curveLines, fmtDur, nearestDur, xFrac, yTop, yValue } from '../src/core/powerCurve'

const NOW = Date.parse('2026-06-01T12:00:00Z')
const ride = (date: string, best: Record<number, number>) => ({
  date,
  secs: 3600,
  kj: 100,
  best,
  zones: [],
})

describe('power curve maths', () => {
  const p = [
    ride('2026-01-10T08:00:00Z', { 5: 900, 60: 400 }),
    ride('2026-05-20T08:00:00Z', { 5: 800, 60: 380, 300: 300 }),
    ride('2026-05-28T08:00:00Z', { 5: 700, 60: 350 }),
  ].reduce(applyRide, newProfile('a', 'A', 250))

  it('builds three lines with dates and real flags', () => {
    const [all, d90, last] = curveLines(p, NOW)
    expect(all.pts.find((q) => q.d === 5)).toMatchObject({ w: 900, real: true })
    expect(all.pts.find((q) => q.d === 5)!.date).toContain('2026-01-10')
    // Once a line has real efforts, FTP estimates drop out of it.
    expect(all.pts.find((q) => q.d === 3600)).toBeUndefined()
    expect(all.pts.every((q) => q.real)).toBe(true)
    expect(d90.pts.find((q) => q.d === 5)).toMatchObject({ w: 800 })
    expect(d90.pts.find((q) => q.d === 5)!.date).toContain('2026-05-20')
    expect(last.pts.map((q) => q.d)).toEqual([5, 60])
    expect(last.pts[0].w).toBe(700)
  })
  it('has an empty last-ride line for a new rider', () => {
    expect(curveLines(newProfile('b'), NOW)[2].pts).toEqual([])
  })
  it('shows the FTP estimate to a rider with no efforts yet', () => {
    const [all] = curveLines(newProfile('b'), NOW)
    expect(all.pts.length).toBeGreaterThan(5)
    expect(all.pts.every((q) => !q.real && q.date === null)).toBe(true)
  })
  it('log axis and snapping', () => {
    expect(xFrac(1)).toBe(0)
    expect(xFrac(3600)).toBe(1)
    expect(nearestDur(0)).toBe(1)
    expect(nearestDur(1)).toBe(3600)
    expect(nearestDur(xFrac(280))).toBe(300)
  })
  it('labels and units', () => {
    expect(fmtDur(45)).toBe('45 s')
    expect(fmtDur(1200)).toBe('20 min')
    expect(fmtDur(3600)).toBe('1 h')
    expect(yValue(300, 75)).toBe(4)
    expect(yValue(300)).toBe(300)
    const lines = curveLines(p, NOW)
    expect(yTop(lines) % 100).toBe(0)
    expect(yTop(lines, 75)).toBeLessThan(yTop(lines))
  })
})
