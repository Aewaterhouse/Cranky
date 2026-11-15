import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { totalMass } from '../src/core/physics'
import type { Route } from '../src/core/route'
import { FinishEstimate, powerShare, remainingS } from '../src/modes/freeRide/eta'

const mass = totalMass(75)

/** A 10 km route at 10 m spacing whose gradient (%) at each metre is `grade(d)`. */
function route(grade: (d: number) => number): Route {
  let ele = 100
  const points = Array.from({ length: 1001 }, (_, i) => {
    const p = { d: i * 10, ele, grade: grade(i * 10) }
    ele += (p.grade / 100) * 10
    return p
  })
  return { id: 't', name: 't', points, distance: 10000, ascent: 0 }
}
const flat = route(() => 0)
const climb = route((d) => (d >= 5000 ? 6 : 0))
const descent = route((d) => (d >= 5000 ? -6 : 0))

describe('time to the finish through the elevation profile', () => {
  it('rides a flat route at the steady speed for the power', () => {
    const t = remainingS(flat, 0, 200, mass, 0.5)
    expect(10000 / t).toBeGreaterThan(8.5)
    expect(10000 / t).toBeLessThan(10)
  })
  it('adds time for a climb ahead and takes it off for a descent', () => {
    const f = remainingS(flat, 0, 200, mass, 0.5)
    expect(remainingS(climb, 0, 200, mass, 0.5)).toBeGreaterThan(f * 1.5)
    expect(remainingS(descent, 0, 200, mass, 0.5)).toBeLessThan(f * 0.85)
  })
  it('counts only the road left', () => {
    expect(remainingS(climb, 5000, 200, mass, 0.5)).toBeCloseTo(
      remainingS(climb, 0, 200, mass, 0.5) - remainingS(flat, 5000, 200, mass, 0.5),
      0,
    )
    expect(remainingS(flat, 10000, 200, mass, 0.5)).toBe(0)
  })
  it('is quicker with more power and in a draft', () => {
    expect(remainingS(flat, 0, 300, mass, 0.5)).toBeLessThan(remainingS(flat, 0, 200, mass, 0.5))
    expect(remainingS(flat, 0, 200, mass, 0.5, 0.7)).toBeLessThan(
      remainingS(flat, 0, 200, mass, 0.5),
    )
  })
  it('expects more push up a climb at a higher difficulty', () => {
    expect(powerShare(0, 1)).toBe(1)
    expect(powerShare(8, 1)).toBeGreaterThan(powerShare(8, 0.5))
    expect(powerShare(-8, 1)).toBeLessThan(1)
    expect(powerShare(-50, 3)).toBe(CFG.freeRide.eta.minShare)
  })
})

describe('the Finish in number', () => {
  it('counts down smoothly while the power wobbles', () => {
    const e = new FinishEstimate(flat, mass, 150)
    const power: number[] = []
    let d = 0
    let last = Infinity
    const left: number[] = []
    for (let s = 1; s <= 300; s++) {
      power.push(s % 20 < 10 ? 300 : 100)
      d += 9
      const v = e.update(s, d, power, 0.5, 1, s)
      if (s > 60) {
        expect(v).toBeLessThan(last + 0.5)
        expect(Math.abs(v - last)).toBeLessThan(4)
      }
      last = v
      left.push(v)
    }
    expect(left[299]).toBeGreaterThan(0)
  })
  it('starts from the FTP guess and moves to the measured power', () => {
    const slow = new FinishEstimate(flat, mass, 100)
    const first = slow.update(0, 0, [], 0.5, 1, 0)
    expect(first).toBeCloseTo(remainingS(flat, 0, 100, mass, 0.5), 0)
    const power: number[] = []
    let v = first
    for (let s = 1; s <= 200; s++) {
      power.push(300)
      v = slow.update(s, s * 10, power, 0.5, 1, s)
    }
    expect(v).toBeLessThan(remainingS(flat, 2000, 200, mass, 0.5))
  })
  it('sees a climb coming even when the road so far was flat', () => {
    const power = Array.from({ length: 120 }, () => 200)
    const up = new FinishEstimate(climb, mass, 200).update(120, 1000, power, 0.5, 1, 0)
    const level = new FinishEstimate(flat, mass, 200).update(120, 1000, power, 0.5, 1, 0)
    expect(up).toBeGreaterThan(level * 1.5)
  })
})
