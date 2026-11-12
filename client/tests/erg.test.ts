import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { ErgController } from '../src/trainer/ergController'
import { SimTrainer } from '../src/trainer/simTrainer'

const setup = () => {
  let t = 0
  const sim = new SimTrainer()
  const erg = new ErgController(sim, 200, () => t)
  return { sim, erg, adv: (s: number) => (t += s) }
}
const ergWrites = (s: SimTrainer) =>
  s.log.filter((l) => l.startsWith('erg')).map((l) => +l.split(' ')[1])

describe('erg controller', () => {
  it('never exceeds 150% FTP', async () => {
    const { sim, erg, adv } = setup()
    erg.setTarget(10000)
    for (let i = 0; i < 20; i++) {
      adv(0.25)
      await erg.tick()
    }
    expect(Math.max(...ergWrites(sim))).toBe(300)
    erg.setTarget(250, 2)
    for (let i = 0; i < 20; i++) {
      adv(0.25)
      await erg.tick()
    }
    expect(Math.max(...ergWrites(sim))).toBe(300)
  })
  it('ramps over 2 s', async () => {
    const { sim, erg, adv } = setup()
    erg.setTarget(100)
    await erg.tick()
    erg.setTarget(200)
    adv(1)
    await erg.tick()
    expect(sim.erg).toBe(150)
    adv(1.5)
    await erg.tick()
    expect(sim.erg).toBe(200)
  })
  it('sprint (null target) never sends ERG and switches to sim mode', async () => {
    const { sim, erg, adv } = setup()
    erg.setTarget(180)
    await erg.tick()
    const before = sim.log.length
    erg.setTarget(null)
    for (let i = 0; i < 40; i++) {
      adv(0.25)
      await erg.tick()
    }
    const during = sim.log.slice(before)
    expect(during).toEqual(['sim 0'])
    expect(sim.erg).toBeNull()
  })
  it('fails safe to 50% FTP then releases after repeated failures', async () => {
    const { sim, erg, adv } = setup()
    sim.setPower = async (w) => {
      sim.log.push(`erg ${w}`)
      if (w !== 100) throw new Error('gone')
    }
    erg.setTarget(180)
    for (let i = 0; i < CFG.erg.maxFails - 1; i++) {
      adv(0.25)
      await erg.tick()
    }
    expect(sim.log).not.toContain('release')
    adv(0.25)
    await erg.tick()
    expect(sim.log.slice(-2)).toEqual(['erg 100', 'release'])
    const n = sim.log.length
    await erg.tick()
    expect(sim.log).toHaveLength(n)
  })
  it('retries a single failed write on the next tick', async () => {
    const { sim, erg, adv } = setup()
    const ok = sim.setPower.bind(sim)
    let fail = true
    sim.setPower = async (w) => (fail ? ((fail = false), Promise.reject(new Error('x'))) : ok(w))
    erg.setTarget(180)
    await erg.tick()
    expect(sim.erg).toBeNull()
    adv(0.25)
    await erg.tick()
    expect(sim.erg).toBeGreaterThan(0)
    expect(sim.log).not.toContain('release')
    for (let i = 0; i < 20; i++) {
      adv(0.25)
      await erg.tick()
    }
    expect(sim.erg).toBe(180)
  })
})
