import { describe, expect, it } from 'vitest'
import { gameLabel, gameOf } from '../src/modes/crew/games'
import { headline, scoreContext } from '../src/ui/resultsTop'
import { mvpLine, type GroupSummary } from '../src/ui/resultsViews'

const g = (mode: string | undefined, ids: string[], extra: Partial<GroupSummary> = {}) =>
  ({ mode, armour: 100, riders: ids.map((id) => ({ id })), ...extra }) as unknown as GroupSummary

describe('results headline', () => {
  it('says how the bus went', () => {
    expect(headline('me', g('bus', ['me'], { armour: 0 }))).toBe('Limped home!')
    expect(headline('me', g(undefined, ['me']))).toBe('Made it!')
  })

  it('gives an old ride from a game that has gone a plain headline', () => {
    for (const mode of ['madness', 'ambo', 'date', 'climate', 'last', 'ttt', 'quiz', 'hunt'])
      expect(headline('me', g(mode, ['me', 'kat'], { flooded: true } as never))).toBe('Ride done')
  })
})

describe('score context', () => {
  it('works without stored scores', () => {
    const bus = { mode: 'bus', score: 237, riders: [{ id: 'me' }] }
    expect(scoreContext('me', bus as unknown as GroupSummary)).toBe(
      'Your first go. Beat it next time.',
    )
  })
})

describe('old rides from games that have gone', () => {
  it('still name the game in History and the feed', () => {
    expect(gameLabel('madness', 1234)).toBe(' 🤯 VO2 Madness · Score 1,234')
    expect(gameLabel('ambo')).toBe(' 🚑 Kidney Stone Express')
    expect(gameOf('watch')?.name).toBe('Watch Party')
    expect(gameLabel('bus', 10)).toBe(' 🧟 Zombie Bus · Bus score 10')
  })

  it('show nothing for a ride that was not a crew game', () => {
    expect(gameLabel(null)).toBe('')
    expect(gameLabel('nonsense')).toBe('')
    expect(gameOf(undefined)).toBeUndefined()
  })

  it('rank their riders on the plain numbers', () => {
    const rows = [
      { id: 'a', compliance: 0.9, inBandSecs: 100, sprints: [], falls: 0, points: 40 },
      { id: 'b', compliance: 0.5, inBandSecs: 50, sprints: [], falls: 0, points: 99 },
    ] as unknown as GroupSummary['riders']
    expect(mvpLine(rows[0], rows)).toBe('🏅 Most on target')
  })
})
