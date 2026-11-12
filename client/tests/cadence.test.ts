import { describe, expect, it } from 'vitest'
import { frameAt, parsePlan } from '../src/core/plan'
import { CadenceTally, inCadBand } from '../src/modes/drill/cadence'

const plan = (cad: unknown) => ({
  id: 'x',
  name: 'X',
  blocks: [
    { type: 'steady', dur: 60, pct: 60, cad },
    { type: 'steady', dur: 60, pct: 60 },
  ],
})

describe('cadence targets', () => {
  it('parses the band onto the block and the frame', () => {
    const p = parsePlan(plan([90, 100]))
    expect(p.blocks[0].cad).toEqual([90, 100])
    expect(frameAt(p.blocks, 10, 'hard', 200)?.cad).toEqual([90, 100])
    expect(frameAt(p.blocks, 70, 'hard', 200)?.cad).toBeUndefined()
  })
  it('keeps the band through sets', () => {
    const p = parsePlan({
      id: 'x',
      name: 'X',
      blocks: [
        { type: 'set', rep: 2, blocks: [{ type: 'steady', dur: 30, pct: 50, cad: [80, 90] }] },
      ],
    })
    expect(p.blocks.map((b) => b.cad)).toEqual([
      [80, 90],
      [80, 90],
    ])
  })
  it.each([[[100, 90]], [[0, 90]], [[90]], ['90'], [[90, 100, 110]]])('rejects %j', (cad) => {
    expect(() => parsePlan(plan(cad))).toThrow(/cad/)
  })
  it('tallies the share of seconds in band per block', () => {
    const p = parsePlan(plan([90, 100]))
    const t = new CadenceTally(p.blocks)
    ;[85, 90, 95, 100, 101].forEach((c) => t.add(0, c))
    t.add(1, 50)
    expect(t.pct()).toEqual([0.6, null])
    expect(new CadenceTally(p.blocks).pct()).toEqual([null, null])
  })
  it('in band without a band is always true', () => {
    expect(inCadBand(undefined, 10)).toBe(true)
    expect(inCadBand([90, 100], 89)).toBe(false)
  })
})
