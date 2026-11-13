import { describe, expect, it } from 'vitest'
import { buildRoute, type RawPoint, type TerrainData } from '../src/core/route'
import { VIS } from '../src/scene/params'
import { hairpins, planFurniture, railRows, ramps } from '../src/scene/route/furniture'
import { HeightField } from '../src/scene/route/heightField'
import { Patch } from '../src/scene/route/patch'
import { RoadPath } from '../src/scene/route/roadPath'
import { TerrainGrid } from '../src/scene/route/terrainGrid'

const F = VIS.route.place.furniture
const LAT0 = -37
const K = 111320 * Math.cos((LAT0 * Math.PI) / 180)
/** A route through [east, north] points 10 m apart, with heights from `ele(d)`. */
function pathOf(xy: [number, number][], ele: (d: number) => number) {
  const raw: RawPoint[] = xy.map(([e, n], i) => ({
    d: i * 10,
    lat: LAT0 + n / 110540,
    lon: 145 + e / K,
    ele: ele(i * 10),
  }))
  return new RoadPath(buildRoute('t', 'T', raw))
}
const straight = (m: number): [number, number][] =>
  Array.from({ length: m / 10 + 1 }, (_, i) => [0, i * 10])
/** `legs` straights of 300 m joined by 20 m radius half circles, zig-zagging north. */
function switchbacks(legs: number) {
  const xy: [number, number][] = []
  for (let l = 0; l < legs; l++) {
    const dir = l % 2 ? -1 : 1
    for (let i = 0; i <= 30; i++) xy.push([dir > 0 ? i * 10 : 300 - i * 10, l * 40])
    if (l < legs - 1)
      for (let a = 0.5; a < Math.PI; a += 0.5)
        xy.push([(dir > 0 ? 300 : 0) + dir * 20 * Math.sin(a), l * 40 + 20 - 20 * Math.cos(a)])
  }
  return xy
}

describe('gradient signs', () => {
  it('finds a sustained ramp and its average, and ignores short pinches and gentle climbs', () => {
    // 500 m flat, 600 m at 8%, 400 m flat, 150 m at 10%, flat, then a long 4% drag.
    const ele = (d: number) =>
      Math.min(Math.max(0, d - 500), 600) * 0.08 +
      Math.min(Math.max(0, d - 1500), 150) * 0.1 +
      Math.max(0, d - 2000) * 0.04
    const found = ramps(pathOf(straight(4000), ele))
    expect(found).toHaveLength(1)
    expect(found[0].d0).toBeGreaterThan(450)
    expect(found[0].d0).toBeLessThan(560)
    expect(found[0].d1 - found[0].d0).toBeGreaterThan(500)
    expect(found[0].grade).toBeCloseTo(0.08, 2)
  })
  it('puts the sign before the ramp with the percentage and length', () => {
    const plan = planFurniture(
      pathOf(straight(3000), (d) => Math.min(Math.max(0, d - 500), 600) * 0.08),
    )
    const sign = [...plan.values()].flat().find((f) => f.kind === 'grade')!
    expect(sign.text).toMatch(/^8%\n(550|600) m$/)
    expect(sign.d).toBeGreaterThan(400)
    expect(sign.d).toBeLessThan(520)
  })
})

describe('hairpins', () => {
  it('finds each switchback once, with the way it turns', () => {
    const pins = hairpins(pathOf(switchbacks(4), (d) => d * 0.05))
    expect(pins).toHaveLength(3)
    // Heading east then turning north then west is a left turn; the next is a right.
    expect(pins.map((p) => Math.sign(p.turn))).toEqual([-1, 1, -1])
    expect(pins[0].d).toBeGreaterThan(290)
    expect(pins[0].d).toBeLessThan(370)
  })
  it('numbers them counting down to the top, on the outside of the bend', () => {
    const plan = planFurniture(pathOf(switchbacks(4), (d) => 500 + d * 0.05))
    const signs = [...plan.values()]
      .flat()
      .filter((f) => f.kind === 'hairpin')
      .sort((a, b) => a.d - b.d)
    expect(signs.map((s) => s.text.split('\n')[0])).toEqual(['3', '2', '1'])
    expect(signs.map((s) => s.side)).toEqual([1, -1, 1])
    expect(signs[0].text).toMatch(/^3\n5\d\d m$/)
  })
  it('does not number a lone bend or a wide curve', () => {
    expect(planFurniture(pathOf(switchbacks(2), () => 0)).size).toBeGreaterThan(0)
    const kinds = (xy: [number, number][]) =>
      [...planFurniture(pathOf(xy, () => 0)).values()].flat().map((f) => f.kind)
    expect(kinds(switchbacks(2))).not.toContain('hairpin')
    const wide: [number, number][] = Array.from({ length: 200 }, (_, i) => [
      400 * Math.sin(i / 40),
      400 - 400 * Math.cos(i / 40),
    ])
    expect(hairpins(pathOf(wide, () => 0))).toHaveLength(0)
  })
})

describe('kilometre markers and arches', () => {
  const kinds = (ele: (d: number) => number, m = 5000) =>
    [...planFurniture(pathOf(straight(m), ele)).values()].flat()
  it('marks each kilometre on the left and has a start and a finish', () => {
    const all = kinds(() => 50)
    expect(all.filter((f) => f.kind === 'km').map((f) => [f.d, f.text, f.side])).toEqual(
      [1, 2, 3, 4].map((k) => [k * 1000, `${k}\nkm`, -1]),
    )
    expect(all.map((f) => f.kind).filter((k) => k !== 'km')).toEqual(['start', 'finish'])
  })
  it('puts a summit arch at the highest point of a climb', () => {
    const all = kinds((d) => 1200 - Math.abs(d - 3000) * 0.1)
    const summit = all.find((f) => f.kind === 'summit')!
    expect(summit.d).toBe(3000)
    expect(summit.text).toMatch(/^SUMMIT 1,(19\d|200) m$/)
    expect(all.some((f) => f.kind === 'finish')).toBe(true)
  })
  it('makes the finish the summit on a summit finish, and has no summit on the flat', () => {
    const all = kinds((d) => d * 0.08)
    expect(all.filter((f) => f.kind === 'summit').map((f) => f.d)).toEqual([4996])
    expect(all.some((f) => f.kind === 'finish')).toBe(false)
    expect(kinds((d) => Math.sin(d / 300) * 20).some((f) => f.kind === 'summit')).toBe(false)
  })
  it('files everything under its 200 m chunk', () => {
    for (const [k, list] of planFurniture(pathOf(straight(5000), () => 0)))
      for (const f of list) expect(Math.floor(f.d / VIS.route.chunk)).toBe(k)
  })
})

describe('guard rails', () => {
  it('run along the side where the ground falls away and nowhere else', () => {
    // Level west of the road, falling steeply to the east. The grid starts 600 m west and south of the route.
    const cols = 30
    const t: TerrainData = {
      cell: 60,
      lat0: LAT0 - 600 / 110540,
      lon0: 145 - 600 / K,
      cols,
      rows: 40,
      runs: Array.from({ length: 40 }, () => [
        [0, Array.from({ length: cols }, (_, c) => 300 - Math.max(0, c * 60 - 600) * 2)],
      ]),
    }
    const path = new RoadPath(buildRoute('t', 'T', pathOfRaw()), t)
    const field = new HeightField(path, new TerrainGrid(t))
    const drop = railRows(new Patch(field, 400, 600, true, 1))
    const level = railRows(new Patch(field, 400, 600, true, -1))
    expect(drop.every((v) => v === 1)).toBe(true)
    expect(level.some((v) => v === 1)).toBe(false)
    expect(F.railDrop).toBeGreaterThan(0)
  })
})
function pathOfRaw(): RawPoint[] {
  return Array.from({ length: 121 }, (_, i) => ({
    d: i * 10,
    lat: LAT0 + (i * 10) / 110540,
    lon: 145,
    ele: 300,
  }))
}
