import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { RoadFeel, cheering, trainerTarget } from '../src/modes/freeRide/feel'
import { freePlan } from '../src/modes/freeRide/freeRide'
import { cornerSpeed, draftGrade, totalMass } from '../src/core/physics'
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

describe('free ride feel', () => {
  // Flat for a kilometre, then a 10% wall.
  const wall = buildRoute('w', 'Wall', [
    { d: 0, ele: 0 },
    { d: 1000, ele: 0 },
    { d: 2000, ele: 100 },
  ])
  const M = totalMass(75)
  const F = CFG.freeRide
  const target = (d: number, v: number, paused = false, diff = 1) =>
    trainerTarget(wall, d, v, diff, paused, 0, CFG.gears.start, M)

  it('drafting takes the drag it saves off the trainer gradient', () => {
    const v = 11
    const off = draftGrade(v, 0.7, M)
    expect(draftGrade(v, 1, M)).toBe(0)
    expect(off).toBeGreaterThan(0.3)
    expect(off).toBeLessThan(2)
    expect(draftGrade(v, 0.05, M)).toBeGreaterThan(off)
    const flat = trainerTarget(wall, 0, v, 1, false, 90, CFG.gears.start, M)
    expect(
      trainerTarget(wall, 0, v, 1, false, 90, CFG.gears.start, M, undefined, 1, off),
    ).toBeLessThan(flat)
  })

  it('the trainer gets the road a second or two ahead, so the wall arrives as the road tilts', () => {
    const before = wall.points.findIndex((p) => p.grade > 5) * F.spacingM - 12
    expect(target(before, 0)).toBeLessThan(target(before, 10))
    expect(target(before, 10)).toBeGreaterThan(5)
    expect(target(before - 300, 22)).toBeLessThan(1)
    expect(target(1700, 5)).toBeCloseTo(target(1700, 0), 0)
  })
  it('flat when paused, and never past the end of the route', () => {
    expect(target(1500, 5, true)).toBe(0)
    expect(Number.isFinite(target(wall.distance, 20))).toBe(true)
  })
  it('whatever the road and speed, the trainer only ever gets a gradient inside the range, never ERG', async () => {
    const cliff = buildRoute('c', 'Cliff', [
      { d: 0, ele: 0 },
      { d: 500, ele: 200 },
      { d: 1000, ele: 0 },
    ])
    const sim = new SimTrainer()
    const erg = new ErgController(sim, 250, () => 0)
    for (let d = 0; d <= 1000; d += 50)
      for (const [v, cad] of [
        [0, 0],
        [6, 80],
        [22, 110],
      ]) {
        const g = trainerTarget(cliff, d, v, 1, false, cad, 24, M)
        expect(g).toBeGreaterThanOrEqual(F.grade[0])
        expect(g).toBeLessThanOrEqual(F.grade[1])
        erg.setGrade(g * 3, F.grade)
        await erg.tick()
      }
    expect(sim.log.length).toBeGreaterThan(0)
    expect(sim.log.every((l) => l.startsWith('sim '))).toBe(true)
    for (const l of sim.log) {
      const pct = Number(l.slice(4))
      expect(pct).toBeGreaterThanOrEqual(F.grade[0])
      expect(pct).toBeLessThanOrEqual(F.grade[1])
    }
  })
  it('arms go up just over the top and coming to the line, not before', () => {
    expect(cheering(990, 5000, 1000)).toBe(false)
    expect(cheering(1010, 5000, 1000)).toBe(true)
    expect(cheering(1000 + F.cheer.summitM + 1, 5000, 1000)).toBe(false)
    expect(cheering(4990, 5000, undefined)).toBe(true)
    expect(cheering(2000, 5000, undefined)).toBe(false)
  })
  it('a straight road has no bend limit and no wind unless asked; wind turns with the road', () => {
    const feel = new RoadFeel(hill, 1)
    expect(feel.limit(100, 20)).toBe(F.maxMs)
    expect(feel.wind(100, 'off', undefined, 0)).toBe(0)
    // A lap of a ring about 100 m in radius: a headwind somewhere, a tailwind opposite, never more than the wind.
    const n = 63
    const ring = buildRoute(
      'ring',
      'Ring',
      Array.from({ length: n + 1 }, (_, i) => ({
        d: i * 10,
        ele: 0,
        lat: -27 + 0.0009 * Math.cos((i / n) * 2 * Math.PI),
        lon: 153 + 0.001 * Math.sin((i / n) * 2 * Math.PI),
      })),
    )
    const round = new RoadFeel(ring, 1)
    const w = Array.from({ length: 12 }, (_, i) => round.wind(40 + i * 50, 'breeze', undefined, 0))
    expect(Math.max(...w)).toBeGreaterThan(1.5)
    expect(Math.min(...w)).toBeLessThan(-1.5)
    expect(Math.max(...w.map(Math.abs))).toBeLessThanOrEqual(F.wind.ms.breeze + 1e-9)
    const mist = round.wind(40, 'breeze', 'routeMist', 0)
    expect(Math.abs(mist)).toBeCloseTo(Math.abs(w[0]) * F.wind.mood.routeMist)
    expect(round.limit(100, 20)).toBeLessThanOrEqual(F.maxMs)
    expect(round.limit(100, 20)).toBeGreaterThan(cornerSpeed(1 / 50))
  })
})
