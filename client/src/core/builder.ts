import { CFG } from '../config'
import type { Block, BuilderBlock, Plan } from '../types'
import { blockTarget, parsePlan } from './plan'

export const KINDS: BuilderBlock['kind'][] = ['steady', 'ramp', 'intervals', 'sprint', 'free']
const MAX_PCT = Math.round(CFG.erg.capPct * 100)
const MIN_PCT = 20
const MAX_DUR = 4 * 3600
const clamp = (n: number, lo: number, hi: number) =>
  Math.round(Math.min(hi, Math.max(lo, Number(n) || lo)))

const DEFAULTS: Record<BuilderBlock['kind'], Omit<BuilderBlock, 'kind'>> = {
  steady: { dur: 300, pct: 75 },
  ramp: { dur: 300, pct: 50, pct2: 90 },
  intervals: { dur: 120, pct: 110, reps: 4, offDur: 60, offPct: 50 },
  sprint: { dur: 10 },
  free: { dur: 120 },
}
export const newBlock = (kind: BuilderBlock['kind']): BuilderBlock => ({
  kind,
  ...DEFAULTS[kind],
})

/** Forces every field into its safe range: ERG targets never pass the cap, sprints carry no target. */
export function clampBlock(b: BuilderBlock): BuilderBlock {
  const out: BuilderBlock = { kind: b.kind, dur: clamp(b.dur, 1, MAX_DUR) }
  if (b.kind === 'sprint') out.dur = clamp(b.dur, CFG.sprintDur.min, CFG.sprintDur.max)
  if (b.kind === 'steady' || b.kind === 'ramp' || b.kind === 'intervals')
    out.pct = clamp(b.pct ?? 0, MIN_PCT, MAX_PCT)
  if (b.kind === 'ramp') out.pct2 = clamp(b.pct2 ?? 0, MIN_PCT, MAX_PCT)
  if (b.kind === 'intervals') {
    out.reps = clamp(b.reps ?? 1, 1, 50)
    out.offDur = clamp(b.offDur ?? 1, 1, MAX_DUR)
    out.offPct = clamp(b.offPct ?? 0, MIN_PCT, MAX_PCT)
  }
  if (b.cad && b.cad[0] > 0 && b.cad[1] >= b.cad[0])
    out.cad = [clamp(b.cad[0], 30, 200), clamp(b.cad[1], 30, 200)]
  if (b.cue?.trim()) out.cue = b.cue.trim().slice(0, 80)
  return out
}

/** Moves the block at `from` to index `to` (new array). */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list
  const out = list.slice()
  out.splice(Math.min(Math.max(to, 0), list.length - 1), 0, out.splice(from, 1)[0])
  return out
}
export const duplicate = <T>(list: T[], i: number): T[] => [
  ...list.slice(0, i + 1),
  structuredClone(list[i]),
  ...list.slice(i + 1),
]
export const remove = <T>(list: T[], i: number): T[] => list.filter((_, n) => n !== i)

/** Builder blocks to plan blocks (intervals become a `set`). Cues and cadence ride on the work block. */
export function toPlanBlocks(list: BuilderBlock[]): Block[] {
  return list.map(clampBlock).map((b): Block => {
    const base = {
      dur: b.dur,
      ...(b.cad && { cad: b.cad }),
      ...(b.cue && { cues: [{ at: 0, text: b.cue }] }),
    }
    switch (b.kind) {
      case 'steady':
        return { type: 'steady', ...base, pct: b.pct! }
      case 'ramp':
        return { type: 'ramp', ...base, pct: [b.pct!, b.pct2!] }
      case 'intervals':
        return {
          type: 'set',
          dur: 0,
          rep: b.reps,
          blocks: [
            { type: 'steady', ...base, pct: b.pct! },
            { type: 'steady', dur: b.offDur!, pct: b.offPct! },
          ],
        }
      default:
        return { type: b.kind, ...base }
    }
  })
}

/** Why the workout can't be saved yet, or null. */
export function validate(name: string, list: BuilderBlock[]): string | null {
  if (!name.trim()) return 'Give the workout a name'
  if (!list.length) return 'Add at least one block'
  return null
}

/** The id comes from the name unless one is given, so saving again overwrites. */
export function buildPlan(name: string, list: BuilderBlock[], id?: string): Plan {
  const err = validate(name, list)
  if (err) throw new Error(err)
  const n = name.trim().slice(0, 60)
  const slug =
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'workout'
  const plan: Plan = {
    id: id ?? `my-${slug}`,
    name: n,
    desc: 'Built in the workout builder',
    blocks: toPlanBlocks(list),
    edit: list.map(clampBlock),
  }
  return { ...parsePlan(plan), edit: plan.edit }
}

/** Seconds, intensity factor (normalised power over FTP) and TSS. Sprints count as 120%, free as 50%. */
export function stats(list: BuilderBlock[]) {
  if (!list.length) return { total: 0, intensity: 0, tss: 0 }
  const flat = parsePlan({ id: 'x', name: 'x', blocks: toPlanBlocks(list) }).blocks
  let secs = 0
  let sum4 = 0
  for (const b of flat)
    for (let t = 0; t < b.dur; t++) {
      const f = b.type === 'sprint' ? 1.2 : b.type === 'free' ? 0.5 : blockTarget(b, 'hard', t)!
      sum4 += f ** 4
      secs++
    }
  const intensity = (sum4 / secs) ** 0.25
  return { total: secs, intensity, tss: (secs / 3600) * intensity ** 2 * 100 }
}
