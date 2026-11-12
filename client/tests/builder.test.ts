import { describe, expect, it } from 'vitest'
import {
  buildPlan,
  clampBlock,
  duplicate,
  move,
  newBlock,
  remove,
  stats,
  validate,
} from '../src/core/builder'
import { planTotal } from '../src/core/plan'
import { CFG } from '../src/config'

describe('workout builder core', () => {
  it('reorders, duplicates and removes', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(move(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(duplicate(['a', 'b'], 0)).toEqual(['a', 'a', 'b'])
    expect(remove(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('clamps ERG targets to the cap', () => {
    const cap = CFG.erg.capPct * 100
    const b = clampBlock({ ...newBlock('intervals'), pct: 400, offPct: 999 })
    expect(b.pct).toBe(cap)
    expect(b.offPct).toBe(cap)
    expect(clampBlock({ ...newBlock('ramp'), pct: -5, pct2: 1e6 })).toMatchObject({
      pct: 20,
      pct2: cap,
    })
    const plan = buildPlan('Hot', [{ ...newBlock('steady'), pct: 300 }])
    expect(plan.blocks[0].pct).toBe(cap)
  })

  it('never gives sprint or free blocks a target', () => {
    const sprint = clampBlock({ ...newBlock('sprint'), pct: 200, pct2: 200 })
    expect(sprint.pct).toBeUndefined()
    expect(sprint.pct2).toBeUndefined()
    const plan = buildPlan('Sp', [{ ...newBlock('sprint'), pct: 200 }, newBlock('free')])
    expect(plan.blocks.every((b) => b.pct === undefined)).toBe(true)
    expect(clampBlock({ ...newBlock('sprint'), dur: 999 }).dur).toBe(CFG.sprintDur.max)
  })

  it('converts to a parseable plan with intervals expanded', () => {
    const plan = buildPlan('My Session!', [
      { ...newBlock('steady'), cad: [85, 95], cue: ' Easy now ' },
      newBlock('intervals'),
    ])
    expect(plan.id).toBe('my-my-session')
    expect(plan.blocks).toHaveLength(1 + 8)
    expect(planTotal(plan.blocks)).toBe(300 + 4 * 180)
    expect(plan.blocks[0].cad).toEqual([85, 95])
    expect(plan.blocks[0].cues).toEqual([{ at: 0, text: 'Easy now' }])
    expect(plan.edit).toHaveLength(2)
  })

  it('validates and estimates load', () => {
    expect(validate('', [newBlock('steady')])).toMatch(/name/)
    expect(validate('x', [])).toMatch(/block/)
    expect(() => buildPlan('x', [])).toThrow()
    const s = stats([{ ...newBlock('steady'), dur: 3600, pct: 100 }])
    expect(s.total).toBe(3600)
    expect(s.intensity).toBeCloseTo(1)
    expect(s.tss).toBeCloseTo(100)
    expect(stats([]).tss).toBe(0)
  })
})
