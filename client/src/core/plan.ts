import { CFG } from '../config'
import type { Block, BlockType, Frame, Pct, Plan, Tier } from '../types'

const TYPES: BlockType[] = ['steady', 'ramp', 'over-under', 'sprint', 'free', 'set']

export function pctFor(p: Pct, tier: Tier): number {
  return (typeof p === 'number' ? p * CFG.tierFactor[tier] : p[tier]) / 100
}

/** Throws on a malformed plan; returns it with `set` blocks flattened. */
export function parsePlan(raw: unknown): Plan {
  const p = raw as Plan
  if (!p?.id || !p.name || !Array.isArray(p.blocks) || !p.blocks.length) throw new Error('plan: id, name, blocks required')
  return { ...p, blocks: flatten(p.blocks, p.id) }
}

function flatten(blocks: Block[], where: string): Block[] {
  return blocks.flatMap((b, n) => {
    const at = `${where}[${n}]`
    if (!TYPES.includes(b.type)) throw new Error(`${at}: bad type ${b.type}`)
    if (b.type === 'set') {
      if (!b.rep || b.rep < 1 || !b.blocks?.length) throw new Error(`${at}: set needs rep and blocks`)
      const inner = flatten(b.blocks, at)
      return Array.from({ length: b.rep }, () => inner.map((x) => ({ ...x }))).flat()
    }
    if (!(b.dur > 0)) throw new Error(`${at}: dur must be > 0`)
    if (b.type === 'sprint' && (b.dur < CFG.sprintDur.min || b.dur > CFG.sprintDur.max))
      throw new Error(`${at}: sprint dur must be ${CFG.sprintDur.min}-${CFG.sprintDur.max}s`)
    const needsPct = b.type === 'steady' || b.type === 'ramp' || b.type === 'over-under'
    if (needsPct && b.pct === undefined) throw new Error(`${at}: pct required`)
    if ((b.type === 'ramp' || b.type === 'over-under') && !Array.isArray(b.pct)) throw new Error(`${at}: pct must be [a, b]`)
    if (b.type === 'over-under' && !(b.step! > 0)) throw new Error(`${at}: step required`)
    return [b]
  })
}

/** Target as a fraction of FTP at `bel` seconds into the block, or null when ERG should be off. */
export function blockTarget(b: Block, tier: Tier, bel: number): number | null {
  const pair = b.pct as [Pct, Pct]
  switch (b.type) {
    case 'steady':
      return pctFor(b.pct as Pct, tier)
    case 'ramp': {
      const [a, z] = [pctFor(pair[0], tier), pctFor(pair[1], tier)]
      return a + (z - a) * Math.min(1, bel / b.dur)
    }
    case 'over-under':
      return pctFor(pair[Math.floor(bel / b.step!) % 2], tier)
    default:
      return null
  }
}

/** 1-based over-under step index parity: true while on the over (first) half. */
export const isOver = (b: Block, bel: number) => b.type === 'over-under' && Math.floor(bel / b.step!) % 2 === 0

export const planTotal = (blocks: Block[]) => blocks.reduce((s, b) => s + b.dur, 0)

export function locate(blocks: Block[], el: number): { i: number; bel: number } | null {
  let t = 0
  for (let i = 0; i < blocks.length; i++) {
    if (el < t + blocks[i].dur) return { i, bel: el - t }
    t += blocks[i].dur
  }
  return null
}

export function startOf(blocks: Block[], i: number): number {
  return planTotal(blocks.slice(0, i))
}

export function frameAt(blocks: Block[], el: number, tier: Tier, ftp: number): Frame | null {
  const at = locate(blocks, el)
  if (!at) return null
  const b = blocks[at.i]
  const w = (x: Block | undefined, bel: number) => {
    const f = x && blockTarget(x, tier, bel)
    return f == null ? null : Math.round(f * ftp)
  }
  const nb = blocks[at.i + 1]
  return {
    el,
    i: at.i,
    bel: at.bel,
    type: b.type,
    label: b.label ?? b.type,
    dur: b.dur,
    tgt: w(b, at.bel),
    next: nb && { type: nb.type, label: nb.label ?? nb.type, in: b.dur - at.bel, tgt: w(nb, 0) },
  }
}

/** Rescale a plan to roughly `minutes`: more/fewer reps of the first set, else stretch the longest steady block. */
export function generate(raw: Plan, minutes: number): Plan {
  const target = minutes * 60
  const sets = raw.blocks.findIndex((b) => b.type === 'set')
  const blocks = raw.blocks.map((b) => ({ ...b }))
  const total = () => planTotal(parsePlan({ ...raw, blocks }).blocks)
  if (sets >= 0) {
    const s = blocks[sets]
    const per = planTotal(parsePlan({ ...raw, blocks: [{ ...s, rep: 1 }] }).blocks)
    const fixed = total() - per * s.rep!
    s.rep = Math.max(1, Math.round((target - fixed) / per))
  } else {
    const longest = blocks.reduce((m, b, i) => (b.type === 'steady' && b.dur > blocks[m].dur ? i : m), 0)
    blocks[longest].dur = Math.max(60, blocks[longest].dur + target - total())
  }
  const slack = target - total()
  const first = blocks[0]
  const last = blocks[blocks.length - 1]
  if (first.type !== 'sprint' && first.type !== 'set') first.dur = Math.max(60, first.dur + Math.round(slack / 2 / 30) * 30)
  if (last.type !== 'sprint' && last.type !== 'set' && last !== first) last.dur = Math.max(60, last.dur + Math.round(slack / 2 / 30) * 30)
  return parsePlan({ ...raw, blocks })
}
