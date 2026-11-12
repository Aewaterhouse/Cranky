import { describe, expect, it } from 'vitest'
import { ascentFrom, buildRoute, haversine, parseGpx, routeAt, routeStats } from '../src/core/route'

// About 2 km due north along a meridian, rising 100 m, one point without elevation.
const pts = Array.from({ length: 21 }, (_, i) => ({
  lat: -37 + i * 0.0009,
  ele: i === 10 ? undefined : i * 5,
}))
const gpx = `<?xml version="1.0"?>
<gpx version="1.1"><metadata><name>Not this</name></metadata>
<trk><name>Test &amp; Hill</name><desc>Short</desc><trkseg>
${pts
  .map(
    (p) =>
      `<trkpt lat="${p.lat}" lon='145.0'>${p.ele === undefined ? '' : `<ele>${p.ele}</ele>`}<time>2020-01-01T00:00:00Z</time></trkpt>`,
  )
  .join('\n')}
</trkseg></trk></gpx>`

const two = (e: number, d = 1000) => [
  { d: 0, ele: 0 },
  { d, ele: e },
]

describe('haversine', () => {
  it('one degree of latitude is about 111 km', () => {
    expect(haversine(0, 0, 1, 0)).toBeGreaterThan(110900)
    expect(haversine(0, 0, 1, 0)).toBeLessThan(111500)
  })
})

describe('parseGpx', () => {
  const r = parseGpx(gpx, 'my-t')
  it('reads name, desc and totals', () => {
    expect(r.name).toBe('Test & Hill')
    expect(r.desc).toBe('Short')
    expect(r.distance).toBeGreaterThan(1900)
    expect(r.distance).toBeLessThan(2100)
    expect(r.ascent).toBeGreaterThan(80)
    expect(r.ascent).toBeLessThanOrEqual(105)
  })
  it('resamples evenly at 10 m', () => {
    r.points.forEach((p, i) => expect(p.d).toBe(i * 10))
    expect(r.points[0].lat).toBeCloseTo(-37, 4)
  })
  it('fills the missing elevation and gives a steady 5% gradient mid-route', () => {
    const mid = r.points[100]
    expect(mid.ele).toBeGreaterThan(45)
    expect(mid.ele).toBeLessThan(55)
    expect(mid.grade).toBeGreaterThan(4)
    expect(mid.grade).toBeLessThan(6)
  })
  it('clamps gradients to +/-20%', () => {
    const wall = buildRoute('w', 'wall', [
      { d: 0, ele: 0 },
      { d: 100, ele: 0 },
      { d: 110, ele: 100 },
      { d: 300, ele: 100 },
    ])
    expect(Math.max(...wall.points.map((p) => p.grade))).toBeLessThanOrEqual(20)
  })
  it('smooths a spike', () => {
    const spike = buildRoute('s', 's', [
      { d: 0, ele: 0 },
      { d: 500, ele: 0 },
      { d: 505, ele: 30 },
      { d: 510, ele: 0 },
      { d: 1000, ele: 0 },
    ])
    expect(Math.max(...spike.points.map((p) => p.ele))).toBeLessThan(10)
  })
  it('handles a file with no elevation at all, and with no position', () => {
    const flat = parseGpx(
      '<gpx><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="1.01" lon="1"/></trkseg></trk></gpx>',
    )
    expect(flat.ascent).toBe(0)
    expect(flat.name).toBe('Imported route')
    const bare = buildRoute('b', 'b', two(5, 100))
    expect(bare.points[0].lat).toBeUndefined()
    expect(routeStats(bare).hasMap).toBe(false)
  })
  it('rejects a file with no points', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow()
  })
  it('thins long routes to at most 4000 samples', () => {
    const long = buildRoute('l', 'l', two(500, 200000))
    expect(long.points.length).toBeLessThanOrEqual(4001)
    expect(long.distance).toBeGreaterThan(199000)
  })
})

describe('route queries', () => {
  const r = buildRoute('q', 'q', two(100))
  it('interpolates position and clamps past the ends', () => {
    expect(routeAt(r, 505).ele).toBeGreaterThan(40)
    expect(routeAt(r, 99999).ele).toBeCloseTo(r.points[r.points.length - 1].ele, 1)
    expect(routeAt(r, -5).ele).toBeCloseTo(r.points[0].ele, 1)
  })
  it('ascent to go falls along the route', () => {
    expect(ascentFrom(r, 0)).toBeGreaterThan(ascentFrom(r, 500))
    expect(ascentFrom(r, r.distance)).toBe(0)
  })
  it('stats: average gradient', () => {
    expect(routeStats(r).avgGrade).toBeCloseTo(10, 0)
  })
})
