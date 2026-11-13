import { describe, expect, it } from 'vitest'
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
})
