import { VIS } from '../params'
import type { Features } from './features'
import { FUN } from './funVis'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { allowed, jokeCover, seedOf, weighted } from './oddPlan'
import { newPose } from './roadPath'
import { rng } from './scatter'

const R = VIS.route
const L = FUN.life
const pose = newPose()

export type LifeKind = keyof typeof L.kinds
export const LIFE_KINDS = Object.keys(L.kinds) as LifeKind[]
/** Things that happen on the road itself rather than standing beside it. */
export const TRAFFIC: readonly LifeKind[] = ['ute', 'caravan', 'coach']
const MOBS = LIFE_KINDS.filter((k) => k !== 'magpie' && !TRAFFIC.includes(k))

/**
 * A mob, flock, crossing animal, swooping magpie or oncoming vehicle: where along and beside the road it starts,
 * how many, and a seed for laying out its members.
 */
export interface Herd {
  id: number
  kind: LifeKind
  d: number
  side: -1 | 1
  x: number
  z: number
  n: number
  seed: number
  /** 0..1: quality levels below full keep only the low ranks. */
  rank: number
}

/**
 * The wildlife and traffic of a route, a chunk at a time from the route's seed so everyone meets the same
 * animals: at most one mob or flock per chunk, suited to the land, and now and then a magpie or a vehicle.
 */
export class LifePlan {
  private cache = new Map<number, Herd[]>()
  private cover: Pick<LandCover, 'at'>
  private seed: number
  private alpine: boolean

  constructor(
    id: string,
    private field: HeightField,
    cover: LandCover,
    private features: Features,
  ) {
    this.seed = seedOf(id) ^ 0x11fe
    this.cover = jokeCover(id, cover)
    let top = -Infinity
    for (const y of field.path.y) top = Math.max(top, y)
    this.alpine = top >= L.coachAbove
  }

  chunk(k: number): Herd[] {
    let list = this.cache.get(k)
    if (!list) this.cache.set(k, (list = this.plan(k)))
    return list
  }

  clear() {
    this.cache.clear()
  }

  /** Where the first herd (of `kind`, if given) starts after `d` metres. */
  next(d: number, kind?: string): Herd | undefined {
    const last = Math.ceil(this.field.path.length / R.chunk)
    for (let k = Math.max(0, Math.floor(d / R.chunk)); k <= last; k++)
      for (const h of this.chunk(k)) if (h.d > d && (!kind || h.kind === kind)) return h
    return undefined
  }

  private plan(k: number): Herd[] {
    const { field, cover, features } = this
    const { path } = field
    const d0 = k * R.chunk
    if (k < 0 || d0 >= path.length) return []
    const rand = rng(this.seed + k * 6151)
    const out: Herd[] = []
    const edge = R.roadHalf + R.verge
    const add = (kind: LifeKind, d: number, side: -1 | 1, x: number, z: number) => {
      const def = L.kinds[kind]
      const n = def.min + Math.floor(rand() * (def.max - def.min + 1))
      out.push({ id: k * 4 + out.length, kind, d, side, x, z, n, seed: rand() * 1e6, rank: rand() })
    }
    // A mob or flock off to one side, of a kind that suits the ground it stands on.
    if (rand() < L.chance)
      for (let t = L.tries; t > 0; t--) {
        const d = d0 + rand() * R.chunk
        const side = rand() < 0.5 ? -1 : 1
        const [uk, uo] = [rand(), rand()]
        if (d < L.endClear || d > path.length - L.endClear) continue
        const { x: px, z: pz, rx, rz } = path.poseAt(d, pose)
        const at = (o: number) => [px + rx * side * o, pz + rz * side * o] as const
        const here = (o: number) => {
          const [x, z] = at(o)
          return cover.at(x, z, field.ground(x, z))
        }
        const [x0, z0] = at(edge + 12)
        const y0 = field.ground(x0, z0)
        const c = cover.at(x0, z0, y0)
        const coast = [L.coastProbe / 2, L.coastProbe].some((o) => 'aw'.includes(here(o)))
        const kinds = MOBS.filter((q) => allowed(L.kinds[q], c, y0 > R.snowLine, coast, false))
        const kind = weighted(kinds, (q) => L.kinds[q].w, uk)
        if (!kind) continue
        const def = L.kinds[kind]
        const o = edge + def.near + uo * (def.far - def.near)
        const [x, z] = at(o)
        const y = field.ground(x, z)
        if (!field.clear(x, z, o - def.r) || features.blocked(x, z, def.r)) continue
        if (y < R.seaLevel + 0.3 || !def.on.includes(cover.at(x, z, y))) continue
        if (
          Math.abs(field.ground(...at(o + def.r)) - field.ground(...at(o - def.r))) >
          L.slope * def.r * 2
        )
          continue
        add(kind, d, side, x, z)
        break
      }
    // On the road: a magpie with a grudge, or something coming the other way.
    const mid = d0 + R.chunk / 2
    if (mid > L.endClear && mid < path.length - L.endClear) {
      const { x, y, z } = path.poseAt(mid, pose)
      const [um, ut, uk] = [rand(), rand(), rand()]
      if (um < L.magpieChance && L.kinds.magpie.on.includes(cover.at(x, z, y)) && y < R.snowLine)
        add('magpie', mid, 1, x, z)
      else if (ut < L.trafficChance) {
        const kinds = TRAFFIC.filter((q) => q !== 'coach' || this.alpine)
        add(
          weighted(kinds, (q) => L.kinds[q].w, uk)!,
          mid,
          1,
          x,
          z,
        )
      }
    }
    return out.sort((a, b) => a.d - b.d)
  }
}

/** Where member `i` of a herd stands relative to its centre, and which way it faces: [dx, dz, yaw]. */
export function member(h: Herd, i: number, out: number[]): number[] {
  const rand = rng(h.seed + i * 977)
  const a = rand() * Math.PI * 2
  const r = L.kinds[h.kind].r * Math.sqrt(rand())
  out[0] = Math.cos(a) * r
  out[1] = Math.sin(a) * r
  out[2] = rand() * Math.PI * 2
  return out
}

/**
 * Metres from the centreline for a crossing animal that started at `o0` on its own verge `tt` seconds ago, when
 * the rider was `ahead0` metres short and is now `ahead` short. It ambles at `ms`, and breaks into a trot if
 * that would leave it on the road when the rider arrives: it is always across by `crossClear` metres out.
 */
export function crossAt(o0: number, tt: number, ms: number, ahead0: number, ahead: number): number {
  const hurry = (ahead0 - ahead) / Math.max(1, ahead0 - L.crossClear)
  const trot = o0 - Math.min(1, Math.max(0, hurry)) * (o0 + R.roadHalf + R.verge)
  return Math.max(-L.crossTo, Math.min(o0 - Math.max(0, tt) * ms, trot))
}
