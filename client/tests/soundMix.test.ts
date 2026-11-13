import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import {
  beds,
  freehubHz,
  tyreGain,
  tyreHz,
  windGain,
  windHz,
  type Place,
} from '../src/core/soundMix'

const S = CFG.sound.ride
const bush: Place = { cover: 'b', y: 20, coast: false }

describe('bike sounds follow the ride', () => {
  it('the freehub ticks only when coasting and moving, faster with speed, up to a cap', () => {
    expect(freehubHz(10, false)).toBe(0)
    expect(freehubHz(0, true)).toBe(0)
    expect(freehubHz(0.5, true)).toBe(0)
    expect(freehubHz(2, true)).toBeCloseTo((2 / CFG.gears.wheelM) * S.freehub.clicks)
    expect(freehubHz(4, true)).toBeCloseTo(2 * freehubHz(2, true))
    expect(freehubHz(22, true)).toBe(S.freehub.maxHz)
  })
  it('wind is silent at a crawl, rises with speed and is never past full', () => {
    expect(windGain(0)).toBe(0)
    expect(windGain(S.wind.fromMs)).toBe(0)
    const g = [5, 8, 12, 16, 20].map((v) => windGain(v))
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1])
    expect(windGain(S.wind.fullMs)).toBe(1)
    expect(windGain(60)).toBe(1)
    expect(windHz(15)).toBeGreaterThan(windHz(5))
  })
  it('a headwind is louder than a tailwind at the same road speed', () => {
    expect(windGain(8, 4)).toBeGreaterThan(windGain(8))
    expect(windGain(8, -4)).toBeLessThan(windGain(8))
    expect(windGain(2, -6)).toBe(0)
    expect(windHz(2, -6)).toBe(S.wind.hz)
  })
  it('tyres hum as soon as the wheels turn and level off', () => {
    expect(tyreGain(0)).toBe(0)
    expect(tyreGain(3)).toBeGreaterThan(0.3)
    expect(tyreGain(10)).toBeGreaterThan(tyreGain(3))
    expect(tyreGain(30)).toBe(1)
    expect(tyreHz(10)).toBeGreaterThan(tyreHz(0))
  })
})

describe('the sounds of the place', () => {
  it('bush has birds and cicadas and nothing else', () => {
    const b = beds(bush, 'route')
    expect(b.birds).toBeGreaterThan(0.5)
    expect(b.cicadas).toBeGreaterThan(0.5)
    expect(b).toMatchObject({ highWind: 0, surf: 0, gulls: 0, traffic: 0 })
  })
  it('town has traffic and few birds; rock and water are quiet', () => {
    const t = beds({ ...bush, cover: 'u' }, 'route')
    expect(t.traffic).toBe(1)
    expect(t.birds).toBeLessThan(0.3)
    expect(t.cicadas).toBe(0)
    for (const cover of ['r', 'w', '?'])
      expect(beds({ ...bush, cover }, 'route')).toMatchObject({ birds: 0, cicadas: 0, traffic: 0 })
  })
  it('the coast has surf and gulls and fewer cicadas', () => {
    const c = beds({ ...bush, coast: true }, 'route')
    expect(c.surf).toBe(1)
    expect(c.gulls).toBe(1)
    expect(c.cicadas).toBeLessThan(beds(bush, 'route').cicadas)
    // A dam in the hills is not the sea.
    expect(beds({ ...bush, y: 300, coast: true }, 'route')).toMatchObject({ surf: 0, gulls: 0 })
  })
  it('up high the wind takes over: no cicadas and fewer birds', () => {
    const low = beds({ ...bush, y: S.highFrom }, 'route')
    const mid = beds({ ...bush, y: (S.highFrom + S.highFull) / 2 }, 'route')
    const top = beds({ ...bush, y: 1800 }, 'route')
    expect(low.highWind).toBe(0)
    expect(mid.highWind).toBeCloseTo(0.5)
    expect(top.highWind).toBe(1)
    expect(top.cicadas).toBe(0)
    expect(top.birds).toBeLessThan(low.birds)
    expect(top.birds).toBeGreaterThan(0)
  })
  it('the sky changes it: a dawn chorus, no cicadas at dawn or in the wet, an unknown sky is a plain day', () => {
    expect(beds({ ...bush, cover: 'g' }, 'routeDawn').birds).toBeGreaterThan(
      beds({ ...bush, cover: 'g' }, 'route').birds,
    )
    for (const m of ['routeDawn', 'routeMist', 'routeShower']) expect(beds(bush, m).cicadas).toBe(0)
    expect(beds(bush, 'routeShower').birds).toBeLessThan(beds(bush, 'route').birds)
    expect(beds(bush, 'whatever')).toEqual(beds(bush, 'route'))
  })
  it('every level stays between 0 and 1 and every category has a loudness in the config', () => {
    for (const cover of 'gfbsuparw')
      for (const mood of Object.keys(S.mood))
        for (const y of [0, 1200, 2000])
          for (const coast of [false, true])
            for (const v of Object.values(beds({ cover, y, coast }, mood))) {
              expect(v).toBeGreaterThanOrEqual(0)
              expect(v).toBeLessThanOrEqual(1)
            }
    for (const k of [
      'master',
      'freehub',
      'wind',
      'tyre',
      'clunk',
      'birds',
      'cicadas',
      'highWind',
      'surf',
      'gulls',
      'traffic',
    ] as const) {
      expect(S.level[k]).toBeGreaterThan(0)
      expect(S.level[k]).toBeLessThanOrEqual(1)
    }
  })
})
