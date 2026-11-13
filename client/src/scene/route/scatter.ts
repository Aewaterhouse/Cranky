import { noise2 } from '../math'
import { VIS } from '../params'
import type { Features } from './features'
import type { Cover, LandCover } from './landCover'
import type { P3, Patch } from './patch'

const R = VIS.route
const P = R.place
export const KINDS = [
  'gum',
  'scribbly',
  'snowgum',
  'fern',
  'teatree',
  'shrub',
  'tussock',
  'boulder',
] as const
export type Kind = (typeof KINDS)[number]
/** The kinds that are trees: they keep further from the road, cast shadows and stop at the treeline. */
export const TREES: readonly Kind[] = ['gum', 'scribbly', 'snowgum', 'teatree']

/** One plant: where, which, how big, which way round and a 0..1 number for its tint. */
export interface Spot extends P3 {
  kind: Kind
  s: number
  rot: number
  tint: number
}

/** Small fast seeded random numbers (mulberry32), so a chunk always grows the same plants. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_TREES = Math.max(...Object.values(P.trees))
const MAX_UNDER = Math.max(...Object.values(P.under))

/** Which tree grows at this spot, or nothing: by cover, height against the treeline, and nearness to the coast. */
function tree(cover: LandCover, c: Cover, p: P3, rand: () => number): Kind | undefined {
  const over = p.y - cover.treeline
  if (over > rand() * P.treelineFade) return undefined
  if (over > -P.snowGumBelow) return 'snowgum'
  if (p.y < P.coastM)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if ('aw'.includes(cover.at(p.x + dx * P.coastProbe, p.z + dz * P.coastProbe, p.y)))
        return 'teatree'
  return rand() < (c === 'f' ? 0.7 : c === 'b' ? 0.5 : 0.35) ? 'gum' : 'scribbly'
}

/** Which small plant grows at this spot. */
function under(cover: LandCover, c: Cover, p: P3, rand: () => number): Kind {
  const r = rand()
  if (p.y > cover.treeline) return r < 0.3 ? 'boulder' : r < 0.7 ? 'tussock' : 'shrub'
  if (c === 'f')
    return p.y < P.fernMax && noise2(p.x / 200 + 2, p.z / 200) > 0.45 && r < 0.75 ? 'fern' : 'shrub'
  if (c === 'r') return r < 0.6 ? 'boulder' : 'tussock'
  if (c === 'g' || c === 'a') return 'tussock'
  if (c === 'p' || c === 'u') return 'shrub'
  return r < 0.55 ? 'shrub' : 'tussock'
}

/**
 * The plants of chunk `k`, scattered cell by cell over its terrain patches so every one stands on drawn ground
 * that belongs to this stretch of road. Never on the road, a side street, a building or water.
 */
export function scatter(
  k: number,
  patches: Patch[],
  cover: LandCover,
  features: Features,
  detail: number,
  reach: number,
): Spot[] {
  const out: Spot[] = []
  const p: P3 = { x: 0, y: 0, z: 0 }
  for (const pt of patches) {
    const { offs, NI, NC, full } = pt
    const cell = (j0: number, j1: number, c: number) => {
      const far = c >= NI - 1
      const wide = offs[c + 1] - offs[c]
      const small = offs[c] < P.underReach
      const perHa = MAX_TREES * (far ? P.farThin : 1) + (small ? MAX_UNDER : 0)
      const rand = rng(((k * 2 + (pt.side + 1) / 2) * 131 + j0) * 67 + c)
      const want = ((j1 - j0) * R.rowStep * wide * perHa * detail) / 10000
      for (let n = Math.floor(want + rand()); n > 0; n--) {
        const isTree = rand() * perHa < MAX_TREES * (far ? P.farThin : 1)
        const v = rand()
        // Keep clear of the verge: trees further than grass.
        if (c === 0 && v * wide < (isTree ? P.treeClear : P.underClear)) continue
        if (!pt.point(j0, j1, c, rand(), v, p)) continue
        const cv = cover.at(p.x, p.z, p.y)
        const dens = isTree ? P.trees[cv] / MAX_TREES : P.under[cv] / MAX_UNDER
        if (rand() >= dens) continue
        const kind = isTree ? tree(cover, cv, p, rand) : under(cover, cv, p, rand)
        if (!kind) continue
        if (isTree) {
          // Not on the lip where this ground meets another stretch of road.
          if ((pt.cut[j0] && pt.end[j0] === c + 1) || (pt.cut[j1] && pt.end[j1] === c + 1)) continue
          const i = pt.at(j0, c)
          if (Math.abs(pt.p[i + 4] - pt.p[i + 1]) > P.treeSlope * wide) continue
        }
        if (features.blocked(p.x, p.z, isTree ? P.streetClear : 0.5)) continue
        out.push({
          x: p.x,
          y: p.y,
          z: p.z,
          kind,
          s: (0.75 + rand() * 0.6) * (far ? P.farScale : 1),
          rot: rand() * Math.PI * 2,
          tint: rand(),
        })
      }
    }
    for (let j = 0; j < pt.rows; j++)
      for (let c = 0; c < NI - 1 && offs[c] < reach; c++) cell(j, j + 1, c)
    for (let f = 0; f < full.length - 1; f++)
      for (let c = NI - 1; c < NC - 1 && offs[c] < reach; c++) cell(full[f], full[f + 1], c)
  }
  return out
}
