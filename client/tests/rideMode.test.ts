import { describe, expect, it } from 'vitest'
import { ErgController } from '../src/trainer/ergController'
import { resistancePower, SimTrainer, slopePower } from '../src/trainer/simTrainer'
import { stepMode } from '../src/ui/soloMode'

const setup = () => {
  let t = 0
  const sim = new SimTrainer(undefined, () => 0.5)
  const erg = new ErgController(sim, 200, () => t)
  return {
    sim,
    erg,
    run: async (n = 4) => {
      for (let i = 0; i < n; i++) {
        t += 0.5
        await erg.tick()
      }
    },
  }
}
const ergWrites = (s: SimTrainer) => s.log.filter((l) => l.startsWith('erg'))

describe('ride modes', () => {
  it('switches ERG to resistance, slope and back with the right commands', async () => {
    const { sim, erg, run } = setup()
    erg.setTarget(180)
    await run()
    expect(ergWrites(sim).length).toBeGreaterThan(0)
    sim.log.length = 0
    erg.setResistance(40)
    erg.setTarget(220)
    await run()
    erg.setGrade(3)
    await run()
    expect(sim.log).toEqual(['res 40', 'sim 3'])
    erg.setErg()
    await run()
    expect(sim.log.at(-1)).toMatch(/^erg 220/)
    expect(sim.log).toContain('control')
  })
  it('never sends ERG power while off ERG, even when the target changes or the link returns', async () => {
    const { sim, erg, run } = setup()
    erg.setGrade(5)
    for (const w of [100, 250, null, 400]) {
      erg.setTarget(w)
      await run()
    }
    erg.setAway(true)
    erg.setAway(false)
    await run()
    expect(ergWrites(sim)).toEqual([])
    expect(sim.log).toEqual(['sim 5', 'sim 5'])
  })
  it('rewrites only when the level changes, and clamps it', async () => {
    const { sim, erg, run } = setup()
    erg.setResistance(30)
    await run(6)
    erg.setResistance(150)
    await run()
    erg.setGrade(99)
    await run()
    erg.setGrade(-20)
    await run()
    expect(sim.log).toEqual(['res 30', 'res 100', 'sim 15', 'sim -5'])
  })
  it('steps the level and gradient within range', () => {
    const m = { kind: 'res' as const, level: 98, grade: 0, gear: 12 }
    expect(stepMode(m, 1).level).toBe(100)
    expect(stepMode({ ...m, kind: 'slope', grade: -5 }, -1).grade).toBe(-5)
    expect(stepMode({ ...m, kind: 'erg' }, 1)).toEqual({ ...m, kind: 'erg' })
  })
})

describe('simulated physics', () => {
  it('power rises with cadence and with gradient, and is zero when coasting downhill', () => {
    expect(slopePower(4, 95)).toBeGreaterThan(slopePower(4, 80))
    expect(slopePower(6, 85)).toBeGreaterThan(slopePower(2, 85))
    expect(slopePower(-5, 60)).toBe(0)
    expect(resistancePower(50, 90)).toBeCloseTo(150)
    expect(resistancePower(50, 60)).toBeLessThan(resistancePower(50, 90))
  })
  it('the sim trainer turns cadence into power in each mode', async () => {
    const sim = new SimTrainer(undefined, () => 0.5)
    let p = 0
    sim.onData((d) => (p = d.power))
    await sim.setResistance(60)
    sim.cadence = 90
    sim.step(0.25)
    const lo = p
    sim.cadence = 100
    sim.step(0.25)
    expect(p).toBeGreaterThan(lo)
    await sim.setSim(8)
    sim.step(0.25)
    expect(p).toBeCloseTo(slopePower(8, 100), -1)
  })
})
