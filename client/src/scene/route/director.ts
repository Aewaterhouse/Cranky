import { VIS } from '../params'
import type { Features } from './features'
import { planChalk, planFunSigns, type Chalk, type FunSign } from './funSigns'
import { FUN } from './funVis'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import type { LifePlan } from './lifePlan'
import { seedOf, weighted, type Oddities } from './oddPlan'
import { newPose } from './roadPath'
import { rng } from './scatter'

const R = VIS.route
const L = FUN.life
const D = L.director
export type FillKind = keyof typeof D.mix
const KINDS = Object.keys(D.mix) as FillKind[]
const pose = newPose()

/**
 * Spots to fill so that no gap between `marks` (route metres, any order), or from either end of a `length` m road,
 * is longer than `max`: evenly spread through each long gap, nudged a little either way.
 */
export function fillGaps(marks: number[], length: number, max: number, rand: () => number) {
  const at = [0, ...marks.filter((d) => d > 0 && d < length).sort((a, b) => a - b), length]
  const out: number[] = []
  for (let i = 1; i < at.length; i++) {
    const n = Math.ceil((at[i] - at[i - 1]) / (max * 0.9)) - 1
    const step = (at[i] - at[i - 1]) / (n + 1)
    for (let j = 1; j <= n; j++) out.push(at[i - 1] + j * step + (rand() - 0.5) * 0.1 * max)
  }
  return out
}

/**
 * The road-life director: plans the funny signs and chalk, then finds every stretch where nothing worth a look
 * (oddity, animal, landmark, sign, chalk, traffic) comes up for `maxS` seconds at riding speed, and fills it with
 * chalk (not on tight bends), a funny sign, or a vehicle coming the other way (handed to `life`). Seeded by route.
 */
export function planRoadLife(
  id: string,
  field: HeightField,
  cover: LandCover,
  features: Features,
  taken: number[],
  odd: Oddities,
  life: LifePlan,
  landmarks: Map<number, unknown[]>,
): { signs: Map<number, FunSign[]>; chalk: Map<number, Chalk[]> } {
  const { path } = field
  life.traffic = []
  life.clear()
  odd.clear()
  const marks: number[] = []
  for (let k = 0; k * R.chunk < path.length; k++) {
    for (const o of [...odd.chunk(k), ...life.chunk(k)]) if (o.rank < D.shown) marks.push(o.d)
    if (landmarks.get(k)?.length) marks.push((k + 0.5) * R.chunk)
  }
  for (const m of [planFunSigns(id, field, cover, features, taken), planChalk(id, path)])
    for (const list of m.values()) for (const t of list) marks.push(t.d)
  const rand = rng(seedOf(id) ^ 0xd1ec)
  const fill = { chalk: [] as number[], sign: [] as number[], traffic: [] as number[] }
  for (const d of fillGaps(marks, path.length, D.speed * D.maxS, rand)) {
    const kind = weighted(KINDS, (k) => D.mix[k], rand())!
    const bend = Math.abs(path.poseAt(d, pose).curv) > FUN.chalk.maxCurve
    fill[kind === 'chalk' && bend ? 'traffic' : kind].push(d)
  }
  const signs = planFunSigns(id, field, cover, features, taken, fill.sign)
  const placed = new Set([...signs.values()].flat().map((s) => s.d))
  // Oncoming traffic shows up `trafficSee` ahead and meets the rider part way: start it far enough on to meet here.
  const meet = (L.trafficSee * L.trafficMs) / (D.speed + L.trafficMs)
  life.traffic = [...fill.traffic, ...fill.sign.filter((d) => !placed.has(d))].map((d) => d + meet)
  life.clear()
  return { signs, chalk: planChalk(id, path, fill.chalk) }
}
