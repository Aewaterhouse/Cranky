import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { cadenceSmoother, gearGrade } from '../src/core/gears'
import { totalMass } from '../src/core/physics'

const mass = totalMass(75)
const range = CFG.ride.grade
const clocked = () => {
  let t = 0
  return {
    smooth: cadenceSmoother(CFG.gears.cadenceSmoothS, () => t),
    adv: (s: number) => (t += s),
  }
}

describe('steady gears', () => {
  it('holds the gradient still while cadence wobbles around a steady value', () => {
    const { smooth, adv } = clocked()
    smooth(90)
    const grades = new Set<number>()
    for (let i = 0; i < 40; i++) {
      adv(0.25)
      const c = smooth(i % 2 ? 93 : 87)
      grades.add(gearGrade(0, c, 18, mass, range))
    }
    const raw = [87, 93].map((c) => gearGrade(0, c, 18, mass, range))
    expect(Math.max(...grades) - Math.min(...grades)).toBeLessThan(Math.abs(raw[1] - raw[0]) / 2)
  })

  it('a shift moves the gradient by the whole gear straight away', () => {
    const { smooth, adv } = clocked()
    smooth(90)
    adv(1)
    const c = smooth(90)
    const before = gearGrade(0, c, 12, mass, range)
    const after = gearGrade(0, smooth(90), 18, mass, range)
    expect(after).toBe(gearGrade(0, 90, 18, mass, range))
    expect(after).toBeGreaterThan(before)
  })

  it('follows a real change in cadence within a few seconds', () => {
    const { smooth, adv } = clocked()
    smooth(70)
    adv(CFG.gears.cadenceSmoothS)
    expect(smooth(100)).toBeGreaterThan(85)
    adv(CFG.gears.cadenceSmoothS * 3)
    expect(smooth(100)).toBeGreaterThan(99)
  })

  it('starting and stopping pedalling go through at once', () => {
    const { smooth, adv } = clocked()
    expect(smooth(0)).toBe(0)
    adv(0.1)
    expect(smooth(85)).toBe(85)
    adv(0.1)
    expect(smooth(0)).toBe(0)
  })
})
