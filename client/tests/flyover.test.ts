import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { flyStretch, profileSample } from '../src/core/flyover'
import { buildRoute } from '../src/core/route'
import { ROUTE_INDEX } from '../src/core/routeLibrary'
import { ROUTE_LINES, routeLine } from '../src/fun/routeLines'

/** A route from a height function, a point every 10 m. */
const route = (lenM: number, ele: (d: number) => number) =>
  buildRoute(
    't',
    'Test',
    Array.from({ length: lenM / 10 + 1 }, (_, i) => ({ d: i * 10, ele: ele(i * 10) })),
  )
const span = CFG.intro.spanM

describe('flyover stretch', () => {
  // Flat for 2 km, 6% for 2 km (120 m up), flat for 1 km.
  const hill = route(5000, (d) => Math.min(120, Math.max(0, (d - 2000) * 0.06)))

  it('shows the top of the main climb', () => {
    const s = flyStretch(hill)
    expect(s.what).toBe('The summit')
    expect(s.to - s.from).toBe(span)
    expect(s.from).toBeLessThan(4000)
    expect(s.to).toBeGreaterThanOrEqual(4000)
    expect(s.to).toBeLessThanOrEqual(4000 + span / 2 + 10)
  })

  it('prefers a stack of hairpins on the climb, and ignores bends elsewhere or far apart', () => {
    const s = flyStretch(hill, [500, 2600, 2800, 3900])
    expect(s.what).toBe('The hairpins')
    expect((s.from + s.to) / 2).toBeCloseTo(2700, -1)
    expect(flyStretch(hill, [500, 900]).what).toBe('The summit')
    expect(flyStretch(hill, [2100, 3900]).what).toBe('The summit')
  })

  it('falls back to the steepest stretch, then the middle of the road', () => {
    // 3% for 300 m is too short to be a climb but is the steepest thing there.
    const bump = route(4000, (d) => Math.min(24, Math.max(0, (d - 1000) * 0.03)) * 2)
    const s = flyStretch(bump)
    expect(s.what).toBe('The steep bit')
    expect(s.from).toBeLessThanOrEqual(1400)
    expect(s.to).toBeGreaterThanOrEqual(1000)
    const flat = flyStretch(route(4000, () => 5))
    expect(flat).toEqual({ from: 2000 - span / 2, to: 2000 + span / 2, what: 'The road' })
  })

  it('stays on a route shorter than the sweep', () => {
    const s = flyStretch(route(300, () => 5))
    expect([s.from, s.to]).toEqual([0, 300])
  })

  it('samples a profile end to end', () => {
    const p = profileSample(hill, 11)
    expect(p).toHaveLength(11)
    expect([p[0], p[10]]).toEqual([0, 120])
  })
})

describe('route lines', () => {
  it('has a line for every bundled route and nothing else', () => {
    expect(Object.keys(ROUTE_LINES).sort()).toEqual(ROUTE_INDEX.map((r) => r.id).sort())
    for (const line of Object.values(ROUTE_LINES)) expect(line.length).toBeLessThan(110)
  })
  it('gives an imported route a spare line, the same one each time', () => {
    expect(routeLine('my-abc')).toBe(routeLine('my-abc'))
    expect(routeLine('my-abc').length).toBeGreaterThan(10)
  })
})
