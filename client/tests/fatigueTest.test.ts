import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { frameAt, parsePlan, planTotal, startOf } from '../src/core/plan'
import type { Profile } from '../src/core/curve'
import { fatiguePlan, fatigueWatts, holdsStill, lockFatigue } from '../src/modes/drill/fatigueTest'
import { ftpResult, testSpec } from '../src/modes/drill/ftpTest'

const plan = parsePlan(
  JSON.parse(
    readFileSync(new URL('../../content/workouts/fatigue-test.json', import.meta.url), 'utf8'),
  ),
)
const rider = (ftp: number) => ({ ftp }) as Profile
const still = startOf(plan.blocks, 2)

describe('fatigue test', () => {
  it('is 6 min warm-up, 3 min at 105%, then a free minute sitting still', () => {
    expect(plan.blocks.map((b) => [b.label, b.dur])).toEqual([
      ['Warm-up', 360],
      ['Test effort', 180],
      ['Sit still', 60],
    ])
    expect(planTotal(plan.blocks)).toBe(600)
    expect(fatigueWatts(plan, 255)).toBe(268)
    // The minute sitting still sends no ERG target and never auto-pauses.
    expect(frameAt(plan.blocks, still + 5, 'hard', 255)!.tgt).toBeNull()
    expect(holdsStill(plan, 'free')).toBe(true)
    expect(holdsStill(plan, 'steady')).toBe(false)
  })

  it('never sets an FTP', () => {
    expect(testSpec(plan)).toBeNull()
    expect(ftpResult(plan, [300, 300, 300], [400, 401, 402])).toBeNull()
  })

  it('first real run through the effort locks the watts; sim and early stops do not', () => {
    const p = rider(255)
    expect(lockFatigue(plan, p, still, true)).toBe(false)
    expect(lockFatigue(plan, p, still - 1, false)).toBe(false)
    expect(p.fatigueTest).toBeUndefined()
    expect(lockFatigue(plan, p, still, false, 0)).toBe(true)
    expect(p.fatigueTest).toEqual({ ftp: 255, w: 268, date: new Date(0).toISOString() })
    p.ftp = 300
    expect(lockFatigue(plan, p, 600, false)).toBe(false)
    expect(p.fatigueTest!.ftp).toBe(255)
  })

  it('once locked, the same watts ride at any later FTP', () => {
    const p = { ...rider(300), fatigueTest: { ftp: 255, w: 268, date: '' } }
    const fixed = fatiguePlan(plan, p)
    expect(frameAt(fixed.blocks, 400, 'hard', 300)!.tgt).toBe(268)
    expect(frameAt(fixed.blocks, 0, 'hard', 300)!.tgt).toBe(
      frameAt(plan.blocks, 0, 'hard', 255)!.tgt,
    )
    expect(fatiguePlan(plan, rider(300))).toBe(plan)
  })
})
