import { buildRoute, type RouteFeatures, type TerrainData } from '../src/core/route'
import { Features } from '../src/scene/route/features'
import { HeightField } from '../src/scene/route/heightField'
import { LandCover } from '../src/scene/route/landCover'
import { RoadPath } from '../src/scene/route/roadPath'
import { TerrainGrid } from '../src/scene/route/terrainGrid'

const LAT0 = -37
const LON0 = 145

/**
 * A made-up world for the roadside tests: `km` of road dead north from grid point (600, 600), over level ground
 * `h` high with `cover(east, north)` land cover; the road's own height comes from `ele(d)`.
 */
export function funWorld(
  km: number,
  h: number,
  cover: (e: number, n: number) => string,
  features?: RouteFeatures,
  ele: (d: number) => number = () => h,
) {
  const cols = 30
  const rows = Math.ceil((km * 1000 + 1200) / 60)
  const t: TerrainData = {
    cell: 60,
    lat0: LAT0 - 600 / 110540,
    lon0: LON0 - 600 / (111320 * Math.cos((LAT0 * Math.PI) / 180)),
    cols,
    rows,
    runs: Array.from({ length: rows }, () => [[0, Array(cols).fill(h)]]),
    cover: Array.from({ length: rows }, (_, r) => [
      Array.from({ length: cols }, (_, c) => cover(c * 60, r * 60)).join(''),
    ]),
  }
  const raw = Array.from({ length: km * 100 + 1 }, (_, i) => ({
    d: i * 10,
    lat: LAT0 + (i * 10) / 110540,
    lon: LON0,
    ele: ele(i * 10),
  }))
  const route = buildRoute('fun', 'Fun', raw)
  const path = new RoadPath(route, t)
  const field = new HeightField(path, new TerrainGrid(t))
  return {
    route,
    path,
    field,
    cover: new LandCover(t),
    features: new Features(features, field),
  }
}
