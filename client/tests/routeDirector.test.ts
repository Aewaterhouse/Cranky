import { describe, expect, it } from 'vitest'
import { VIS } from '../src/scene/params'
import { fillGaps, planRoadLife } from '../src/scene/route/director'
import { FUN } from '../src/scene/route/funVis'
import { LifePlan } from '../src/scene/route/lifePlan'
import { Oddities } from '../src/scene/route/oddPlan'
import { rng } from '../src/scene/route/scatter'
import { funWorld } from './funWorld'

const D = FUN.life.director
const gapsOf = (ds: number[], length: number) => {
  const at = [0, ...[...ds].sort((a, b) => a - b), length]
  return at.slice(1).map((d, i) => d - at[i])
}

describe('the road-life director', () => {
  it('fills every gap longer than the most allowed, and only those', () => {
    for (let s = 1; s < 40; s++) {
      const rand = rng(s)
      const length = 2000 + rand() * 30000
      const marks = Array.from({ length: Math.floor(rand() * 60) }, () => rand() * length)
      const fill = fillGaps(marks, length, 350, rand)
      expect(Math.max(...gapsOf([...marks, ...fill], length))).toBeLessThanOrEqual(350)
      // Each filler sits in a gap that needed it: never closer than a third of the limit to anything.
      for (const f of fill) for (const m of marks) expect(Math.abs(f - m)).toBeGreaterThan(350 / 3)
    }
    expect(fillGaps([300, 600, 900], 1000, 350, Math.random)).toEqual([])
    expect(fillGaps([], 1000, 350, () => 0.5)).toEqual([250, 500, 750])
  })

  it('leaves no stretch of a real-looking road empty for longer than the limit', () => {
    const w = funWorld(30, 100, (_, n) => (n > 12000 && n < 20000 ? 'f' : 'g'))
    const odd = new Oddities('d', w.field, w.cover, w.features)
    const life = new LifePlan('d', w.field, w.cover, w.features)
    const { signs, chalk } = planRoadLife(
      'd',
      w.field,
      w.cover,
      w.features,
      [],
      odd,
      life,
      new Map(),
    )
    const marks = [...signs.values(), ...chalk.values()].flat().map((t) => t.d)
    for (let k = 0; k * VIS.route.chunk < w.path.length; k++)
      for (const o of [...odd.chunk(k), ...life.chunk(k)]) if (o.rank < D.shown) marks.push(o.d)
    // Forced traffic is started further on so it meets the rider at the filler spot.
    const meet = (FUN.life.trafficSee * FUN.life.trafficMs) / (D.speed + FUN.life.trafficMs)
    marks.push(...life.traffic.map((d) => d - meet))
    expect(life.traffic.length).toBeGreaterThan(0)
    expect(Math.max(...gapsOf(marks, w.path.length))).toBeLessThanOrEqual(D.speed * D.maxS + 1)
    // The same for everyone on the route.
    const again = new LifePlan('d', w.field, w.cover, w.features)
    planRoadLife('d', w.field, w.cover, w.features, [], odd, again, new Map())
    expect(again.traffic).toEqual(life.traffic)
  })
})
