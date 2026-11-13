import { describe, expect, it } from 'vitest'
import { buildRoute, type RouteFeatures, type TerrainData } from '../src/core/route'
import { packToRoute } from '../src/core/routeLibrary'
import { VIS } from '../src/scene/params'
import { buildingKind } from '../src/scene/route/chunkProps'
import { Features, STREET_STRIDE } from '../src/scene/route/features'
import { HeightField } from '../src/scene/route/heightField'
import { LandCover } from '../src/scene/route/landCover'
import { Patch, drawnHeight } from '../src/scene/route/patch'
import { RoadPath } from '../src/scene/route/roadPath'
import { TREES, scatter } from '../src/scene/route/scatter'
import { TerrainGrid } from '../src/scene/route/terrainGrid'
import { FIXTURE_PACK } from './fixtures/routePack'

const R = VIS.route
const P = R.place
const LAT0 = -37
const LON0 = 145
/** A grid of `h`-high cells whose origin is 600 m west and south of the route's start. */
const terrain = (h: number, cover?: (e: number, n: number) => string): TerrainData => {
  const cols = 30
  const rows = 50
  return {
    cell: 60,
    lat0: LAT0 - 600 / 110540,
    lon0: LON0 - 600 / (111320 * Math.cos((LAT0 * Math.PI) / 180)),
    cols,
    rows,
    runs: Array.from({ length: rows }, () => [[0, Array(cols).fill(h)]]),
    cover:
      cover &&
      Array.from({ length: rows }, (_, r) => [
        Array.from({ length: cols }, (_, c) => cover(c * 60, r * 60)).join(''),
      ]),
  }
}
/** 1.5 km dead north at `ele`, starting at east 600, north 600 in grid metres. */
function world(t: TerrainData, ele = 100, features?: RouteFeatures) {
  const raw = Array.from({ length: 151 }, (_, i) => ({
    d: i * 10,
    lat: LAT0 + (i * 10) / 110540,
    lon: LON0,
    ele,
  }))
  const path = new RoadPath(buildRoute('n', 'North', raw), t)
  const field = new HeightField(path, new TerrainGrid(t))
  return { field, features: new Features(features, field) }
}

describe('route features on a pack', () => {
  it('carries features from pack to route', () => {
    const features: RouteFeatures = { roads: [{ n: 'A St', k: 'street', p: [[0, 0]] }] }
    expect(packToRoute({ ...FIXTURE_PACK, features }).features).toBe(features)
    expect(packToRoute(FIXTURE_PACK).features).toBeUndefined()
  })
})

describe('land cover', () => {
  it('reads the grid, with boundaries that wander less than a cell', () => {
    const c = new LandCover(terrain(100, (e) => (e < 900 ? 'f' : 'p')))
    expect(c.at(600, -600, 100)).toBe('f')
    expect(c.at(1200, -600, 100)).toBe('p')
    const edge = new Set(Array.from({ length: 80 }, (_, i) => c.at(870, -i * 9, 100)))
    expect([...edge].sort()).toEqual(['f', 'p'])
  })
  it('calls anything below sea level water, mapped or not', () => {
    expect(new LandCover(terrain(0, () => 'g')).at(600, -600, 0)).toBe('w')
    expect(new LandCover().at(0, 0, 0.2)).toBe('w')
  })
  it('guesses without a map: sand by the sea, bush below the treeline, rock well above it', () => {
    const c = new LandCover()
    expect(c.at(0, 0, R.seaLevel + 1)).toBe('a')
    expect('bfg').toContain(c.at(0, 0, 400))
    expect(c.at(0, 0, R.treeline + R.alpineBand + 100)).toBe('r')
    expect(new LandCover(undefined, 'TAS').at(0, 0, R.treelineTas + R.alpineBand + 100)).toBe('r')
    expect('bfg').toContain(c.at(0, 0, R.treelineTas + R.alpineBand + 100))
  })
  it('ignores letters it does not know and treats mapped grass above the treeline as a guess', () => {
    expect('bfg').toContain(new LandCover(terrain(100, () => '?')).at(600, -600, 100))
    expect(new LandCover(terrain(2000, () => 'g')).at(600, -600, 2000)).toBe('r')
  })
})

describe('terrain patch', () => {
  const t = terrain(90)
  const { field } = world(t)
  const right = new Patch(field, 200, 400, true, 1)
  it('puts points exactly on its own triangles', () => {
    const out = { x: 0, y: 0, z: 0 }
    expect(right.point(3, 4, 2, 0.5, 0.5, out)).toBe(true)
    // Route starts at grid east 600 heading north (-z): half-way between rows 3 and 4, columns 2 and 3.
    expect(out.x).toBeCloseTo(600 + (R.inner[1] + R.inner[2]) / 2, 1)
    expect(out.z).toBeCloseTo(-(600 + 200 + 3.5 * R.rowStep), 1)
    expect(out.y).toBeCloseTo(field.ground(out.x, out.z), 0)
  })
  it('reads the drawn height back, near, far and on the road, and gives up outside itself', () => {
    expect(right.height(300, 30)).toBeCloseTo(field.ground(630, -900), 0)
    expect(right.height(300, 250)).toBeCloseTo(90, 0)
    expect(right.height(450, 30)).toBeNaN()
    expect(right.height(300, 2)).toBeNaN()
    expect(drawnHeight(field, [right], 601, -900)).toBeCloseTo(100, 1)
    expect(drawnHeight(field, [right], 630, -900)).toBeCloseTo(right.height(300, 30), 1)
    // The left side has no patch here, so the height is worked out instead.
    expect(drawnHeight(field, [right], 570, -900)).toBeCloseTo(field.ground(570, -900), 5)
  })
})

describe('map features', () => {
  const features: RouteFeatures = {
    roads: [
      {
        n: 'Cross St',
        k: 'street',
        p: [
          [400, 1010],
          [800, 1010],
        ],
      },
      {
        n: '',
        k: 'main',
        p: [
          [600, 1300],
          [900, 1300],
        ],
      },
    ],
    buildings: [
      [640, 1100, 12, 9, 0, 4],
      [602, 1150, 12, 9, 0, 4],
      [700, 1010, 12, 9, 0, 4],
    ],
    pois: [
      { n: 'Top', k: 'peak', at: [900, 1900] },
      { n: 'Nowhere', k: 'cafe', at: [9000, 9000] },
    ],
  }
  const w = world(terrain(100), 100, features)
  const all = [...Array(10).keys()].map((k) => w.features.chunk(k))
  it('cuts a crossing street at the road edge and signs the junction once', () => {
    const c = w.features.chunk(2)!
    for (let i = 0; i < c.streets.length; i += STREET_STRIDE)
      for (const k of [0, 2, 4, 6])
        expect(Math.abs(c.streets[i + k] - 600)).toBeGreaterThan(R.roadHalf - R.streetHalf - 0.01)
    const mid = (i: number) => (c.streets[i] + c.streets[i + 2]) / 2
    const ends: number[] = []
    for (let i = 0; i < c.streets.length; i += STREET_STRIDE)
      ends.push(Math.abs(mid(i) - 600), Math.abs((c.streets[i + 4] + c.streets[i + 6]) / 2 - 600))
    expect(Math.min(...ends)).toBeCloseTo(R.roadHalf, 1)
    expect(c.signs.map((s) => s.name)).toEqual(['Cross St'])
    for (const s of c.signs) expect(Math.abs(s.x - 600)).toBeGreaterThan(R.roadHalf + 1)
  })
  it('gives unnamed streets no sign and flags main roads', () => {
    const c = w.features.chunk(3)!
    expect(c.signs).toHaveLength(0)
    expect(c.streets[8]).toBe(1)
  })
  it('keeps buildings off the road and off side streets, and hands the rest to the nearest chunk', () => {
    expect(all.flatMap((c) => c?.buildings ?? [])).toHaveLength(1)
    expect(w.features.chunk(2)!.buildings[0]).toMatchObject({ x: 640, z: -1100 })
  })
  it('knows where streets and buildings are', () => {
    expect(w.features.blocked(700, -1011, 1)).toBe(true)
    expect(w.features.blocked(700, -1010 - R.streetHalf - 3, 1)).toBe(false)
    expect(w.features.blocked(643, -1102, 0)).toBe(true)
    expect(w.features.blocked(660, -1100, 1)).toBe(false)
  })
  it('keeps points of interest within reach and drops the rest', () => {
    expect(w.features.pois.map((p) => p.name)).toEqual(['Top'])
  })
  it('copes with no features at all', () => {
    const none = world(terrain(100)).features
    expect(none.chunk(0)).toBeUndefined()
    expect(none.blocked(0, 0, 5)).toBe(false)
  })
})

describe('plants', () => {
  const features: RouteFeatures = {
    roads: [
      {
        n: 'Cross St',
        k: 'street',
        p: [
          [400, 1110],
          [800, 1110],
        ],
      },
    ],
    buildings: [[650, 1150, 12, 9, 0, 4]],
  }
  const grow = (t: TerrainData, ele: number, detail = 1, f?: RouteFeatures, region?: string) => {
    const w = world(t, ele, f)
    const patches = [new Patch(w.field, 400, 600, true, -1), new Patch(w.field, 400, 600, true, 1)]
    const spots = scatter(2, patches, new LandCover(t, region), w.features, detail, 300)
    return { spots, w }
  }
  const forest = terrain(100, () => 'f')
  it('never grow on the road, a side street or a building, and trees keep off the verge', () => {
    const { spots, w } = grow(forest, 100, 1, features)
    expect(spots.length).toBeGreaterThan(100)
    for (const s of spots) {
      const off = Math.abs(s.x - 600)
      expect(off).toBeGreaterThan(
        R.roadHalf + R.verge + (TREES.includes(s.kind) ? P.treeClear : P.underClear) - 0.01,
      )
      expect(w.features.blocked(s.x, s.z, TREES.includes(s.kind) ? P.streetClear : 0.5)).toBe(false)
      expect(s.y).toBeCloseTo(w.field.ground(s.x, s.z), 0)
    }
  })
  it('grow the same every time, and more of them at higher detail', () => {
    const a = grow(forest, 100).spots
    expect(grow(forest, 100).spots).toEqual(a)
    const half = grow(forest, 100, 0.5).spots.length
    expect(half).toBeGreaterThan(a.length * 0.35)
    expect(half).toBeLessThan(a.length * 0.65)
  })
  it('follow the land cover: nothing in water, forest thicker than grass', () => {
    expect(
      grow(
        terrain(100, () => 'w'),
        100,
      ).spots,
    ).toHaveLength(0)
    const trees = (c: string) =>
      grow(
        terrain(100, () => c),
        100,
      ).spots.filter((s) => TREES.includes(s.kind)).length
    expect(trees('f')).toBeGreaterThan(trees('g') * 8)
  })
  it('turn to snow gums near the treeline and stop above it', () => {
    const kinds = (ele: number, region?: string) =>
      new Set(
        grow(
          terrain(ele, () => 'f'),
          ele,
          1,
          undefined,
          region,
        )
          .spots.map((s) => s.kind)
          .filter((k) => TREES.includes(k)),
      )
    expect([...kinds(R.treeline - 100)]).toEqual(['snowgum'])
    expect(kinds(R.treeline + P.treelineFade + 10).size).toBe(0)
    expect(kinds(R.treelineTas + P.treelineFade + 10, 'TAS').size).toBe(0)
    expect(kinds(400).has('gum')).toBe(true)
  })
  it('picks pubs and servos from big footprints', () => {
    const b = { x: 0, z: 0, rot: 0 }
    expect(buildingKind({ ...b, w: 14, d: 12, h: 7 })).toBe('pub')
    expect(['servo', 'shop']).toContain(buildingKind({ ...b, w: 20, d: 14, h: 4 }))
    expect(['gable', 'verandah', 'hip', 'shop']).toContain(
      buildingKind({ ...b, w: 12, d: 9, h: 3.5 }),
    )
  })
})
