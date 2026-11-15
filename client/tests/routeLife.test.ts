import { describe, expect, it } from 'vitest'
import { VIS } from '../src/scene/params'
import { FUN } from '../src/scene/route/funVis'
import {
  LIFE_KINDS,
  LifePlan,
  TRAFFIC,
  crossAt,
  member,
  type Herd,
} from '../src/scene/route/lifePlan'
import { idleBird, newBird } from '../src/scene/route/birdMotion'
import { funWorld } from './funWorld'

const R = VIS.route
const L = FUN.life
const all = (p: LifePlan, km: number) =>
  Array.from({ length: (km * 1000) / R.chunk }, (_, k) => p.chunk(k)).flat()
const make = (id: string, w: ReturnType<typeof funWorld>) =>
  new LifePlan(id, w.field, w.cover, w.features)
const onRoad = (h: Herd) => h.kind === 'magpie' || TRAFFIC.includes(h.kind)

describe('wildlife and traffic along a road', () => {
  const farm = funWorld(20, 100, () => 'g')
  const herds = all(make('a', farm), 20)
  it('is the same for everyone on a route and different on another', () => {
    expect(
      all(
        make(
          'a',
          funWorld(20, 100, () => 'g'),
        ),
        20,
      ),
    ).toEqual(herds)
    expect(all(make('b', farm), 20)).not.toEqual(herds)
  })
  it('puts a mob or flock in about half the chunks, with the odd magpie and vehicle', () => {
    const mobs = herds.filter((h) => !onRoad(h))
    expect(mobs.length).toBeGreaterThan(100 * L.chance * 0.6)
    expect(mobs.length).toBeLessThanOrEqual(100)
    expect(herds.some((h) => h.kind === 'magpie')).toBe(true)
    expect(herds.some((h) => TRAFFIC.includes(h.kind))).toBe(true)
    expect(herds.filter(onRoad).length).toBeLessThan(40)
  })
  it('keeps animals in paddocks off the road and gives each herd a sensible head count', () => {
    for (const h of herds) {
      const def = L.kinds[h.kind]
      expect(h.n).toBeGreaterThanOrEqual(def.min)
      expect(h.n).toBeLessThanOrEqual(def.max)
      if (onRoad(h)) continue
      expect(def.on).toContain('g')
      expect(Math.abs(h.x - 600)).toBeGreaterThanOrEqual(R.roadHalf + R.verge + def.near - 0.01)
    }
  })
  it('keeps the whole mob off the road', () => {
    const p = [0, 0, 0]
    for (const h of herds.filter((q) => ['roos', 'cows', 'sheep'].includes(q.kind)))
      for (let i = 0; i < h.n; i++) {
        member(h, i, p)
        expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(L.kinds[h.kind].r)
        expect(Math.abs(h.x + p[0] - 600)).toBeGreaterThan(R.roadHalf + R.verge)
        expect(member(h, i, [0, 0, 0])).toEqual(p)
      }
  })
  it('suits the animals to the land: no cattle in forest, gulls only by the sea, coaches only in the mountains', () => {
    const forest = all(
      make(
        'a',
        funWorld(20, 100, () => 'f'),
      ),
      20,
    )
    const kinds = new Set(forest.map((h) => h.kind))
    for (const k of ['cows', 'sheep', 'seagulls', 'coach'])
      expect(kinds.has(k as never)).toBe(false)
    expect(kinds.has('cockatoos')).toBe(true)
    const coast = all(
      make(
        'a',
        funWorld(20, 3, (e) => (e > 600 ? 'a' : 'g')),
      ),
      20,
    )
    expect(coast.some((h) => h.kind === 'seagulls')).toBe(true)
    const high = funWorld(20, 1200, () => 'b')
    expect(all(make('a', high), 20).some((h) => h.kind === 'coach')).toBe(true)
  })
  it('finds the next herd of a kind', () => {
    const p = make('a', farm)
    expect(p.next(0)).toEqual(herds[0])
    const roo = herds.find((h) => h.kind === 'roos')!
    expect(p.next(0, 'roos')).toEqual(roo)
    expect(p.next(20000)).toBeUndefined()
  })
  it('has every kind in the table', () => {
    expect(LIFE_KINDS.length).toBeGreaterThanOrEqual(12)
  })
})

describe('an animal crossing the road', () => {
  const edge = R.roadHalf + R.verge
  const o0 = edge + L.kinds.wombat.near
  it('waits on its own verge and ends up well off the far side', () => {
    expect(crossAt(o0, 0, L.wombatMs, L.cross, L.cross)).toBe(o0)
    expect(crossAt(o0, 60, L.wombatMs, L.cross, L.cross)).toBe(-L.crossTo)
  })
  it('is off the road before the rider arrives, at any speed', () => {
    for (const ms of [1, 5, 12, 25]) {
      const tt = (L.cross - L.crossClear) / ms
      expect(crossAt(o0, tt, L.wombatMs, L.cross, L.crossClear)).toBeLessThanOrEqual(-edge)
      expect(crossAt(o0, tt + 1, L.wombatMs, L.cross, 0)).toBeLessThanOrEqual(-edge)
    }
  })
  it('ambles at its own pace when the rider is in no hurry', () => {
    expect(crossAt(o0, 2, L.wombatMs, L.cross, L.cross - 1)).toBeCloseTo(o0 - 2 * L.wombatMs)
  })
  it('does not set off with the rider already on top of it', () => {
    expect(L.crossLate).toBeGreaterThan(L.crossClear)
    expect(L.crossLate).toBeLessThan(L.cross)
  })
})

describe('local colour', () => {
  const bush = funWorld(20, 100, () => 'b')
  const count = (p: LifePlan, kind: string) => all(p, 20).filter((h) => h.kind === kind).length
  const at = (region: string, when?: Date) =>
    new LifePlan('a', bush.field, bush.cover, bush.features, region, when)
  it('puts wombats in Tasmania and none in Queensland', () => {
    expect(count(at('TAS'), 'wombat')).toBeGreaterThan(count(at('VIC'), 'wombat'))
    expect(count(at('QLD'), 'wombat')).toBe(0)
  })
  it('brings roos out at dusk and magpies in spring', () => {
    const noon = new Date(2026, 5, 1, 12)
    expect(count(at('VIC', new Date(2026, 5, 1, 18)), 'roos')).toBeGreaterThan(
      count(at('VIC', noon), 'roos'),
    )
    expect(count(at('VIC', new Date(2026, 9, 1, 12)), 'magpie')).toBeGreaterThan(
      count(at('VIC', noon), 'magpie'),
    )
  })
})

describe('a flock before the rider gets there', () => {
  const at = (loop: boolean, u: number, t: number) => ({
    ...idleBird(newBird(), loop, 10, 3, 20, 0.5, 12, 18, u, t),
  })
  it('is never still in mid-air: off the ground it is always moving and flapping', () => {
    for (const loop of [false, true])
      for (const u of [0.05, 0.3, 0.71, 0.97])
        for (let t = 0; t < 30; t += 0.37) {
          const a = at(loop, u, t)
          const b = at(loop, u, t + 0.1)
          const airborne = a.y > 3 + 0.2 + L.idleHopH + 0.01
          expect(airborne).toBe(loop)
          if (airborne) {
            expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.1)
            expect(a.beat).toBeGreaterThan(-1)
          }
        }
  })
  it('pecks, hops and turns on the ground, wings folded between hops', () => {
    const ys = new Set<number>()
    const yaws = new Set<number>()
    let pecks = 0
    for (let t = 0; t < 20; t += 0.05) {
      const a = at(false, 0.4, t)
      ys.add(+a.y.toFixed(2))
      yaws.add(+a.yaw.toFixed(2))
      if (a.pitch > 0.3) pecks++
      expect([a.x, a.z]).toEqual([10, 20])
    }
    expect(Math.max(...ys)).toBeGreaterThan(3.3)
    expect(yaws.size).toBeGreaterThan(3)
    expect(pecks).toBeGreaterThan(20)
  })
  it('loops round the middle of the flock', () => {
    for (let t = 0; t < 10; t += 0.5) {
      const a = at(true, 0.5, t)
      expect(Math.hypot(a.x - 12, a.z - 18)).toBeLessThanOrEqual(L.loopR * 1.4 + 1e-9)
    }
  })
})
