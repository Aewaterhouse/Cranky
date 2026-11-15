import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { gearGrade, gearSpeed } from '../src/core/gears'
import { stepSpeed, totalMass } from '../src/core/physics'
import { PullAway } from '../src/modes/freeRide/feel'
import { PauseState } from '../src/modes/freeRide/pauseState'

const F = CFG.freeRide
const PA = F.pullAway
const G = CFG.gears
const mass = totalMass(75)

/**
 * A rider pulling away on a flat road from a standstill, spinning up to 85 rpm in gear 12, with a trainer in sim
 * mode: its flywheel follows the cadence, and the power is what its resistance costs at that speed (never more
 * than `maxW`, what the rider has). Returns the game speed each 0.2 s tick and the metres ridden.
 */
function pullAway(withPush: boolean, maxW = 600, road = 0) {
  const pause = new PauseState()
  const push = new PullAway()
  const out: { t: number; v: number; d: number; grade: number }[] = []
  let v = 0
  let d = 0
  let grade = road
  for (let t = 0.2; t <= 120; t += 0.2) {
    const cad = Math.min(85, t * 40)
    const fly = (cad / 60) * G.wheelM * (G.chainring / G.cogTeeth)
    const th = Math.atan(grade / 100)
    const force =
      mass * 9.81 * (Math.sin(th) + F.crr * Math.cos(th)) + 0.5 * F.rho * F.cda * fly ** 2
    const power = Math.min(maxW, Math.max(0, force * fly))
    pause.step(power === 0 || cad === 0, v, 0.2)
    if (!pause.paused) v = stepSpeed(v, power, road, mass, 0.2)
    d += v * 0.2
    const extra = withPush ? push.step(v, cad, 12, 0.2) : 0
    grade = Math.min(F.grade[1], gearGrade(road, cad, 12, mass, F.grade) + extra)
    out.push({ t, v, d, grade })
  }
  return out
}
const reach = (run: ReturnType<typeof pullAway>, ms: number) => run.find((r) => r.v >= ms)!

describe('pulling away from a standstill', () => {
  const cruise = gearSpeed(85, 12)
  it('gets up to the speed of the gear within a few seconds and a few dozen metres', () => {
    const run = pullAway(true)
    expect(reach(run, 20 / 3.6).t).toBeLessThan(6)
    expect(reach(run, cruise * 0.8).t).toBeLessThan(7)
    expect(reach(run, cruise * 0.8).d).toBeLessThan(40)
  })
  it('took hundreds of metres without the push (the cause: cruising resistance from the first stroke)', () => {
    const old = reach(pullAway(false), cruise * 0.9)
    expect(old.d).toBeGreaterThan(140)
    expect(old.d).toBeGreaterThan(reach(pullAway(true), cruise * 0.9).d * 2)
  })
  it('rises smoothly: never slower than the tick before, no jumps', () => {
    const run = pullAway(true)
    for (let i = 1; i < run.length; i++) {
      expect(run[i].v).toBeGreaterThanOrEqual(run[i - 1].v - 1e-9)
      expect(run[i].v - run[i - 1].v).toBeLessThan(1.2)
    }
  })
  it('starts moving on the first pedal strokes, not after a wait', () => {
    expect(pullAway(true)[1].v).toBeGreaterThan(0)
  })
  it('feels heavy on the first strokes and eases to the plain road as the bike gets going', () => {
    const run = pullAway(true)
    expect(Math.max(...run.slice(0, 10).map((r) => r.grade))).toBeGreaterThan(3)
    const plain = gearGrade(0, 85, 12, mass, F.grade)
    expect(run.find((r) => r.t > PA.fadeS + 0.5)!.grade).toBeCloseTo(plain, 1)
  })
  it('adds nothing with the cranks still, once rolling at the gear, or after the fade', () => {
    const p = new PullAway()
    expect(p.step(0, 0, 12, 0.2)).toBe(0)
    expect(p.step(0, 10, 12, 0.2)).toBe(0)
    expect(p.step(0, 85, 12, 0.2)).toBeGreaterThan(PA.maxPct * 0.9)
    expect(p.step(cruise + 1, 85, 12, 0.2)).toBe(0)
    for (let i = 0; i < 60; i++) p.step(1, 85, 12, 0.2)
    expect(p.step(1, 85, 12, 0.2)).toBe(0)
    // Coasting to a stop starts it again.
    p.step(0.5, 0, 12, 0.2)
    expect(p.step(0.5, 85, 12, 0.2)).toBeGreaterThan(0)
  })
  it('is gentler in an easy gear', () => {
    const hard = new PullAway().step(4, 85, 20, 0.2)
    const easy = new PullAway().step(4, 85, 3, 0.2)
    expect(easy).toBeLessThan(hard)
  })
})
