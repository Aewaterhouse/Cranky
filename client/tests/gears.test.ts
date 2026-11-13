import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { gearCount, gearGrade, gearOffset, shiftGear } from '../src/core/gears'
import { totalMass } from '../src/core/physics'

const mass = totalMass(75)
const range = CFG.freeRide.grade
// A chainring that makes the physical ratio exactly gear 12's (2.40 × 14T).
const matched = 2.4 * CFG.gears.cogTeeth

describe('virtual gears', () => {
  it('has 24 gears from 0.75 to 5.49 and starts in the middle', () => {
    expect(gearCount).toBe(24)
    expect(CFG.gears.ratios[0]).toBe(0.75)
    expect(CFG.gears.ratios[23]).toBe(5.49)
    expect(CFG.gears.start).toBe(12)
  })
  it('sends the road gradient when the virtual gear matches the real one', () => {
    expect(gearGrade(0, 90, 12, mass, range, matched)).toBe(0)
    expect(gearGrade(5, 90, 12, mass, range, matched)).toBe(5)
  })
  it('on the flat, a harder gear raises the gradient and an easier one lowers it', () => {
    expect(gearGrade(0, 90, 18, mass, range, matched)).toBeGreaterThan(1)
    expect(gearGrade(0, 90, 6, mass, range, matched)).toBeLessThan(0)
  })
  it('on a climb, easier gears ease the trainer and harder ones stiffen it', () => {
    const easy = gearGrade(6, 80, 4, mass, range, matched)
    const hard = gearGrade(6, 80, 16, mass, range, matched)
    expect(easy).toBeLessThan(6)
    expect(hard).toBeGreaterThan(6)
  })
  it('sends the road gradient when the rider is barely pedalling', () => {
    expect(gearGrade(4, 10, 24, mass, range)).toBe(4)
    expect(gearGrade(4, 0, 1, mass, range)).toBe(4)
  })
  it('clamps to the mode range', () => {
    expect(gearGrade(10, 90, 24, mass, range)).toBe(range[1])
    expect(gearGrade(-15, 5, 12, mass, range)).toBe(range[0])
    expect(gearGrade(30, 0, 12, mass, CFG.ride.grade)).toBe(CFG.ride.grade[1])
  })
  it('at difficulty 100% and strength 100% matches the original gear model', () => {
    // Outputs of the first gear model (commit 2771bc2), default 34T chainring, free-ride range.
    const before: [number, number, number, number][] = [
      [0, 90, 12, -0.1],
      [0, 90, 18, 3.9],
      [0, 90, 6, -1.3],
      [6, 80, 4, 1.5],
      [6, 80, 16, 9.7],
      [3, 95, 20, 12.3],
      [-3, 85, 8, -3],
      [8, 70, 2, 1.8],
    ]
    for (const [road, cad, gear, want] of before)
      expect(gearGrade(road, cad, gear, mass, range, 34, 1, 1)).toBe(want)
  })
  it('the gear offset does not depend on difficulty', () => {
    const at = (d: number) => gearGrade(4, 90, 18, mass, range, 34, d) - 4 * d
    expect(at(0.5)).toBeCloseTo(at(1), 1)
    expect(at(1)).toBeCloseTo(gearOffset(4, 90, 18, mass, 34), 1)
  })
  it('strength 200% doubles the offset', () => {
    const off = gearOffset(0, 90, 16, mass, 34)
    expect(gearGrade(0, 90, 16, mass, range, 34, 1, 2)).toBeCloseTo(2 * off, 1)
    expect(gearGrade(2, 90, 8, mass, range, 34, 0.5, 2)).toBeCloseTo(
      1 + 2 * gearOffset(2, 90, 8, mass, 34),
      1,
    )
  })
  it('clamps with difficulty and strength too', () => {
    expect(gearGrade(10, 90, 24, mass, range, 34, 0.5, 3)).toBe(range[1])
    expect(gearGrade(-1, 110, 1, mass, CFG.ride.grade, 34, 1, 3)).toBe(CFG.ride.grade[0])
  })
  it('near-zero cadence sends road × difficulty', () => {
    expect(gearOffset(6, 10, 24, mass)).toBe(0)
    expect(gearGrade(6, 10, 24, mass, range, 34, 0.5, 3)).toBe(3)
    expect(gearGrade(-4, 0, 1, mass, range, 34, 0.25, 2)).toBe(-1)
  })
  it('stops at the top and bottom gear', () => {
    expect(shiftGear(24, 1)).toBe(24)
    expect(shiftGear(1, -1)).toBe(1)
    expect(shiftGear(12, 1)).toBe(13)
    expect(shiftGear(12, -1)).toBe(11)
  })
})
