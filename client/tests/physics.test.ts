import { describe, expect, it } from 'vitest'
import { resistance, stepSpeed, steadySpeed, totalMass, trainerGrade } from '../src/core/physics'

const kmh = (v: number) => v * 3.6
const M = totalMass(75)

describe('ride physics', () => {
  it('uses the default rider weight and adds the bike', () => {
    expect(totalMass()).toBe(84)
    expect(totalMass(60)).toBe(69)
  })

  it('200 W on the flat is about 33 km/h', () => {
    const v = kmh(steadySpeed(200, 0, M))
    expect(v).toBeGreaterThan(31)
    expect(v).toBeLessThan(34.5)
  })

  it('250 W at 8% is about 12.5 km/h (84 kg total)', () => {
    const v = kmh(steadySpeed(250, 8, M))
    expect(v).toBeGreaterThan(11.5)
    expect(v).toBeLessThan(13.5)
  })

  it('more power is faster, a steeper road is slower, a heavier rider is slower uphill', () => {
    expect(steadySpeed(300, 0, M)).toBeGreaterThan(steadySpeed(200, 0, M))
    expect(steadySpeed(200, 5, M)).toBeLessThan(steadySpeed(200, 2, M))
    expect(steadySpeed(250, 8, totalMass(95))).toBeLessThan(steadySpeed(250, 8, totalMass(60)))
  })

  it('integration converges to the steady speed', () => {
    let v = 0
    for (let i = 0; i < 600; i++) v = stepSpeed(v, 200, 0, M, 1)
    expect(v).toBeCloseTo(steadySpeed(200, 0, M), 1)
  })

  it('energy balance: at steady speed, power times efficiency equals force times speed', () => {
    const v = steadySpeed(250, 8, M)
    expect(resistance(v, 8, M) * v).toBeCloseTo(250 * 0.975, 1)
  })

  it('an unpowered rider on a flat coasts to a stop, and does not roll back uphill', () => {
    let v = 10
    for (let i = 0; i < 600; i++) v = stepSpeed(v, 0, 0, M, 1)
    expect(v).toBeLessThan(0.5)
    expect(stepSpeed(0, 0, 10, M, 5)).toBe(0)
    expect(steadySpeed(0, 5, M)).toBe(0)
  })

  it('a descent with no pedalling accelerates to a sensible terminal speed', () => {
    let v = 0
    for (let i = 0; i < 300; i++) v = stepSpeed(v, 0, -8, M, 1)
    expect(kmh(v)).toBeGreaterThan(45)
    expect(kmh(v)).toBeLessThanOrEqual(80)
    expect(v).toBeCloseTo(steadySpeed(0, -8, M), 1)
  })

  it('speed is capped on a very steep descent', () => {
    expect(steadySpeed(0, -20, M)).toBeLessThanOrEqual(22)
    expect(stepSpeed(21.9, 400, -20, M, 5)).toBeLessThanOrEqual(22)
  })

  it('stepping is stable at one big dt and many small ones', () => {
    const a = stepSpeed(5, 250, 3, M, 1)
    let b = 5
    for (let i = 0; i < 10; i++) b = stepSpeed(b, 250, 3, M, 0.1)
    expect(a).toBeCloseTo(b, 1)
  })

  it('difficulty scales only the trainer grade, not the physics', () => {
    const before = steadySpeed(250, 8, M)
    expect(trainerGrade(8, 0.5)).toBe(4)
    expect(trainerGrade(8, 1)).toBe(8)
    expect(trainerGrade(8, 0)).toBe(0)
    expect(trainerGrade(30, 1)).toBe(20)
    expect(trainerGrade(-3, 0.5)).toBe(-1.5)
    expect(steadySpeed(250, 8, M)).toBe(before)
  })
})
