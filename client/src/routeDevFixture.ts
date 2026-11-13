import type { Route, RouteFeatures } from './core/route'
import { hash, noise2 } from './scene/math'
import { project } from './scene/route/roadPath'

const NAMES = ['Wombat St', 'Galah Cres', 'Banksia Ave', 'Old Tip Rd', 'Dunny Lane', 'Lookout Rd']

/**
 * Made-up map features for the route harness (`fixture=1`): land cover in big noisy zones with the odd lake, a
 * side street every 250 m with houses along it, and a peak, lookout, tower and cafe. Stands in for real pack data.
 */
export function addFixture(route: Route) {
  const t = route.terrain
  if (!t) return
  t.cover = t.runs.map(
    (row, r) =>
      row?.map(([c0, hs]) =>
        hs
          .map((_, i) => {
            const [e, n] = [(c0 + i) * t.cell, r * t.cell]
            const lake = noise2(e / 400 + 7, n / 400)
            if (lake > 0.8) return 'w'
            if (lake > 0.74) return 'a'
            const zone = noise2(e / 900, n / 900)
            return zone < 0.32
              ? 'u'
              : zone < 0.42
                ? 'p'
                : zone < 0.55
                  ? 'g'
                  : zone < 0.63
                    ? 's'
                    : zone < 0.8
                      ? 'f'
                      : 'b'
          })
          .join(''),
      ) ?? null,
  )
  const f: Required<RouteFeatures> = { roads: [], buildings: [], pois: [] }
  const at = (d: number) => {
    const i = Math.min(route.points.length - 2, Math.max(1, Math.round(d / route.points[1].d)))
    const xy = (j: number) => project(route.points[j].lat!, route.points[j].lon!, t.lat0, t.lon0)
    const [e, n] = xy(i)
    const [e0, n0] = xy(i - 1)
    const [e1, n1] = xy(i + 1)
    const len = Math.hypot(e1 - e0, n1 - n0) || 1
    return { e, n, fe: (e1 - e0) / len, fn: (n1 - n0) / len }
  }
  for (let d = 250, k = 0; d < route.distance; d += 250, k++) {
    const { e, n, fe, fn } = at(d)
    // Right of travel is (fn, -fe) in east/north.
    const s = k % 2 ? 1 : -1
    const [re, rn] = [fn * s, -fe * s]
    const main = k % 4 === 3
    const from = main ? -180 : 0
    f.roads.push({
      n: NAMES[k % NAMES.length],
      k: main ? 'main' : 'street',
      p: [from, 60, 120, 180].map((o) => [Math.round(e + re * o), Math.round(n + rn * o)]),
    })
    const rot = (Math.atan2(rn, re) * 180) / Math.PI
    for (let o = 22; o < 170; o += 21)
      for (const side of [-1, 1]) {
        const h = hash(d + o * side)
        f.buildings.push([
          Math.round(e + re * o + fe * side * 13),
          Math.round(n + rn * o + fn * side * 13),
          10 + h * 6,
          8 + hash(h) * 3,
          rot,
          3.2 + (h > 0.8 ? 3.5 : h),
        ])
      }
  }
  const poi = (
    k: 'peak' | 'viewpoint' | 'tower' | 'cafe',
    name: string,
    frac: number,
    o: number,
  ) => {
    const { e, n, fe, fn } = at(route.distance * frac)
    f.pois.push({ n: name, k, at: [Math.round(e + fn * o), Math.round(n - fe * o)] })
  }
  poi('cafe', 'The Flat White', 0.1, 18)
  poi('viewpoint', 'Sore Legs Lookout', 0.2, -16)
  poi('tower', '', 0.2, 140)
  poi('tower', '', 0.21, 170)
  poi('peak', 'Mount Fixture', 0.2, 60)
  route.features = f
}
