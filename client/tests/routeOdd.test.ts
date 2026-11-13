import { describe, expect, it } from 'vitest'
import { VIS } from '../src/scene/params'
import { FUN, type OddDef } from '../src/scene/route/funVis'
import { ODD_KINDS, Oddities, allowed, seedOf, weighted } from '../src/scene/route/oddPlan'
import { funWorld } from './funWorld'

const R = VIS.route
const O = FUN.odd
const DEFS: Record<string, OddDef> = O.kinds
const all = (o: Oddities, km: number) =>
  Array.from({ length: (km * 1000) / R.chunk }, (_, k) => o.chunk(k)).flat()
const make = (id: string, w: ReturnType<typeof funWorld>) =>
  new Oddities(id, w.field, w.cover, w.features)

describe('oddity rules', () => {
  it('turns a route id into a steady seed', () => {
    expect(seedOf('mount-coot-tha')).toBe(seedOf('mount-coot-tha'))
    expect(seedOf('mount-coot-tha')).not.toBe(seedOf('beach-road'))
  })
  it('picks by weight', () => {
    const w = (s: string) => (s === 'b' ? 3 : 1)
    expect(weighted(['a', 'b'], w, 0.1)).toBe('a')
    expect(weighted(['a', 'b'], w, 0.3)).toBe('b')
    expect(weighted([], w, 0.5)).toBeUndefined()
  })
  it('matches kinds to the ground: cover, snowline, coast and view', () => {
    const k = O.kinds
    expect(allowed(k.bins, 'u', false, false, false)).toBe(true)
    expect(allowed(k.bins, 'f', false, false, false)).toBe(false)
    expect(allowed(k.snowman, 'g', false, false, false)).toBe(false)
    expect(allowed(k.snowman, 'g', true, false, false)).toBe(true)
    expect(allowed(k.couch, 'g', true, false, false)).toBe(false)
    expect(allowed(k.shelter, 'g', true, false, false)).toBe(true)
    expect(allowed(k.kombi, 'g', false, false, false)).toBe(false)
    expect(allowed(k.kombi, 'g', false, true, false)).toBe(true)
    expect(allowed(k.eskyChairs, 'g', false, false, false)).toBe(false)
    expect(allowed(k.eskyChairs, 'g', false, false, true)).toBe(true)
    expect(allowed(k.eskyChairs, 'a', false, false, false)).toBe(true)
  })
  it('has something for every kind of dry ground, above and below the snowline', () => {
    for (const c of 'gfbsupar')
      for (const snow of [false, true])
        expect(ODD_KINDS.some((q) => allowed(DEFS[q], c, snow, false, false))).toBe(true)
  })
})

describe('oddities along a road', () => {
  const farm = funWorld(12, 100, () => 'g')
  const list = all(make('a', farm), 12)
  it('gives every rider the same ones, and another route different ones', () => {
    expect(
      all(
        make(
          'a',
          funWorld(12, 100, () => 'g'),
        ),
        12,
      ),
    ).toEqual(list)
    expect(all(make('b', farm), 12)).not.toEqual(list)
  })
  it('spaces them out: about one every few hundred metres, and more in town', () => {
    expect(list.length).toBeGreaterThan(12000 / 800)
    expect(list.length).toBeLessThan(12000 / 300)
    const town = all(
      make(
        'a',
        funWorld(12, 100, () => 'u'),
      ),
      12,
    )
    expect(town.length).toBeGreaterThan(list.length * 1.4)
  })
  it('stands them beyond the verge, off the ends, on ground they suit', () => {
    for (const o of list) {
      expect(Math.abs(o.x - 600) - o.r).toBeGreaterThanOrEqual(R.roadHalf + R.verge)
      expect(o.d).toBeGreaterThanOrEqual(O.endClear)
      expect(o.d).toBeLessThanOrEqual(12000 - O.endClear)
      expect(DEFS[o.kind].on).toContain('g')
      expect(DEFS[o.kind].snow ?? -1).toBeLessThan(1)
      expect(DEFS[o.kind].coast ?? 0).toBe(0)
      if (DEFS[o.kind].text) expect(DEFS[o.kind].text).toContain(o.text)
    }
  })
  it('turns them to face a rider coming up the road', () => {
    // The road runs north (-z): a thing on the right looks back down it and across to the left.
    for (const o of list) {
      expect(Math.cos(o.face)).toBeGreaterThan(0)
      expect(Math.sin(o.face) * o.side).toBeLessThan(0)
    }
  })
  it('puts one big thing on every route', () => {
    for (const id of ['a', 'b', 'c', 'd'])
      expect(
        all(make(id, farm), 12).filter((o) => o.kind.startsWith('big')).length,
      ).toBeGreaterThan(0)
  })
  it('finds the next one along', () => {
    const o = make('a', farm)
    expect(o.next(0)).toEqual(list[0])
    expect(o.next(list[0].d)).toEqual(list[1])
    expect(o.next(12000)).toBeUndefined()
  })
  it('keeps off water, side streets and buildings', () => {
    const w = funWorld(12, 100, (e) => (e > 600 ? 'w' : 'u'), {
      roads: [
        {
          n: 'Long St',
          k: 'street',
          p: [
            [588, 600],
            [588, 12600],
          ],
        },
      ],
      buildings: Array.from({ length: 300 }, (_, i) => [575, 620 + i * 40, 12, 12, 0, 4]),
    })
    const got = all(make('a', w), 12)
    expect(got.length).toBeGreaterThan(5)
    for (const o of got) {
      expect(w.features.blocked(o.x, o.z, o.r)).toBe(false)
      expect(w.cover.at(o.x, o.z, 100)).not.toBe('w')
    }
  })
  it('only builds snowmen and their like above the snowline', () => {
    const w = funWorld(6, R.snowLine + 100, () => 's')
    const got = all(make('a', w), 6)
    expect(got.length).toBeGreaterThan(3)
    for (const o of got) expect(DEFS[o.kind].snow).toBeGreaterThanOrEqual(0)
    expect(got.some((o) => o.kind === 'snowman')).toBe(true)
  })
})
