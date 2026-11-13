import { describe, expect, it } from 'vitest'
import { lapsDefault, lapsMax, withLaps } from '../src/core/route'
import { ROUTE_INDEX, loadRoute } from '../src/core/routeLibrary'

describe('bundled route packs', () => {
  it('has the first ten routes', () => expect(ROUTE_INDEX.length).toBeGreaterThanOrEqual(10))

  it.each(ROUTE_INDEX.map((r) => [r.id, r] as const))(
    '%s loads and matches its card',
    async (id, card) => {
      const route = await loadRoute(id)
      expect(route.region).toBe(card.region)
      expect(route.points[0].lat).toBeDefined()
      expect(Math.abs(route.distance / 1000 - card.km)).toBeLessThan(card.km * 0.02 + 0.05)
      expect(Math.abs(route.ascent - card.gainM)).toBeLessThan(card.gainM * 0.03 + 5)
      expect(Math.max(...route.points.map((p) => Math.abs(p.grade)))).toBeLessThanOrEqual(20)
    },
  )

  it('rides a loop for several laps as one long route', async () => {
    const lap = await loadRoute('nundah-crit')
    expect(lap.loop).toBe(true)
    const ride = withLaps(lap, 5)
    expect(ride.distance).toBe(lap.distance * 5)
    expect(ride.ascent).toBe(lap.ascent * 5)
    expect(ride.lapOf).toBe(lap)
    const ds = ride.points.map((p) => p.d)
    expect(ds.every((d, i) => i === 0 || d > ds[i - 1])).toBe(true)
    expect(ds[ds.length - 1]).toBe(ride.distance)
    expect(withLaps(lap, 1)).toBe(lap)
    expect(lapsDefault(lap)).toBeGreaterThan(5)
    expect(withLaps(lap, 1000).distance).toBe(lap.distance * lapsMax(lap))
  })
})
