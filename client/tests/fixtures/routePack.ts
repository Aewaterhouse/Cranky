import type { RoutePack } from '../../src/core/routeLibrary'

/** Roughly 1.1 km north, climbing 50 m, one point every ~111 m. */
export const FIXTURE_PACK: RoutePack = {
  id: 'test-hill',
  name: 'Test Hill',
  region: 'VIC',
  blurb: 'A fixture.',
  published: { km: 1.1, gainM: 50, source: 'test' },
  pts: Array.from({ length: 11 }, (_, i) => [-37 + i * 0.001, 145, 100 + i * 5]),
}
