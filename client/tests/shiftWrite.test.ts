import { describe, expect, it } from 'vitest'
import { ErgController } from '../src/trainer/ergController'
import { SimTrainer } from '../src/trainer/simTrainer'

/** A trainer whose writes take `ms` to finish and that records any overlap. */
class SlowTrainer extends SimTrainer {
  inFlight = 0
  overlap = false
  constructor(private ms: number) {
    super()
  }
  private async slow<T>(f: () => Promise<T>) {
    if (this.inFlight++) this.overlap = true
    await new Promise((r) => setTimeout(r, this.ms))
    try {
      return await f()
    } finally {
      this.inFlight--
    }
  }
  setSim(g: number) {
    return this.slow(() => super.setSim(g))
  }
  setPower(w: number) {
    return this.slow(() => super.setPower(w))
  }
}

describe('shifts go out at once', () => {
  it('a shift writes its gradient without waiting for the next tick', async () => {
    const sim = new SimTrainer()
    const erg = new ErgController(sim, 200)
    await erg.setGrade(1.5, undefined, true)
    expect(sim.log).toEqual(['sim 1.5'])
    await erg.setGrade(2.3, undefined, true)
    expect(sim.log).toEqual(['sim 1.5', 'sim 2.3'])
  })

  it('a gradient that is not a shift still waits for the tick', async () => {
    const sim = new SimTrainer()
    const erg = new ErgController(sim, 200)
    await erg.setGrade(1.5)
    expect(sim.log).toEqual([])
    await erg.tick()
    expect(sim.log).toEqual(['sim 1.5'])
  })

  it('a shift during a tick waits for it, then sends the newest gradient once', async () => {
    const sim = new SlowTrainer(20)
    const erg = new ErgController(sim, 200)
    void erg.setGrade(1)
    const tick = erg.tick()
    const a = erg.setGrade(2, undefined, true)
    const b = erg.setGrade(3, undefined, true)
    await Promise.all([tick, a, b])
    expect(sim.overlap).toBe(false)
    expect(sim.log).toEqual(['sim 1', 'sim 3'])
  })
})
