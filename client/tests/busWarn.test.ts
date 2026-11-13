import { describe, expect, it } from 'vitest'
import { busScore, busWarn } from '../src/core/hud'

const f = (inS: number, tgt: number | null, type = 'steady') => ({
  tgt: 200,
  next: { type, in: inS, tgt },
})

describe('bus target change warning', () => {
  it('counts down 5-4-3-2-1 to a new target', () => {
    expect(busWarn(f(6, 250))).toBeNull()
    expect(busWarn(f(5, 250))).toEqual({ s: 5, text: 'Next: 250 W' })
    expect(busWarn(f(4.2, 250))?.s).toBe(5)
    expect(busWarn(f(0.3, 250))?.s).toBe(1)
    expect(busWarn(f(2, null))?.text).toBe('Next: free ride')
  })
  it('stays quiet when the target does not change or a sprint (with its own countdown) is next', () => {
    expect(busWarn(f(3, 200))).toBeNull()
    expect(busWarn(f(3, null, 'sprint'))).toBeNull()
    expect(busWarn({ tgt: 200 })).toBeNull()
  })
})

describe('bus score grace', () => {
  it('sends no score for the first seconds of a block or in a block with no target', () => {
    expect(busScore({ tgt: 200, bel: 2 }, 0.4)).toBeNull()
    expect(busScore({ tgt: 200, bel: 5 }, 0.4)).toBe(0.4)
    expect(busScore({ tgt: null, bel: 30 }, 0.4)).toBeNull()
    expect(busScore(null, 0.4)).toBeNull()
  })
})
