import { CFG } from '../../config'
import type { Block, Plan } from '../../types'

export const EASY_LABEL = 'Extra easy'

/** A private copy of the plan's blocks, so extending a ride never changes the shared workout. */
export const ownPlan = (plan: Plan): Plan => ({
  ...plan,
  blocks: plan.blocks.map((b) => ({ ...b })),
})

/** Make block `i` a minute longer (steady blocks only); later blocks shift. Returns whether it changed. */
export function addMinute(plan: Plan, i: number): boolean {
  const b = plan.blocks[i]
  if (b?.type !== 'steady') return false
  b.dur += CFG.extend.minuteS
  return true
}

/** Add easy spinning at 50% FTP (all tiers) after the last block; repeated calls grow the same block. */
export function addEasy(plan: Plan) {
  const last = plan.blocks[plan.blocks.length - 1]
  if (last?.label === EASY_LABEL) last.dur += CFG.extend.easyS
  else {
    const pct = CFG.extend.easyPct
    const b: Block = {
      type: 'steady',
      dur: CFG.extend.easyS,
      pct: { hard: pct, medium: pct, easy: pct },
      label: EASY_LABEL,
    }
    plan.blocks.push(b)
  }
}
