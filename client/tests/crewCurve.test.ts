import { describe, expect, it } from 'vitest'
import { leaderboard, mateLine, type CrewRider } from '../src/core/crewCurve'
import { lineKg, yTop } from '../src/core/powerCurve'

const rider = (id: string, kg: number | null, best: Record<number, number>): CrewRider => ({
  id,
  name: id,
  weightKg: kg,
  best: Object.fromEntries(Object.entries(best).map(([d, w]) => [d, { w, date: '2026-01-01' }])),
})
const crew = [
  rider('a', 80, { 5: 1000, 60: 400 }),
  rider('b', 60, { 5: 800, 60: 390 }),
  rider('c', null, { 5: 1200 }),
  rider('d', 70, {}),
]

describe('crew curves', () => {
  it('ranks by watts and leaves out riders without that effort', () => {
    expect(leaderboard(crew, 5, false).map((r) => r.id)).toEqual(['c', 'a', 'b'])
    expect(leaderboard(crew, 60, false).map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('ranks by W/kg and drops riders without a weight', () => {
    const rows = leaderboard(crew, 60, true)
    expect(rows.map((r) => [r.id, r.wkg])).toEqual([
      ['b', 6.5],
      ['a', 5],
    ])
    expect(leaderboard(crew, 5, true).map((r) => r.id)).toEqual(['b', 'a'])
  })
  it('draws only real points, with each mate dividing by their own weight', () => {
    const l = mateLine(crew[1], 1)
    expect(l.pts.map((q) => q.d)).toEqual([5, 60])
    expect(lineKg(l, 75)).toBe(60)
    expect(lineKg(l, undefined)).toBeUndefined()
    expect(lineKg({ ...l, key: 'all' }, 75)).toBe(75)
    expect(yTop([l], 75)).toBe(15)
  })
})
