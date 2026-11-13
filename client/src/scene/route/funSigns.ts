import { CHALK_LINES, type ChalkTag } from '../../fun/chalkLines'
import { SIGN_LINES, type SignTag } from '../../fun/signLines'
import { VIS } from '../params'
import type { Features } from './features'
import { hairpins, ramps } from './furniture'
import { FUN } from './funVis'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { seedOf } from './oddPlan'
import { newPose } from './roadPath'
import { rng } from './scatter'

const R = VIS.route
const S = FUN.signs
const C = FUN.chalk
const pose = newPose()

/** A one-liner on a board beside the road. */
export interface FunSign {
  d: number
  side: -1 | 1
  x: number
  z: number
  tag: SignTag
  /** Already wrapped into lines. */
  text: string
  council: boolean
}
/** A chalk message across the road at `d`, top line furthest away. `tint` picks the chalk colour. */
export interface Chalk {
  d: number
  text: string
  tint: number
}

/** Breaks `text` into at most `lines` lines of about `width` letters, widening only when it must. */
export function wrap(text: string, width = S.wrap, lines = 3): string {
  for (let w = width; ; w++) {
    const out: string[] = []
    for (const word of text.split(' ')) {
      const last = out[out.length - 1]
      if (last !== undefined && last.length + 1 + word.length <= w)
        out[out.length - 1] += ` ${word}`
      else out.push(word)
    }
    if (out.length <= lines) return out.join('\n')
  }
}

/** Deals lines from a pool in a seeded shuffled order, going round again only when every one has been used. */
export function dealer<T extends readonly [string, string, ...unknown[]]>(
  pool: readonly T[],
  rand: () => number,
) {
  const by = new Map<string, T[]>()
  for (const line of pool) by.set(line[1], [...(by.get(line[1]) ?? []), line])
  const used = new Map<string, number>()
  for (const list of by.values())
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
  return (tag: string): T | undefined => {
    const list = by.get(tag)
    const n = used.get(tag) ?? 0
    used.set(tag, n + 1)
    return list?.[n % list.length]
  }
}

/** Stretches where the gradient over `window` metres stays within [lo, hi] for at least `min` metres. */
export function stretches(
  path: { y: ArrayLike<number>; n: number; space: number },
  lo: number,
  hi: number,
  min: number,
  window = S.window,
): { d0: number; d1: number }[] {
  const { y, n, space } = path
  const w = Math.max(1, Math.round(window / 2 / space))
  const ok = (i: number) => {
    const a = Math.max(0, i - w)
    const b = Math.min(n - 1, i + w)
    const g = (y[b] - y[a]) / ((b - a) * space)
    return g >= lo && g <= hi
  }
  const out = []
  for (let i = 0; i < n; i++) {
    if (!ok(i)) continue
    let j = i
    while (j + 1 < n && ok(j + 1)) j++
    if ((j - i) * space >= min) out.push({ d0: i * space, d1: j * space })
    i = j
  }
  return out
}

const COVER_TAG: Record<string, SignTag> = {
  u: 'suburb',
  g: 'farm',
  f: 'bush',
  b: 'bush',
  s: 'bush',
  a: 'sea',
}
const byChunk = <T extends { d: number }>(list: T[]) => {
  const by = new Map<number, T[]>()
  for (const f of list) {
    const k = Math.floor(f.d / R.chunk)
    by.set(k, [...(by.get(k) ?? []), f])
  }
  return by
}

/**
 * Every funny sign on the route, by chunk. The ones tied to the road come first (before a ramp, after a hairpin,
 * on a false flat, at the top, 1 km to go, at the snowline, down at sea level), then fillers that suit the land
 * they stand on. None within `apart` of another or right beside a real sign (`taken` distances).
 */
export function planFunSigns(
  id: string,
  field: HeightField,
  cover: LandCover,
  features: Features,
  taken: number[],
): Map<number, FunSign[]> {
  const { path } = field
  const L = path.length
  const rand = rng(seedOf(id) ^ 0x51a7)
  const deal = dealer(SIGN_LINES, rand)
  const want: [number, SignTag][] = []
  for (const r of ramps(path)) want.push([r.d0 - S.rampAhead, 'ramp'])
  for (const h of hairpins(path)) want.push([h.d + S.hairpinAfter, 'hairpin'])
  if (L > S.togoMin) want.push([L - 1000 + S.nudge, 'togo'])
  let top = 0
  for (let i = 1; i < path.n; i++) if (path.y[i] > path.y[top]) top = i
  if (path.y[top] - path.y[0] >= R.place.furniture.summitGain)
    want.push([top * path.space + S.topAfter, 'top'])
  for (const f of stretches(path, S.falseMin, S.falseMax, S.falseLength))
    want.push([f.d0 + S.falseIn, 'falseflat'])
  for (const f of stretches(path, -1, -S.descentMin, S.descentLength))
    want.push([f.d0 + S.descentIn, 'descent'])
  for (let i = 1; i < path.n; i++)
    if (path.y[i] >= R.snowLine && path.y[i - 1] < R.snowLine) want.push([i * path.space, 'snow'])
  let dry = true
  for (let i = 0; i < path.n; i++) {
    const low = path.y[i] < S.seaBelow
    if (low && dry) want.push([Math.max(i * path.space + S.nudge, S.startAt + S.apart), 'sea'])
    dry = !low
  }
  want.push([S.startAt, 'start'])
  for (let d = S.first + rand() * S.gapMin; d < L; d += S.gapMin + rand() * (S.gapMax - S.gapMin)) {
    path.poseAt(d, pose)
    const tag = COVER_TAG[cover.at(pose.x, pose.z, pose.y)] ?? 'any'
    want.push([d, rand() < S.anyShare ? 'any' : tag])
  }

  const out: FunSign[] = []
  const edge = R.roadHalf + R.verge + S.out
  for (const [d, tag] of want) {
    if (d < S.endClear || d > L - S.endClear) continue
    if (out.some((s) => Math.abs(s.d - d) < S.apart)) continue
    if (taken.some((t) => Math.abs(t - d) < S.clearFurn)) continue
    const first = rand() < S.rightShare ? 1 : -1
    for (const side of [first, -first] as (-1 | 1)[]) {
      const { x: px, z: pz, rx, rz } = path.poseAt(d, pose)
      const [x, z] = [px + rx * side * edge, pz + rz * side * edge]
      if (!field.clear(x, z, edge) || features.blocked(x, z, S.pad)) continue
      if (cover.at(x, z, field.ground(x, z)) === 'w') continue
      const line = deal(tag)
      if (line) out.push({ d, side, x, z, tag, text: wrap(line[0]), council: line[2] === 'c' })
      break
    }
  }
  return byChunk(out)
}

/**
 * Chalk on the road, by chunk: every couple of hundred metres up each sustained ramp, with words that suit how
 * steep it is and how much is left, and the odd message on the flat. Not on the tightest bends.
 */
export function planChalk(id: string, path: HeightField['path']): Map<number, Chalk[]> {
  const rand = rng(seedOf(id) ^ 0xc4a1)
  const deal = dealer(CHALK_LINES, rand)
  const out: Chalk[] = []
  const add = (d: number, tag: ChalkTag, km = 0) => {
    if (d < C.endClear || d > path.length - C.endClear) return
    if (Math.abs(path.poseAt(d, pose).curv) > C.maxCurve) return
    const line = deal(tag)
    if (line) out.push({ d, text: line[0].replace('{km}', String(km)), tint: rand() })
  }
  const hills = ramps(path)
  for (const r of hills)
    for (
      let d = r.d0 + C.rampIn;
      d < r.d1 - C.rampOut;
      d += C.gapMin + rand() * (C.gapMax - C.gapMin)
    ) {
      const left = r.d1 - d
      const u = rand()
      const km = Math.round(left / 1000)
      if (left < C.topWithin) add(d, 'top')
      else if (km >= 1 && u < C.kmShare) add(d, 'km', km)
      else if (path.poseAt(d, pose).grade >= C.steep && u < C.steepShare) add(d, 'steep')
      else if (r.d1 - r.d0 >= C.long && u > 1 - C.longShare) add(d, 'long')
      else add(d, 'climb')
    }
  for (
    let d = C.flatGapMin * rand();
    d < path.length;
    d += C.flatGapMin + rand() * (C.flatGapMax - C.flatGapMin)
  ) {
    if (hills.some((r) => d > r.d0 - C.flatClear && d < r.d1 + C.flatClear)) continue
    if (Math.abs(path.poseAt(d, pose).grade) < C.flatGrade) add(d, 'flat')
  }
  return byChunk(out)
}
