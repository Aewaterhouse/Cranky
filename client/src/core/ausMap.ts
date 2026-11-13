import { CFG } from '../config'

/**
 * A stylised Australia for the route passport, drawn by hand from a few dozen [longitude, latitude] corners:
 * states roughly right, gulfs and bays mostly ironed out. Not for navigation.
 */
type LL = [lon: number, lat: number]

// prettier-ignore
export const MAINLAND: LL[] = [
  [115.0, -34.3], [115.7, -32.0], [114.9, -29.5], [114.0, -27.0], [113.4, -25.5], [113.7, -23.5],
  [114.1, -21.8], [116.7, -20.6], [119.0, -20.0], [121.5, -18.8], [122.2, -17.9], [123.6, -17.3],
  [123.6, -16.2], [125.0, -15.0], [126.5, -14.0], [127.8, -14.4], [128.4, -14.9], [129.6, -14.9],
  [129.8, -13.5], [130.8, -12.4], [132.6, -12.1], [132.6, -11.3], [135.0, -12.2], [136.9, -12.3],
  [136.0, -13.8], [135.5, -15.0], [137.5, -16.0], [139.3, -17.5], [140.9, -17.5], [141.4, -16.0],
  [141.7, -14.0], [141.8, -12.5], [142.5, -10.7], [143.4, -12.6], [143.8, -14.4], [145.3, -15.0],
  [145.4, -16.5], [146.1, -18.0], [146.8, -19.2], [148.3, -20.1], [149.2, -21.2], [150.8, -23.1],
  [151.3, -23.9], [152.9, -25.3], [153.2, -26.0], [153.2, -27.4], [153.6, -28.6], [153.1, -30.3],
  [152.9, -31.5], [151.8, -32.9], [151.3, -33.9], [150.9, -34.8], [150.2, -36.0], [149.9, -37.5],
  [148.0, -37.9], [146.4, -39.1], [145.0, -38.4], [143.5, -38.8], [141.6, -38.4], [140.4, -38.0],
  [139.7, -36.9], [139.4, -35.9], [138.5, -35.6], [138.5, -34.9], [137.9, -33.0], [136.0, -34.8],
  [135.2, -33.8], [134.2, -32.7], [133.6, -32.1], [131.2, -31.5], [129.0, -31.7], [126.0, -32.3],
  [124.0, -33.0], [123.5, -33.9], [120.0, -33.9], [118.0, -35.1], [116.0, -34.9],
]
// prettier-ignore
export const TASMANIA: LL[] = [
  [144.7, -40.7], [146.5, -41.1], [148.3, -40.9], [148.3, -42.2], [147.9, -43.2], [146.8, -43.6],
  [146.0, -43.5], [145.2, -42.2], [144.7, -41.2],
]
/** State borders, each a line of corners. */
// prettier-ignore
export const BORDERS: LL[][] = [
  [[129, -14.9], [129, -31.7]],
  [[129, -26], [141, -26]],
  [[138, -16.4], [138, -26]],
  [[141, -26], [141, -38.2]],
  [[141, -29], [149, -29], [150.3, -28.6], [151.9, -28.9], [152.5, -28.3], [153.5, -28.2]],
  [[141, -34], [142.5, -34.7], [143.6, -35.4], [144.9, -36.1], [146.9, -36.1], [148.2, -36.8], [149.9, -37.5]],
]
/** Where each state's label sits. */
export const STATES: Record<string, LL> = {
  WA: [121.5, -26],
  NT: [133.5, -20],
  SA: [135, -29],
  QLD: [144.5, -23],
  NSW: [146.5, -32.3],
  VIC: [143.8, -37.1],
  TAS: [146.6, -42.3],
}
/** Where each bundled route starts (`tests/passport.test.ts` fails if a pack moves or a new route is missing). */
export const ROUTE_AT: Record<string, LL> = {
  'akuna-bay': [151.23, -33.683],
  'beach-road': [144.973, -37.863],
  'ben-lomond': [147.535, -41.478],
  'darren-smith': [152.59, -28.072],
  'falls-creek': [147.17, -36.744],
  'full-gas-friday': [153.01, -27.469],
  'great-ocean-road': [143.975, -38.542],
  'metros-road-race': [152.63, -27.939],
  mondo: [152.992, -27.446],
  'mount-buffalo': [146.853, -36.7],
  'mount-coot-tha-back': [152.966, -27.465],
  'mount-coot-tha': [152.982, -27.478],
  'mount-hotham': [147.063, -36.894],
  'mount-wellington': [147.26, -42.922],
  'nundah-crit': [153.068, -27.409],
  'howick-street-crit': [147.143, -41.446],
  'willunga-hill': [138.562, -35.276],
}

const M = CFG.passport.map
/** Longitude and latitude to map units: plain degrees, squeezed east-west for the latitude of the middle. */
export const mapXY = ([lon, lat]: LL): [number, number] => [
  (lon - M.west) * M.squeeze * M.scale,
  (-lat - M.north) * M.scale,
]
export const MAP_SIZE = mapXY([M.east, -M.south])

/** Kilometres between two places, near enough for "is this route in Brisbane". */
export const kmBetween = (a: LL, b: LL) =>
  Math.hypot((a[0] - b[0]) * 111.3 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110.6)

/**
 * Nudges dots apart until none are closer than `gap`, so a city's worth of routes can each be seen. Every dot
 * is also pulled gently back to where it belongs. The same dots always land in the same places.
 */
export function spread(at: [number, number][], gap: number, rounds = 80): [number, number][] {
  const p = at.map(([x, y]) => [x, y] as [number, number])
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j][0] - p[i][0]
        let dy = p[j][1] - p[i][1]
        let d = Math.hypot(dx, dy)
        if (d >= gap) continue
        // Dots on the same spot part along a direction set by their order, not by chance.
        if (d < 1e-6) [dx, dy, d] = [Math.cos(i + j), Math.sin(i + j), 1]
        const push = (gap - d) / 2
        p[i][0] -= (dx / d) * push
        p[i][1] -= (dy / d) * push
        p[j][0] += (dx / d) * push
        p[j][1] += (dy / d) * push
      }
    for (let i = 0; i < p.length; i++) {
      p[i][0] += (at[i][0] - p[i][0]) * 0.02
      p[i][1] += (at[i][1] - p[i][1]) * 0.02
    }
  }
  return p
}
