import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { climbAt, findClimbs } from '../src/core/climbs'
import { gapText, gradeColour, powerZone, riderRows } from '../src/core/hud'
import { buildRoute } from '../src/core/route'

describe('power zones (Zwift boundaries)', () => {
  it.each([
    [0, 1],
    [0.59, 1],
    [0.6, 2],
    [0.759, 2],
    [0.76, 3],
    [0.9, 4],
    [1.049, 4],
    [1.05, 5],
    [1.189, 5],
    [1.19, 6],
    [3, 6],
  ])('%f of FTP is zone %i', (frac, zone) => expect(powerZone(frac)).toBe(zone))
})

describe('gradient colours', () => {
  it('gives every gradient a band and changes at the boundaries', () => {
    const b = CFG.hud.gradeBands
    expect(gradeColour(-20)).toBe(b[0].colour)
    expect(gradeColour(0)).toBe(b[1].colour)
    expect(gradeColour(2)).toBe(b[2].colour)
    expect(gradeColour(7.9)).toBe(b[3].colour)
    expect(gradeColour(40)).toBe(b[b.length - 1].colour)
  })
})

describe('climb detection', () => {
  /** A route from [length m, gradient %] legs. */
  const legs = (...l: [number, number][]) => {
    let d = 0
    let ele = 100
    const pts = [{ d, ele }]
    for (const [len, pct] of l) {
      for (let s = 10; s <= len; s += 10) pts.push({ d: d + s, ele: ele + (s * pct) / 100 })
      d += len
      ele += (len * pct) / 100
    }
    return buildRoute('t', 't', pts)
  }

  it('finds one sustained climb with its length and gain', () => {
    const c = findClimbs(legs([1000, 0], [1500, 6], [1000, 0]))
    expect(c).toHaveLength(1)
    expect(c[0].start).toBeGreaterThan(850)
    expect(c[0].start).toBeLessThan(1100)
    expect(c[0].end).toBeGreaterThan(2400)
    expect(c[0].end).toBeLessThan(2650)
    expect(c[0].gain).toBeGreaterThan(80)
    expect(c[0].gain).toBeLessThanOrEqual(90)
    expect(c[0].avg).toBeGreaterThanOrEqual(CFG.hud.climb.minPct)
  })

  it('ignores flats, descents, gentle drags and short ramps', () => {
    expect(findClimbs(legs([3000, 0]))).toHaveLength(0)
    expect(findClimbs(legs([500, 0], [2000, -6], [500, 0]))).toHaveLength(0)
    expect(findClimbs(legs([500, 0], [3000, 2], [500, 0]))).toHaveLength(0)
    expect(findClimbs(legs([1000, 0], [120, 8], [1000, 0]))).toHaveLength(0)
  })

  it('does not misfire on rolling terrain', () => {
    const rollers: [number, number][] = []
    for (let i = 0; i < 10; i++) rollers.push([150, 5], [250, -3])
    expect(findClimbs(legs(...rollers))).toHaveLength(0)
  })

  it('rides through a short dip but splits on a long flat', () => {
    expect(findClimbs(legs([500, 0], [800, 7], [40, 0], [800, 7], [500, 0]))).toHaveLength(1)
    expect(findClimbs(legs([500, 0], [800, 7], [600, 0], [800, 7], [500, 0]))).toHaveLength(2)
  })

  it('reports the climb you are on or about to start, and nothing past the top', () => {
    const climbs = findClimbs(legs([1000, 0], [1500, 6], [1000, 0]))
    const c = climbs[0]
    expect(climbAt(climbs, 200)).toBeUndefined()
    expect(climbAt(climbs, c.start - CFG.hud.climb.leadM + 1)).toBe(c)
    expect(climbAt(climbs, 1800)).toBe(c)
    expect(climbAt(climbs, c.end)).toBeUndefined()
  })
})

describe('gap formatting', () => {
  it('shows time at speed, with + ahead and - behind', () => {
    expect(gapText(120, 10)).toBe('+0:12')
    expect(gapText(-650, 10)).toBe('-1:05')
    expect(gapText(0, 8)).toBe('+0:00')
  })
  it('falls back to metres when stopped', () => {
    expect(gapText(84.4, 0)).toBe('+84 m')
    expect(gapText(-300, 0.2)).toBe('-300 m')
  })
})

describe('rider list', () => {
  const pack = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `Rider ${i}`, d: i * 100 }))

  it('is empty when alone or when I am not on the road', () => {
    expect(riderRows(pack(1), 'r0')).toEqual([])
    expect(riderRows(pack(3), 'nobody')).toEqual([])
  })

  it('orders furthest ahead first with gaps relative to me', () => {
    const rows = riderRows(pack(3), 'r1')
    expect(rows.map((r) => r.id)).toEqual(['r2', 'r1', 'r0'])
    expect(rows.map((r) => r.gapM)).toEqual([100, 0, -100])
    expect(rows.map((r) => r.me)).toEqual([false, true, false])
  })

  it('caps the rows and keeps me in the middle of a long bunch', () => {
    const n = CFG.hud.riders.rows
    const rows = riderRows(pack(30), 'r15')
    expect(rows).toHaveLength(n)
    expect(rows[Math.floor(n / 2)].me).toBe(true)
  })

  it('keeps me in view at the front and the back', () => {
    const n = CFG.hud.riders.rows
    const front = riderRows(pack(30), 'r29')
    expect(front).toHaveLength(n)
    expect(front[0].me).toBe(true)
    expect(riderRows(pack(30), 'r0')[n - 1].me).toBe(true)
  })

  it('truncates long names', () => {
    const rows = riderRows(
      [
        { id: 'a', name: 'Bartholomew the Third', d: 0 },
        { id: 'b', name: 'Al', d: 5 },
      ],
      'a',
    )
    expect(rows[1].name.length).toBe(CFG.hud.riders.nameChars)
    expect(rows[0].name).toBe('Al')
  })
})
