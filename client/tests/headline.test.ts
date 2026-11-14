import { describe, expect, it } from 'vitest'
import { headline } from '../src/ui/resultsTop'
import type { GroupSummary } from '../src/ui/resultsViews'

const g = (mode: string, ids: string[], extra: Partial<GroupSummary> = {}) =>
  ({ mode, armour: 100, riders: ids.map((id) => ({ id })), ...extra }) as unknown as GroupSummary

describe('results headline', () => {
  it('says how each game went', () => {
    expect(headline('me', g('last', ['me', 'kat']))).toBe('Last one standing!')
    expect(headline('me', g('quiz', ['kat', 'me', 'daz']))).toBe('2nd of 3')
    expect(headline('me', g('hunt', ['me', 'kat']))).toBe('You won!')
    expect(headline('me', g('galley', ['me'], { armour: 0 }))).toBe('Taken by pirates')
    const teams = { names: ['Red', 'Blue'], scores: [0.9, 0.8], winner: 0 }
    const ttt = (team: string) =>
      ({ mode: 'ttt', armour: 100, teams, riders: [{ id: 'me', team }] }) as unknown as GroupSummary
    expect(headline('me', ttt('Red'))).toBe('Your team won!')
    expect(headline('me', ttt('Blue'))).toBe('Team Red won · you rode for the Blue')
    expect(headline('me', g('bus', ['me'], { armour: 0 }))).toBe('Limped home!')
  })
})

describe('score context', () => {
  it('leads with your own score in the ranked games', async () => {
    const { scoreContext } = await import('../src/ui/resultsTop')
    const quiz = {
      mode: 'quiz',
      score: 237,
      riders: [
        { id: 'me', points: 40 },
        { id: 'kat', points: 237 },
      ],
    }
    expect(scoreContext('me', quiz as unknown as GroupSummary)).toBe('You: 40 · your first go')
  })
})
