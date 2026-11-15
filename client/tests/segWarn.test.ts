import { describe, expect, it } from 'vitest'
import type { Route } from '../src/core/route'
import { withLaps } from '../src/core/route'
import { rideMarks, SegWarnings, type Mark } from '../src/core/segWarn'
import { WARN } from '../src/scene/route/warnVis'

const sprint: Mark = { kind: 'sprint', name: 'Town sprint', start: 3000, end: 3300, avgPct: 0.4 }
const kom: Mark = { kind: 'climb', name: 'The Wall climb', start: 6000, end: 7200, avgPct: 6.5 }

/** Rides from `from` to `to` at `ms` (0.2 s ticks), collecting each banner and countdown number. */
function ride(w: SegWarnings, from: number, to: number, ms: number) {
  const banners: [string, number, number][] = []
  const counts: [number, number][] = []
  let last: number | null = null
  for (let d = from; d <= to; d += ms * 0.2) {
    const r = w.step(d, ms)
    if (r.banner) banners.push([r.banner.mark.name, r.banner.stage, Math.round(d)])
    if (r.count !== null && r.count !== last) counts.push([r.count, r.next!.start - d])
    last = r.count
  }
  return { banners, counts }
}

describe('sprint and KOM heads-up', () => {
  it('warns at 1 km, 500 m and 200 m before each, once each', () => {
    const { banners } = ride(new SegWarnings([sprint, kom]), 0, 8000, 10)
    expect(WARN.stagesM).toEqual([1000, 500, 200])
    expect(banners.map(([n, s]) => `${n} ${s}`)).toEqual([
      'Town sprint 1000',
      'Town sprint 500',
      'Town sprint 200',
      'The Wall climb 1000',
      'The Wall climb 500',
      'The Wall climb 200',
    ])
    for (const [name, stage, at] of banners) {
      const start = name === sprint.name ? sprint.start : kom.start
      expect(start - at).toBeLessThanOrEqual(stage)
      expect(start - at).toBeGreaterThan(stage - 3)
    }
  })
  it('counts 3, 2, 1 to the line, by time at the current speed', () => {
    for (const ms of [5, 10, 16]) {
      const { counts } = ride(new SegWarnings([sprint]), 2000, 3100, ms)
      expect(counts.map(([n]) => n)).toEqual([3, 2, 1])
      for (const [n, left] of counts) {
        expect(left / ms).toBeLessThanOrEqual(n)
        expect(left / ms).toBeGreaterThan(n - 1 - 0.21)
      }
    }
  })
  it('does not count down standing still, and stops past the line', () => {
    const w = new SegWarnings([sprint])
    expect(w.step(2995, 0).count).toBeNull()
    expect(w.step(3001, 10)).toMatchObject({ banner: null, count: null })
  })
  it('joining inside 500 m gives only the nearer banners', () => {
    const { banners } = ride(new SegWarnings([sprint]), 2600, 3100, 10)
    expect(banners.map(([, s]) => s)).toEqual([500, 200])
  })
})

describe('the marks of a ride', () => {
  /** 6 km: flat, then a 1.5 km climb at 6%, then flat. */
  const flatThenClimb: Route = (() => {
    let ele = 50
    const points = Array.from({ length: 601 }, (_, i) => {
      const d = i * 10
      const grade = d >= 2000 && d < 3500 ? 6 : 0
      const p = { d, ele, grade }
      ele += grade / 10
      return p
    })
    return { id: 'm', name: 'Test', points, distance: 6000, ascent: 90 }
  })()
  it('has the route climbs as KOMs with their gradient and a sprint, in order', () => {
    const marks = rideMarks(flatThenClimb)
    const climb = marks.find((m) => m.kind === 'climb')!
    expect(climb.avgPct).toBeGreaterThan(4)
    expect(marks.some((m) => m.kind === 'sprint')).toBe(true)
    expect(marks.map((m) => m.start)).toEqual([...marks.map((m) => m.start)].sort((a, b) => a - b))
  })
  it('repeats them on every lap of a lap ride', () => {
    const loop = { ...flatThenClimb, loop: true }
    const one = rideMarks(loop)
    const three = rideMarks(withLaps(loop, 3))
    expect(three).toHaveLength(one.length * 3)
    expect(three[one.length].start).toBeCloseTo(one[0].start + loop.distance, 0)
  })
})
