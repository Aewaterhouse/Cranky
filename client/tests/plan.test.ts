import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import { readdirSync, readFileSync } from 'node:fs'
import { frameAt, generate, parsePlan, planTotal, blockTarget } from '../src/core/plan'
import schema from '../../content/schema/workout.schema.json'

const dir = new URL('../../content/workouts/', import.meta.url)
const raw = (id: string) => JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'))

describe('plans', () => {
  const validate = new Ajv().compile(schema)
  it.each(readdirSync(dir))('%s is valid and parses', (f) => {
    const p = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    expect(validate(p), JSON.stringify(validate.errors)).toBe(true)
    expect(parsePlan(p).blocks.length).toBeGreaterThan(0)
  })
  it('expands sets', () => {
    const p = parsePlan(raw('ss-2x15'))
    expect(p.blocks.filter((b) => b.label === 'Sweet spot')).toHaveLength(2)
    expect(planTotal(p.blocks)).toBe(600 + 2 * (900 + 300) + 300)
  })
  it('rejects bad plans', () => {
    expect(() => parsePlan({ id: 'x', name: 'x', blocks: [{ type: 'sprint', dur: 60 }] })).toThrow(/sprint/)
    expect(() => parsePlan({ id: 'x', name: 'x', blocks: [{ type: 'steady', dur: 60 }] })).toThrow(/pct/)
    expect(() => parsePlan({ id: 'x', name: 'x', blocks: [{ type: 'nope', dur: 60 }] })).toThrow(/type/)
  })
  it('targets per tier, ramp and over-under', () => {
    expect(blockTarget({ type: 'steady', dur: 10, pct: 90 }, 'hard', 0)).toBeCloseTo(0.9)
    expect(blockTarget({ type: 'steady', dur: 10, pct: 90 }, 'easy', 0)).toBeCloseTo(0.72)
    expect(blockTarget({ type: 'steady', dur: 10, pct: { hard: 90, medium: 85, easy: 70 } }, 'medium', 0)).toBeCloseTo(0.85)
    expect(blockTarget({ type: 'ramp', dur: 100, pct: [50, 70] }, 'hard', 50)).toBeCloseTo(0.6)
    const o = { type: 'over-under' as const, dur: 240, pct: [95, 105] as [number, number], step: 60 }
    expect(blockTarget(o, 'hard', 30)).toBeCloseTo(0.95)
    expect(blockTarget(o, 'hard', 90)).toBeCloseTo(1.05)
    expect(blockTarget({ type: 'sprint', dur: 10 }, 'hard', 0)).toBeNull()
  })
  it('frames carry watts and next block', () => {
    const p = parsePlan(raw('ss-2x15'))
    const f = frameAt(p.blocks, 700, 'hard', 250)!
    expect(f.tgt).toBe(225)
    expect(f.next?.label).toBe('Recover')
    expect(frameAt(p.blocks, 1e6, 'hard', 250)).toBeNull()
  })
  it.each([30, 45, 60, 90])('generator scales bus-crew-60 to %i min', (m) => {
    const p = generate(raw('bus-crew-60'), m)
    expect(Math.abs(planTotal(p.blocks) - m * 60)).toBeLessThan(m * 60 * 0.12)
  })
  it('generator stretches plans without sets', () => {
    expect(planTotal(generate(raw('z2-60'), 90).blocks)).toBeCloseTo(5400, -2)
  })
})
