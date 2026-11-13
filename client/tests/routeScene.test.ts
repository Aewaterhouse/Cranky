import { describe, expect, it } from 'vitest'
import { buildRoute, type RawPoint, type TerrainData } from '../src/core/route'
import { packToRoute } from '../src/core/routeLibrary'
import { VIS } from '../src/scene/params'
import { HeightField } from '../src/scene/route/heightField'
import { RoadIndex } from '../src/scene/route/roadIndex'
import { RoadPath, newPose, project } from '../src/scene/route/roadPath'
import { TerrainGrid } from '../src/scene/route/terrainGrid'
import { FIXTURE_PACK } from './fixtures/routePack'

const R = VIS.route
/** 600 m north then a right-hand quarter circle of 80 m radius, then east; climbing 5% all the way. */
function bendRoute() {
  const raw: RawPoint[] = []
  const lat0 = -37
  const lon0 = 145
  const add = (e: number, n: number) => {
    const d = raw.length * 10
    raw.push({
      d,
      lat: lat0 + n / 110540,
      lon: lon0 + e / (111320 * Math.cos((lat0 * Math.PI) / 180)),
      ele: 100 + d * 0.05,
    })
  }
  for (let i = 0; i < 60; i++) add(0, i * 10)
  for (let a = 0; a < Math.PI / 2; a += 10 / 80) add(80 - 80 * Math.cos(a), 600 + 80 * Math.sin(a))
  for (let i = 0; i < 40; i++) add(80 + i * 10, 680)
  return buildRoute('bend', 'Bend', raw)
}
const flatTerrain = (h: number, cols = 12, rows = 12): TerrainData => ({
  cell: 60,
  lat0: -37,
  lon0: 145,
  cols,
  rows,
  runs: Array.from({ length: rows }, () => [[0, Array(cols).fill(h)]]),
})

describe('projection', () => {
  it('maps degrees to local metres', () => {
    expect(project(-37, 145, -37, 145)).toEqual([0, 0])
    const [e, n] = project(-36.99, 145.01, -37, 145)
    expect(n).toBeCloseTo(1105.4, 1)
    expect(e).toBeCloseTo(1113.2 * Math.cos((37 * Math.PI) / 180), 1)
  })
})

describe('road path', () => {
  const path = new RoadPath(bendRoute())
  const a = newPose()
  const b = newPose()
  it('passes through its points and heads north (-z) first', () => {
    for (const i of [0, 7, 30, 64, path.n - 1]) {
      path.poseAt(i * path.space, a)
      expect(a.x).toBeCloseTo(path.x[i], 6)
      expect(a.z).toBeCloseTo(path.z[i], 6)
      expect(a.y).toBeCloseTo(path.y[i], 6)
    }
    path.poseAt(200, a)
    expect(a.fz).toBeCloseTo(-1, 2)
    expect(a.rx).toBeCloseTo(1, 2)
    expect(a.grade).toBeCloseTo(0.05, 2)
  })
  it('always moves forward as distance grows', () => {
    for (let d = -40; d < path.length + 40; d += 3) {
      path.poseAt(d, a)
      path.poseAt(d + 3, b)
      expect((b.x - a.x) * a.fx + (b.z - a.z) * a.fz).toBeGreaterThan(1.5)
    }
  })
  it('banks into a right-hand bend, stays flat on the straight and clamps', () => {
    path.poseAt(660, a)
    expect(a.curv).toBeCloseTo(1 / 80, 2)
    expect(a.bank).toBeGreaterThan(0)
    expect(a.bank).toBeLessThanOrEqual(R.bankMax)
    expect(Math.abs(path.poseAt(300, a).bank)).toBeLessThan(0.002)
  })
  it('carries straight on past the ends', () => {
    path.poseAt(-50, a)
    expect(a.z).toBeCloseTo(path.z[0] + 50, 0)
    expect(a.y).toBeCloseTo(path.y[0], 6)
  })
  it('gives routes without coordinates a wandering line with the real heights', () => {
    const r = buildRoute(
      'nopos',
      'No map',
      Array.from({ length: 200 }, (_, i) => ({ d: i * 10, ele: i })),
    )
    const p = new RoadPath(r)
    const xs = Array.from(p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(30)
    expect(p.poseAt(1000, a).y).toBeCloseTo(r.points[100].ele, 3)
    expect(Math.abs(a.curv)).toBeLessThan(1 / 60)
  })
  it('cuts out a short out-and-back spur', () => {
    const at = (e: number, n: number, i: number): RawPoint => ({
      d: i * 10,
      lat: -37 + n / 110540,
      lon: 145 + e / (111320 * Math.cos((37 * Math.PI) / 180)),
      ele: 100,
    })
    const spots = [
      ...Array.from({ length: 31 }, (_, i) => [0, i * 10]),
      ...[10, 20, 30, 20, 10, 0].map((e) => [e, 300]),
      ...Array.from({ length: 30 }, (_, i) => [0, 310 + i * 10]),
    ]
    const p = new RoadPath(
      buildRoute(
        'spur',
        'Spur',
        spots.map(([e, n], i) => at(e, n, i)),
      ),
    )
    expect(Math.max(...p.x)).toBeLessThan(4)
    for (let d = 0; d < p.length; d += 5)
      expect(p.poseAt(d + 5, b).z).toBeLessThan(p.poseAt(d, a).z - 2)
  })
  it('splits a long out-and-back into two carriageways with a loop at the turn', () => {
    const raw: RawPoint[] = Array.from({ length: 121 }, (_, i) => ({
      d: i * 10,
      lat: -37 + (i <= 60 ? i * 10 : 1200 - i * 10) / 110540,
      lon: 145,
      ele: 100 + (i <= 60 ? i : 121 - i),
    }))
    const p = new RoadPath(buildRoute('oab', 'Out and back', raw))
    // Out on the left (west when heading north), home on the other side, at the same height.
    expect(p.x[30]).toBeCloseTo(-R.uturnShift, 1)
    expect(p.x[90]).toBeCloseTo(R.uturnShift, 1)
    expect(p.y[90]).toBe(p.y[30])
    // The loop is wider than the road, and the two ends still meet.
    expect(p.x[61] - p.x[59]).toBeGreaterThan(2 * R.roadHalf)
    expect(Math.abs(p.x[119] - p.x[1])).toBeLessThan(0.5)
  })
  it('uses the terrain origin when given one', () => {
    const p = new RoadPath(packToRoute(FIXTURE_PACK), { lat0: -37.001, lon0: 145 })
    expect(p.z[0]).toBeCloseTo(-110.54, 1)
  })
})

describe('terrain grid', () => {
  const data: TerrainData = {
    cell: 60,
    lat0: 0,
    lon0: 0,
    cols: 8,
    rows: 6,
    runs: [
      [[0, [0, 10, 20, 30, 40, 50, 60, 70]]],
      [[0, [0, 10, 20, 30, 40, 50, 60, 70]]],
      [[0, [100, 110, 120, 130, 140, 150, 160, 170]]],
      [
        [0, [100, 110]],
        [5, [150, 160, 170]],
      ],
      null,
      [],
    ],
  }
  const g = new TerrainGrid(data, 1)
  it('decodes runs and samples bilinearly', () => {
    expect(g.sample(60, 60)).toBe(1)
    expect(g.height).toBeCloseTo(10)
    g.sample(90, 60)
    expect(g.height).toBeCloseTo(15)
    g.sample(120, 90)
    expect(g.height).toBeCloseTo(70)
  })
  it('gives no weight to unknown cells, the border or outside, and never returns NaN', () => {
    expect(g.sample(180, 180)).toBe(0)
    expect(g.sample(-5, 60)).toBe(0)
    expect(g.sample(60, 5000)).toBe(0)
    expect(g.sample(170, 150)).toBeGreaterThan(0)
    expect(g.sample(170, 150)).toBeLessThan(1)
    for (let e = 0; e < 420; e += 37)
      for (let n = 0; n < 300; n += 41) {
        g.sample(e, n)
        expect(Number.isFinite(g.height)).toBe(true)
      }
  })
})

describe('nearest road', () => {
  const path = new RoadPath(bendRoute())
  const idx = new RoadIndex(path, 50)
  it('finds the nearest point, its distance along and its height', () => {
    expect(idx.nearest(12, -203, 60)).toBeCloseTo(12, 1)
    expect(idx.at).toBeCloseTo(203, 0)
    expect(idx.height).toBeCloseTo(100 + 203 * 0.05, 0)
    expect(idx.nearest(400, -300, 60)).toBe(Infinity)
  })
  it('agrees with the coarse index to within its segment sag', () => {
    const coarse = new RoadIndex(path, 250, 4)
    expect(coarse.nearest(150, -500, 600)).toBeCloseTo(idx.nearest(150, -500, 600), 0)
  })
})

describe('ground cut to the road', () => {
  const path = new RoadPath(bendRoute())
  const road = (d: number) => path.poseAt(d, newPose())
  // The land is a flat plain at 80 m, so the climbing road ends up on an embankment.
  const f = new HeightField(path, new TerrainGrid(flatTerrain(80, 40, 40), 1))
  it('sits level with the road across the shoulder', () => {
    for (const d of [100, 300, 640, 900])
      for (const o of [-R.shoulder + 0.5, -3, 0, 3, R.shoulder - 0.5]) {
        const p = road(d)
        expect(f.ground(p.x + p.rx * o, p.z + p.rz * o)).toBeCloseTo(p.y, 0)
      }
  })
  it('blends back to natural ground', () => {
    const p = road(300)
    const far = R.shoulder + R.blend + 5
    expect(f.natural(p.x + 200, p.z)).toBeCloseTo(80, 3)
    expect(f.ground(p.x + far, p.z)).toBeCloseTo(80, 3)
    const mid = f.ground(p.x + R.shoulder + R.blend / 2, p.z)
    expect(mid).toBeGreaterThan(81)
    expect(mid).toBeLessThan(p.y - 1)
    let prev = p.y + 0.01
    for (let o = 0; o <= far; o += 2) {
      const h = f.ground(p.x + o, p.z)
      expect(h).toBeLessThanOrEqual(prev + 0.05)
      prev = h
    }
  })
  it('gives two nearby stretches their own bench', () => {
    // A hairpin: 300 m north at 10%, a tight U-turn, then back south 24 m to the east and well above.
    const raw: RawPoint[] = []
    const add = (e: number, n: number) =>
      raw.push({
        d: raw.length * 10,
        lat: -37 + n / 110540,
        lon: 145 + e / (111320 * Math.cos((37 * Math.PI) / 180)),
        ele: 100 + raw.length,
      })
    for (let i = 0; i <= 30; i++) add(0, i * 10)
    for (const a of [0.5, 1.57, 2.64]) add(12 - 12 * Math.cos(a), 300 + 12 * Math.sin(a))
    for (let i = 30; i >= 0; i--) add(24, i * 10)
    const hp = new RoadPath(buildRoute('hairpin', 'Hairpin', raw))
    const hf = new HeightField(hp, new TerrainGrid(flatTerrain(100), 1))
    const up = hp.poseAt(100, newPose())
    const back = hp.poseAt(hp.length - 100, newPose())
    expect(back.y - up.y).toBeGreaterThan(30)
    expect(Math.hypot(back.x - up.x, back.z - up.z)).toBeLessThan(30)
    for (const p of [up, back])
      for (const o of [-5, 0, 5]) expect(Math.abs(hf.ground(p.x + o, p.z) - p.y)).toBeLessThan(0.15)
    // Half way between the legs the ground is between the two benches.
    const mid = hf.ground((up.x + back.x) / 2, up.z)
    expect(mid).toBeGreaterThan(up.y + 5)
    expect(mid).toBeLessThan(back.y - 5)
  })
  it('knows which ground belongs to which bit of road', () => {
    const p = road(640)
    // Inside the bend, past its centre, another part of the curve is nearer.
    expect(f.clear(p.x + p.rx * 40, p.z + p.rz * 40, 40)).toBe(true)
    expect(f.clear(p.x + p.rx * 130, p.z + p.rz * 130, 130)).toBe(false)
    expect(f.clear(p.x - p.rx * 130, p.z - p.rz * 130, 130)).toBe(true)
  })
  it('makes up rolling ground when there is no grid', () => {
    const bare = new HeightField(path)
    const p = road(300)
    expect(bare.ground(p.x + 2, p.z)).toBeCloseTo(p.y, 0)
    const hs = [100, 200, 300, 400].map((o) => bare.natural(p.x - o, p.z))
    expect(hs.every(Number.isFinite)).toBe(true)
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(1)
  })
})
