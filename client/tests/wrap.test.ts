import { describe, expect, it } from 'vitest'
import { monthWrap } from '../src/core/wrap'

const ride = (date: string, secs: number, plan?: string, w20?: number) => ({
  date,
  secs,
  kj: secs / 3,
  best: (w20 ? { 1200: w20 } : {}) as Record<number, number>,
  zones: [],
  plan,
})

describe('month wrap', () => {
  it("sums this month's rides and names the favourite and the best 20 min", () => {
    const rides = [
      ride('2026-10-30T07:00:00', 3600, 'Pub Quiz', 300),
      ride('2026-11-02T07:00:00', 1800, 'Pub Quiz', 250),
      ride('2026-11-09T07:00:00', 3600, 'Pub Quiz'),
      ride('2026-11-12T07:00:00', 5400, 'Mondo', 240),
    ]
    expect(monthWrap(rides, new Date('2026-11-15T09:00:00'))).toEqual({
      month: 'November',
      rides: 3,
      hours: 3,
      kj: 3600,
      fav: 'Pub Quiz',
      longest: 90,
      best20: 250,
    })
    expect(monthWrap(rides, new Date('2026-12-01T09:00:00'))).toBeNull()
  })
})
