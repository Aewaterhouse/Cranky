import { afterEach, describe, expect, it } from 'vitest'
import { VIS } from '../src/scene/params'
import { MOOD, ROUTE_MOODS, moodForHour, pickMood } from '../src/scene/route/routeMoods'

afterEach(() => {
  MOOD.pick = 'auto'
})

describe('free ride moods', () => {
  it('has a sky for every mood it can pick', () => {
    for (const m of ROUTE_MOODS) expect(VIS.moods[m], m).toBeDefined()
  })
  it('follows the clock: dawn, midday, golden hour, then dusk through the night', () => {
    expect(moodForHour(6)).toBe('routeDawn')
    expect(moodForHour(12)).toBe('route')
    expect(moodForHour(17)).toBe('routeGolden')
    expect(moodForHour(19)).toBe('routeGolden')
    expect(moodForHour(21)).toBe('routeDusk')
    expect(moodForHour(23.5)).toBe('routeDusk')
    expect(moodForHour(2)).toBe('routeDusk')
  })
  it('can be pinned from the debug panel', () => {
    MOOD.pick = 'routeMist'
    expect(pickMood(12, 0, 0, 1, 1)).toBe('routeMist')
  })
  it('puts mist on the high ground on some days and never down low', () => {
    const days = Array.from({ length: 200 }, (_, day) => day)
    const high = days.filter(
      (day) => pickMood(12, MOOD.mistAbove + 200, 0, 99, day) === 'routeMist',
    )
    expect(high.length).toBeGreaterThan(200 * MOOD.mistChance * 0.7)
    expect(high.length).toBeLessThan(200 * MOOD.mistChance * 1.3)
    for (const day of days) expect(pickMood(12, MOOD.mistAbove - 1, 0, 99, day)).toBe('route')
    // The same for every rider on that route that day.
    expect(pickMood(12, 2000, 0, 99, 5)).toBe(pickMood(12, 2000, 0, 99, 5))
  })
  it('sends a passing shower now and then, never at the start, and it passes', () => {
    const E = MOOD.showerEveryS
    let showers = 0
    for (let slot = 0; slot < 300; slot++) {
      const wet = pickMood(12, 0, slot * E + 1, 7, 3) === 'routeShower'
      if (wet) showers++
      if (slot === 0) expect(wet).toBe(false)
      expect(pickMood(12, 0, slot * E + MOOD.showerS + 1, 7, 3)).toBe('route')
    }
    expect(showers).toBeGreaterThan(300 * MOOD.showerChance * 0.6)
    expect(showers).toBeLessThan(300 * MOOD.showerChance * 1.4)
  })
})
