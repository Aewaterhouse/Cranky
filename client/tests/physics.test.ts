import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import {
  cornerSpeed,
  headwind,
  leadM,
  resistance,
  speedLimit,
  stepSpeed,
  steadySpeed,
  totalMass,
  trainerGrade,
} from '../src/core/physics'

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

describe('the feel: momentum, bends and wind', () => {
  const K = CFG.freeRide.corner
  it('carries speed out of a dip and up the other side', () => {
    let v = steadySpeed(150, 0, M)
    for (let i = 0; i < 20; i++) v = stepSpeed(v, 150, -6, M, 1)
    const bottom = v
    for (let i = 0; i < 8; i++) v = stepSpeed(v, 150, 6, M, 1)
    expect(bottom).toBeGreaterThan(steadySpeed(150, 0, M) + 3)
    expect(v).toBeGreaterThan(steadySpeed(150, 6, M) + 1)
    expect(v).toBeLessThan(bottom)
  })
  it('a bend has a speed from its radius: fast through sweepers, sensible round a hairpin, never a stop', () => {
    expect(cornerSpeed(0)).toBe(CFG.freeRide.maxMs)
    expect(cornerSpeed(1 / 200)).toBe(CFG.freeRide.maxMs)
    expect(cornerSpeed(1 / 30)).toBeCloseTo(Math.sqrt(K.latMs2 * 30))
    expect(cornerSpeed(-1 / 30)).toBe(cornerSpeed(1 / 30))
    expect(kmh(cornerSpeed(1 / 8))).toBeGreaterThan(19)
    expect(kmh(cornerSpeed(1 / 8))).toBeLessThan(30)
    expect(cornerSpeed(1 / 2)).toBe(K.minMs)
  })
  it('the limit eases down towards a hairpin and is the bend speed in it', () => {
    const hairpinAt = (at: number) => (s: number) => (s >= at && s < at + 30 ? 1 / 8 : 0)
    const far = speedLimit(20, hairpinAt(300))
    const mid = speedLimit(20, hairpinAt(40))
    const near = speedLimit(20, hairpinAt(10))
    expect(far).toBe(CFG.freeRide.maxMs)
    expect(mid).toBeLessThan(far)
    expect(near).toBeLessThan(mid)
    expect(speedLimit(20, hairpinAt(0))).toBeCloseTo(cornerSpeed(1 / 8))
    expect(speedLimit(20, () => 0)).toBe(CFG.freeRide.maxMs)
  })
  it('a coasting descent into a hairpin is slowed gently, in time, and never stopped', () => {
    // 20 m/s down 8% with a hairpin 150 m on: ride it at the app's 200 ms tick.
    let v = 20
    let d = 0
    let hardest = 0
    let atBend = 0
    const curv = (x: number) => (x >= 150 && x < 180 ? 1 / 8 : 0)
    while (d < 200) {
      const was = v
      v = stepSpeed(
        v,
        0,
        -8,
        M,
        0.2,
        0,
        speedLimit(v, (s) => curv(d + s)),
      )
      hardest = Math.max(hardest, (was - v) / 0.2)
      d += v * 0.2
      if (d >= 150 && !atBend) atBend = v
    }
    expect(atBend).toBeLessThanOrEqual(cornerSpeed(1 / 8) + 0.6)
    expect(atBend).toBeGreaterThanOrEqual(K.minMs)
    expect(hardest).toBeLessThanOrEqual(K.maxBrakeMs2 + 1e-6)
    // Out of the bend it runs away again.
    expect(v).toBeGreaterThan(atBend)
  })
  it('leaves a rider under the limit alone', () => {
    expect(stepSpeed(8, 200, 0, M, 1, 0, 15)).toBe(stepSpeed(8, 200, 0, M, 1))
  })
  it('a headwind slows, a tailwind helps, and no wind changes nothing', () => {
    const still = steadySpeed(200, 0, M)
    let head = still
    let tail = still
    for (let i = 0; i < 300; i++) {
      head = stepSpeed(head, 200, 0, M, 1, 4)
      tail = stepSpeed(tail, 200, 0, M, 1, -4)
    }
    expect(head).toBeLessThan(still - 1)
    expect(tail).toBeGreaterThan(still + 1)
    expect(resistance(10, 2, M, 0)).toBe(resistance(10, 2, M))
  })
  it('works out the headwind from where the wind blows and where the rider points', () => {
    expect(headwind(5, 0, 0, -1)).toBeCloseTo(5)
    expect(headwind(5, 0, 0, 1)).toBeCloseTo(-5)
    expect(headwind(5, 0, 1, 0)).toBeCloseTo(0)
    expect(headwind(5, Math.PI / 2, 1, 0)).toBeCloseTo(5)
  })
  it('reads the trainer gradient a second or two up the road, within bounds', () => {
    const L = CFG.freeRide.lead
    expect(leadM(0)).toBe(0)
    expect(leadM(-3)).toBe(0)
    expect(leadM(8)).toBeCloseTo(8 * L.s)
    expect(leadM(100)).toBe(L.maxM)
    expect(L.s).toBeGreaterThanOrEqual(1)
    expect(L.s).toBeLessThanOrEqual(2)
  })
})
