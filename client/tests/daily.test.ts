import { describe, expect, it } from 'vitest'
import { CHALLENGES, dailyChallenge, dailyReward, type DayRide } from '../src/core/daily'
import { newProfile } from '../src/core/curve'

const ride = (o: Partial<DayRide> = {}): DayRide => ({
  record: { secs: 2400, kj: 600 },
  sprints: [{ grade: 'GREAT' }],
  compliance: 0.95,
  avgCadence: 95,
  crew: true,
  ...o,
})

describe('daily challenge', () => {
  it('steps through every challenge and never repeats the day before', () => {
    const days = Array.from({ length: 6 }, (_, d) => dailyChallenge(100 + d).id)
    expect(new Set(days).size).toBe(CHALLENGES.length)
    for (let d = 0; d < 20; d++) expect(dailyChallenge(d).id).not.toBe(dailyChallenge(d + 1).id)
  })
  it('ticks off once a day for a ride that does it, with no scrap', () => {
    const p = { ...newProfile('a'), scrap: 10 } // an old stored balance, left alone
    const first = dailyReward(p, ride(), 100)
    expect(first.won).toEqual({ text: `Daily challenge: ${dailyChallenge(100).text}` })
    expect(first.p).toMatchObject({ dailyPaid: 100, scrap: 10 })
    expect(dailyReward(first.p, ride(), 100).won).toBeNull()
    expect(dailyReward(first.p, ride(), 101).won).not.toBeNull()
  })
  it('a ride that falls short pays nothing', () => {
    const short = ride({
      record: { secs: 300, kj: 50 },
      sprints: [],
      compliance: 0.5,
      avgCadence: 70,
      crew: false,
    })
    for (let d = 0; d < 6; d++) expect(dailyReward(newProfile('a'), short, d).won).toBeNull()
  })
})
