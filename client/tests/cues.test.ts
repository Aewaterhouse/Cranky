import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { parsePlan } from '../src/core/plan'
import { CueTracker } from '../src/modes/drill/cues'

const blocks = [
  {
    type: 'steady' as const,
    dur: 60,
    pct: 60,
    cues: [
      { at: 0, text: 'go' },
      { at: 30, text: 'half' },
    ],
  },
  { type: 'steady' as const, dur: 60, pct: 60, cues: [{ at: 10, text: 'next' }] },
]

describe('coach cues', () => {
  it('parse keeps cues and through sets', () => {
    const p = parsePlan({
      id: 'x',
      name: 'X',
      blocks: [{ type: 'set', rep: 2, blocks: [blocks[0]] }],
    })
    expect(p.blocks.map((b) => b.cues?.length)).toEqual([2, 2])
  })
  it.each([[[{ at: -1, text: 'a' }]], [[{ at: 1, text: '' }]], [[{ text: 'a' }]], ['hi']])(
    'rejects %j',
    (cues) => {
      expect(() =>
        parsePlan({ id: 'x', name: 'X', blocks: [{ type: 'steady', dur: 60, pct: 50, cues }] }),
      ).toThrow(/cues/)
    },
  )
  it('shows each cue once, when its time arrives', () => {
    const t = new CueTracker(blocks)
    expect(t.due(0, 0)).toBe('go')
    expect(t.due(0, 1)).toBeUndefined()
    expect(t.due(0, 31)).toBe('half')
    expect(t.due(0, 32)).toBeUndefined()
    expect(t.due(1, 5)).toBeUndefined()
    expect(t.due(1, 12)).toBe('next')
  })
  it('the newest due cue wins and skipped blocks stay quiet', () => {
    expect(new CueTracker(blocks).due(0, 40)).toBe('half')
    expect(new CueTracker(blocks).due(1, 0)).toBeUndefined()
  })
  it('a resumed ride does not replay earlier cues', () => {
    const t = new CueTracker(blocks, 45)
    expect(t.due(0, 45)).toBeUndefined()
    expect(t.due(1, 10)).toBe('next')
  })
  it('every shipped cue falls inside its block', () => {
    const dir = new URL('../../content/workouts/', import.meta.url)
    let n = 0
    for (const f of readdirSync(dir)) {
      const p = parsePlan(JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
      p.blocks.forEach((b) =>
        b.cues?.forEach((c) => {
          n++
          expect(c.at, `${f} ${b.label}`).toBeLessThan(b.dur)
        }),
      )
    }
    expect(n).toBeGreaterThan(20)
  })
})
