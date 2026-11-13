import { describe, expect, it } from 'vitest'
import { nextLevel } from '../src/scene/quality'

describe('graphics quality steps', () => {
  it('drops after two slow windows and not below low power', () => {
    let s = nextLevel('high', 30, 0, 0)
    expect(s.level).toBe('high')
    s = nextLevel(s.level, 30, s.slow, s.fast)
    expect(s).toMatchObject({ level: 'medium', dropped: true })
    expect(nextLevel('potato', 30, 1, 0).level).toBe('lowpower')
    expect(nextLevel('lowpower', 10, 5, 0)).toMatchObject({ level: 'lowpower', dropped: false })
  })
  it('a very slow window drops two levels at once, without waiting for a second', () => {
    expect(nextLevel('high', 12, 0, 0)).toMatchObject({ level: 'low', dropped: true })
    expect(nextLevel('low', 5, 0, 0)).toMatchObject({ level: 'lowpower', dropped: true })
    expect(nextLevel('potato', 5, 0, 0).level).toBe('lowpower')
    // From the top to the floor in two windows (4 s), where it used to take six (12 s) to reach potato.
    let s = nextLevel('high', 4, 0, 0)
    s = nextLevel(s.level, 4, s.slow, s.fast)
    expect(s.level).toBe('lowpower')
  })
  it('a good window resets the slow count', () => {
    const s = nextLevel('high', 30, 0, 0)
    expect(nextLevel('high', 60, s.slow, s.fast).slow).toBe(0)
  })
  it('climbs only after ten fast windows', () => {
    let s = { level: 'low' as const, slow: 0, fast: 0 }
    for (let i = 0; i < 9; i++) s = nextLevel(s.level, 60, s.slow, s.fast) as typeof s
    expect(s.level).toBe('low')
    expect(nextLevel(s.level, 60, s.slow, s.fast).level).toBe('medium')
  })
})
