import { describe, expect, it } from 'vitest'
import type { CrewRow } from '../src/core/efforts'
import { boardRows, leaderLine, ordinal, rankText, topThree } from '../src/core/leaderboard'

const row = (id: string, secs: number, wkg = 3, date = '2026-11-01'): CrewRow => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  secs,
  wkg,
  date,
})

describe('leaderboards', () => {
  const rows = [row('luke', 300, 3.1), row('me', 280, 3.0), row('sam', 300, 4.2, '2026-10-01')]

  it('ranks by time with ties sharing a rank and my row marked', () => {
    const b = boardRows(rows, 'me')
    expect(b.map((r) => [r.id, r.rank, r.me])).toEqual([
      ['me', 1, true],
      ['sam', 2, false],
      ['luke', 2, false],
    ])
    expect(rankText(b)).toBe('You are 1st of 3')
  })

  it('ranks by W/kg, highest first', () => {
    const b = boardRows(rows, 'me', 'wkg')
    expect(b.map((r) => r.id)).toEqual(['sam', 'luke', 'me'])
    expect(rankText(b)).toBe('You are 3rd of 3')
  })

  it('says so when I have no time, or nobody has', () => {
    expect(rankText(boardRows(rows, 'nobody'))).toMatch(/no time here yet/)
    expect(rankText([])).toMatch(/Nobody/)
  })

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103, 111].map(ordinal)).toEqual(
      '1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 103rd 111th'.split(' '),
    )
  })

  it('gives the leader a line that names them, and the same one every time', () => {
    const b = boardRows(rows, 'luke')
    const mate = leaderLine(b[0], false)
    expect(mate).toContain('Me')
    expect(mate).not.toContain('{name}')
    expect(leaderLine(b[0], false)).toBe(mate)
    expect(leaderLine(boardRows(rows, 'me')[0], false)).not.toBe(mate)
    expect(leaderLine(boardRows([rows[0]], 'x')[0], true)).not.toBe(leaderLine(b[0], false))
  })

  it('folds a PR from this ride into the top three', () => {
    const crew = [row('luke', 300), row('sam', 310), row('me', 320), row('kim', 330)]
    const me = { id: 'me', name: 'You' }
    expect(topThree(crew, me).map((r) => r.id)).toEqual(['luke', 'sam', 'me'])
    const after = topThree(crew, me, 290)
    expect(after.map((r) => [r.id, r.secs, r.me])).toEqual([
      ['me', 290, true],
      ['luke', 300, false],
      ['sam', 310, false],
    ])
    expect(topThree([], me, 290).map((r) => r.name)).toEqual(['You'])
    expect(topThree([], me)).toEqual([])
  })
})
