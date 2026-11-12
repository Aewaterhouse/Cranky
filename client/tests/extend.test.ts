import { describe, expect, it } from 'vitest'
import { frameAt, parsePlan, planTotal } from '../src/core/plan'
import { addEasy, addMinute, ownPlan } from '../src/modes/drill/extend'
import { pickOverlay } from '../src/modes/drill/overlays'

const raw = parsePlan({
  id: 'x',
  name: 'X',
  blocks: [
    { type: 'steady', dur: 300, pct: 90, label: 'Work' },
    { type: 'sprint', dur: 10 },
    { type: 'ramp', dur: 120, pct: [60, 40], label: 'Cool-down' },
  ],
})

describe('extending a ride', () => {
  it('works on a private copy and never changes the shared plan', () => {
    const p = ownPlan(raw)
    addMinute(p, 0)
    addEasy(p)
    expect(planTotal(raw.blocks)).toBe(430)
    expect(planTotal(p.blocks)).toBe(430 + 60 + 300)
  })
  it('+1 min lengthens a steady block and shifts the later ones', () => {
    const p = ownPlan(raw)
    expect(addMinute(p, 0)).toBe(true)
    expect(p.blocks[0].dur).toBe(360)
    expect(frameAt(p.blocks, 330, 'hard', 200)).toMatchObject({ i: 0 })
    expect(frameAt(p.blocks, 361, 'hard', 200)).toMatchObject({ i: 1, type: 'sprint' })
  })
  it('+1 min is refused for sprints and ramps', () => {
    const p = ownPlan(raw)
    expect(addMinute(p, 1)).toBe(false)
    expect(addMinute(p, 2)).toBe(false)
    expect(planTotal(p.blocks)).toBe(430)
  })
  it('+5 min adds easy spinning at 50% FTP in every tier, and repeats grow the same block', () => {
    const p = ownPlan(raw)
    addEasy(p)
    const at = planTotal(raw.blocks) + 1
    for (const [tier, w] of [
      ['hard', 100],
      ['medium', 100],
      ['easy', 100],
    ] as const)
      expect(frameAt(p.blocks, at, tier, 200)?.tgt).toBe(w)
    addEasy(p)
    addEasy(p)
    expect(p.blocks).toHaveLength(4)
    expect(p.blocks[3].dur).toBe(900)
  })
})

describe('overlays', () => {
  const f = frameAt(raw.blocks, 10, 'hard', 200)!
  const base = {
    f,
    power: 200,
    paused: false,
    completing: false,
    grace: 12.3,
    manual: false,
    ergOn: true,
    sprintIn: 0,
    reconnecting: false,
  }
  it('says the workout is complete with a countdown, ahead of the pause notice', () => {
    expect(pickOverlay({ ...base, completing: true, paused: true })[1]).toMatch(/13 s/)
  })
  it('only mentions ERG easing off when ERG is on', () => {
    expect(pickOverlay({ ...base, paused: true, manual: true })[1]).toMatch(/ERG/)
    expect(pickOverlay({ ...base, paused: true, manual: true, ergOn: false })[1]).not.toMatch(/ERG/)
  })
  it('is quiet in an ordinary block', () => {
    expect(pickOverlay(base)).toEqual([null])
  })
})
