import { describe, expect, it, vi } from 'vitest'
import type { RoadSummary } from '../src/net/protocol'

vi.mock('../src/ui/dom', async (orig) => ({
  ...(await orig<typeof import('../src/ui/dom')>()),
  h: (tag: string, _a: unknown, ...kids: unknown[]) => ({ tag, kids }),
  avatar: () => '',
}))
const { roadSection, roadTvEnd } = await import('../src/ui/roadResults')

type Node = string | { tag: string; kids: unknown[] }
const text = (n: unknown): string =>
  typeof n === 'string'
    ? n
    : n && typeof n === 'object'
      ? (n as { kids: Node[] }).kids.map(text).join(' ')
      : ''

const row = (id: string, name: string, place: number, time: number | null) => {
  const r = { bot: false, dist: 9000, late: false, avgPower: 240, wkg: 3.2, saved: 30 }
  return { ...r, id, name, place, time }
}
const old = (game: string, extra: object): RoadSummary => ({
  kind: 'road',
  game,
  route: 'nundah-crit',
  name: 'Nundah',
  laps: 2,
  distance: 9000,
  secs: 900,
  style: 'race',
  together: false,
  podium: ['me', 'kev'],
  riders: [row('me', 'Me', 1, 880), row('kev', 'Kev', 2, 890), row('bob', 'Bob', 3, null)],
  ...extra,
})

describe('road results for a game that has gone', () => {
  // As the server stored them: a points race's points, award and line, a chaingang's team line.
  const points = old('points', { award: { kind: 'points', id: 'me' } })
  points.riders = points.riders.map((r, i) => ({ ...r, pts: 9 - i, line: i + 1 }))
  const chain = old('chaingang', { team: { time: 890, smooth: 3, turns: 4 } })

  it.each([
    [points, 'points race'],
    [chain, 'chaingang'],
  ])('shows the name and the numbers, nothing more', (g, name) => {
    const t = text(roadSection(g, 'me'))
    expect(t).toContain(`· ${name}`)
    expect(t).toContain('You finished 1st')
    expect(t).toContain('240 W')
    expect(t).toContain('ridden')
    expect(t).not.toMatch(/points \(|turns smooth|Points/)
    expect(text(roadTvEnd(g, () => {}))).toContain('Nundah')
  })

  it('still names the kept games', () => {
    expect(text(roadSection(old('handicap', {}), 'me'))).toContain('· handicap race')
    const crit = text(roadSection(old('crit', { award: { kind: 'prime', id: 'kev' } }), 'me'))
    expect(crit).toContain('Kev won the prime')
  })
})
