import type { Profile } from '../../core/curve'
import { blockTarget, startOf } from '../../core/plan'
import type { Pct, Plan } from '../../types'

const at = (plan: Plan, label: string) => plan.blocks.findIndex((b) => b.label === label)

/** The fatigue test rides at the FTP of the first real run, so its watts never change. */
export function fatiguePlan(plan: Plan, p: Profile): Plan {
  if (plan.test !== 'fatigue' || !p.fatigueTest) return plan
  const k = p.fatigueTest.ftp / p.ftp
  const s = (x: Pct) => (typeof x === 'number' ? x * k : x)
  return {
    ...plan,
    blocks: plan.blocks.map((b) =>
      b.pct === undefined
        ? b
        : { ...b, pct: Array.isArray(b.pct) ? [s(b.pct[0]), s(b.pct[1])] : s(b.pct) },
    ),
  }
}

/** The test effort's watts at this FTP. */
export const fatigueWatts = (plan: Plan, ftp: number) =>
  Math.round(blockTarget(plan.blocks[at(plan, 'Test effort')], 'hard', 0)! * ftp)

/** First real run that got through the effort: lock today's FTP for every run after. */
export function lockFatigue(plan: Plan, p: Profile, el: number, sim: boolean, now = Date.now()) {
  const still = at(plan, 'Sit still')
  if (plan.test !== 'fatigue' || sim || p.fatigueTest || still < 0) return false
  if (el < startOf(plan.blocks, still)) return false
  p.fatigueTest = { ftp: p.ftp, w: fatigueWatts(plan, p.ftp), date: new Date(now).toISOString() }
  return true
}

/** The minute sitting still must not auto-pause: the clock and the HR recording keep going. */
export const holdsStill = (plan: Plan, type?: string) => plan.test === 'fatigue' && type === 'free'
