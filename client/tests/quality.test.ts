import { describe, expect, it } from 'vitest'
import { nextLevel } from '../src/scene/quality'

describe('graphics quality steps', () => {
  it('drops after two slow windows and not below potato', () => {
    let s = nextLevel('high', 30, 0, 0)
    expect(s.level).toBe('high')
    s = nextLevel(s.level, 30, s.slow, s.fast)
    expect(s).toMatchObject({ level: 'medium', dropped: true })
    expect(nextLevel('potato', 10, 5, 0).level).toBe('potato')
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
