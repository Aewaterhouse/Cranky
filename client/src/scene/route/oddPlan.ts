import { VIS } from '../params'
import type { Features } from './features'
import { FUN, type OddDef } from './funVis'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { newPose } from './roadPath'
import { rng } from './scatter'

const R = VIS.route
const O = FUN.odd
const pose = newPose()

export type OddKind = keyof typeof O.kinds
export const ODD_KINDS = Object.keys(O.kinds) as OddKind[]
const BIG = ODD_KINDS.filter((k) => k.startsWith('big'))
const DEFS: Record<OddKind, OddDef> = O.kinds

/** A roadside oddity: where along and beside the road, which way its front (+z) points, and what its sign says. */
export interface Oddity {
  kind: OddKind
  d: number
  side: -1 | 1
  x: number
  z: number
  face: number
  r: number
  text?: string
  /** 0..1: quality levels below full keep only the low ranks. */
  rank: number
}

/** A number from a string, so a route's id seeds its jokes. */
export function seedOf(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Picks from `list` by weight with `u` in 0..1. */
export function weighted<T>(list: readonly T[], w: (t: T) => number, u: number): T | undefined {
  let left = u * list.reduce((s, t) => s + w(t), 0)
  for (const t of list) if ((left -= w(t)) < 0) return t
  return list[list.length - 1]
}

/** True when a kind may stand at a spot with this cover, above the snowline or not, by the coast, with a view. */
export function allowed(def: OddDef, cover: string, snow: boolean, coast: boolean, view: boolean) {
  if (!def.on.includes(cover)) return false
  const s = def.snow ?? -1
  if (snow ? s < 0 : s > 0) return false
  if (def.coast && !coast) return false
  return !def.view || view || cover === 'a'
}

/**
 * The oddities of a route, worked out a chunk at a time from the route's seed so everyone sees the same ones:
 * roughly one every few hundred metres, more in town, each suited to the ground it stands on and never on a
 * road, side street, building or water.
 */
export class Oddities {
  private cache = new Map<number, Oddity[]>()
  private seed: number
  private bigAt: number

  constructor(
    id: string,
    private field: HeightField,
    private cover: LandCover,
    private features: Features,
  ) {
    this.seed = seedOf(id)
    const rand = rng(this.seed)
    this.bigAt = Math.floor(((O.bigFrom + rand() * O.bigSpan) * field.path.length) / R.chunk)
  }

  /** Oddities whose spot along the road falls in chunk `k`, in road order. */
  chunk(k: number): Oddity[] {
    let list = this.cache.get(k)
    if (!list) this.cache.set(k, (list = this.plan(k)))
    return list
  }

  /** Forgets what was planned, for when the tunables change. */
  clear() {
    this.cache.clear()
  }

  /** The first oddity more than `d` metres along, looking at most `reach` metres ahead. */
  next(d: number, reach = 20000): Oddity | undefined {
    for (let k = Math.floor(d / R.chunk); k * R.chunk < d + reach; k++)
      for (const o of this.chunk(k)) if (o.d > d) return o
    return undefined
  }

  private plan(k: number): Oddity[] {
    const { field, cover } = this
    const { path } = field
    const d0 = k * R.chunk
    if (k < 0 || d0 >= path.length) return []
    const rand = rng(this.seed + k * 7919)
    path.poseAt(d0 + R.chunk / 2, pose)
    const town = cover.at(pose.x, pose.z, pose.y) === 'u'
    const big = k === this.bigAt
    const out: Oddity[] = []
    for (
      let n = Math.floor(R.chunk / (town ? O.townGap : O.gap) + rand()) + (big ? 1 : 0);
      n > 0;
      n--
    )
      for (let t = O.tries * (big && n === 1 ? 3 : 1); t > 0; t--) {
        const o = this.spot(rand, d0, big && n === 1)
        if (!o || out.some((p) => Math.hypot(p.x - o.x, p.z - o.z) < p.r + o.r + 2)) continue
        out.push(o)
        break
      }
    return out.sort((a, b) => a.d - b.d)
  }

  /** One try at an oddity somewhere in the chunk from `d0`; nothing when the spot will not do. */
  private spot(rand: () => number, d0: number, big: boolean): Oddity | undefined {
    const { field, cover, features } = this
    const { path } = field
    const [ud, us, uk, uo, ut, rank] = [rand(), rand(), rand(), rand(), rand(), rand()]
    const d = d0 + ud * R.chunk
    if (d < O.endClear || d > path.length - O.endClear) return undefined
    const side = us < 0.5 ? -1 : 1
    const edge = R.roadHalf + R.verge
    const { x: px, z: pz, rx, rz } = path.poseAt(d, pose)
    const at = (o: number) => [px + rx * side * o, pz + rz * side * o] as const
    const what = (o: number) => {
      const [x, z] = at(o)
      return cover.at(x, z, field.ground(x, z))
    }
    const [x0, z0] = at(edge + 2)
    const y0 = field.ground(x0, z0)
    const c = cover.at(x0, z0, y0)
    const coast = [-O.coastProbe, -O.coastProbe / 2, O.coastProbe / 2, O.coastProbe].some((o) =>
      'aw'.includes(what(o)),
    )
    const [vx, vz] = at(edge + O.viewProbe)
    const view = field.ground(vx, vz) < y0 - O.viewDrop
    const kinds = (
      O.only === '*'
        ? [ODD_KINDS[Math.floor(d / 25) % ODD_KINDS.length]]
        : O.only
          ? [O.only as OddKind]
          : big
            ? BIG
            : ODD_KINDS
    ).filter((q) => O.only || allowed(DEFS[q], c, y0 > R.snowLine, coast, view))
    const kind = weighted(kinds, (q) => DEFS[q].w, uk)
    if (!kind) return undefined
    const def = DEFS[kind]
    const o = edge + def.r * O.size + def.near + uo * (def.far - def.near)
    const [x, z] = at(o)
    const y = field.ground(x, z)
    // Not where another stretch of road is nearer, not on a street, building or water, not on a steep bank.
    if (!field.clear(x, z, o - def.r) || features.blocked(x, z, def.r + 1)) return undefined
    if (y < R.seaLevel + 0.3 || !(O.only || def.on.includes(cover.at(x, z, y)))) return undefined
    const [ax, az] = at(o - def.r)
    const [bx, bz] = at(o + def.r)
    if (Math.abs(field.ground(ax, az) - field.ground(bx, bz)) > O.slope * def.r * 2)
      return undefined
    // Front towards the road a little way back, so an approaching rider sees its face.
    const back = path.poseAt(Math.max(0, d - O.faceAhead), pose)
    return {
      kind,
      d,
      side,
      x,
      z,
      face: Math.atan2(back.x - x, back.z - z),
      r: def.r * O.size,
      text: def.text?.[Math.floor(ut * def.text.length)],
      rank,
    }
  }
}
