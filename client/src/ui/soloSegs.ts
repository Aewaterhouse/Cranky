import { blockTarget } from '../core/plan'
import type { Block, Tier } from '../types'
import { SPRINT_COLOUR, zoneColour } from './planGraph'

/** One drawn stretch of the workout profile: watts ramp w0 to w1 over t0..t1. */
export interface Seg {
  t0: number
  t1: number
  w0: number
  w1: number
  kind: 'zone' | 'sprint' | 'free'
  col: string
}

const FREE = '#7d8590'

/** Target profile of a plan, scaled by `intensity`. Colours follow the unscaled zone. */
export function segsFromBlocks(blocks: Block[], tier: Tier, ftp: number, intensity = 1): Seg[] {
  const out: Seg[] = []
  let t = 0
  for (const b of blocks) {
    const end = t + b.dur
    if (b.type === 'sprint' || b.type === 'free') {
      const sprint = b.type === 'sprint'
      out.push({
        t0: t,
        t1: end,
        w0: 0,
        w1: 0,
        kind: b.type,
        col: sprint ? SPRINT_COLOUR : FREE,
      })
    } else {
      const step = b.type === 'over-under' ? b.step! : b.dur
      for (let s = 0; s < b.dur; s += step) {
        const e = Math.min(b.dur, s + step)
        const a = blockTarget(b, tier, s)!
        const z = b.type === 'ramp' ? blockTarget(b, tier, e)! : a
        out.push({
          t0: t + s,
          t1: t + e,
          w0: a * ftp * intensity,
          w1: z * ftp * intensity,
          kind: 'zone',
          col: zoneColour((a + z) / 2),
        })
      }
    }
    t = end
  }
  return out
}

/** Target profile rebuilt from a recorded per-second target series; `types[i]` is the block type at second i. */
export function segsFromSeries(target: (number | null)[], types: string[], ftp: number): Seg[] {
  const out: Seg[] = []
  target.forEach((w, i) => {
    const kind = types[i] === 'sprint' ? 'sprint' : w == null ? 'free' : 'zone'
    const last = out[out.length - 1]
    if (last && last.kind === kind && (kind !== 'zone' || Math.abs(last.w1 - w!) < 2)) {
      last.t1 = i + 1
      return
    }
    const col = kind === 'sprint' ? SPRINT_COLOUR : kind === 'free' ? FREE : zoneColour(w! / ftp)
    out.push({ t0: i, t1: i + 1, w0: w ?? 0, w1: w ?? 0, kind, col })
  })
  return out
}
