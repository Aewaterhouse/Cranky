import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { freePlan } from '../src/modes/freeRide/freeRide'
import { RideRecorder } from '../src/core/ride'
import { buildRoute, routeSeconds } from '../src/core/route'
import { ErgController } from '../src/trainer/ergController'
import { SimTrainer } from '../src/trainer/simTrainer'

const hill = buildRoute('t', 'Test hill', [
  { d: 0, ele: 0 },
  { d: 5000, ele: 250 },
])

describe('free ride plumbing', () => {
  it('synthesises a one-block free plan named after the route', () => {
    const p = freePlan(hill, 250, 75)
    expect(p.name).toBe('Test hill')
    expect(p.blocks).toHaveLength(1)
    expect(p.blocks[0].type).toBe('free')
    expect(p.blocks[0].dur).toBeGreaterThan(600)
    expect(p.blocks[0].dur).toBe(Math.round(routeSeconds(hill, 250 * CFG.freeRide.ftpFrac, 75)))
  })

  it('a harder rider is faster up the same hill', () => {
    expect(routeSeconds(hill, 300)).toBeLessThan(routeSeconds(hill, 200))
  })

  it('the trainer gets fractional gradients inside the free-ride range, and never ERG', async () => {
    const sim = new SimTrainer()
    const erg = new ErgController(sim, 250, () => 0)
    erg.setGrade(3.46, CFG.freeRide.grade)
    await erg.tick()
    erg.setGrade(-12, CFG.freeRide.grade)
    await erg.tick()
    erg.setGrade(40, CFG.freeRide.grade)
    await erg.tick()
    expect(sim.log).toEqual(['sim 3.5', 'sim -10', 'sim 20'])
    expect(sim.log.some((l) => l.startsWith('erg'))).toBe(false)
  })

  it('records distance and ascent in the summary, with nothing scored', () => {
    const rec = new RideRecorder(freePlan(hill, 250), 250)
    for (let i = 0; i < 40; i++) rec.sample(0, 200, 85, null, null, false)
    rec.distance = 1200
    rec.ascent = 60
    const s = rec.summary()
    expect(s.distance).toBe(1200)
    expect(s.ascent).toBe(60)
    expect(s.compliance).toBe(0)
    expect(s.avgPower).toBe(200)
    expect(s.blocks[0].secs).toBe(40)
  })
})
