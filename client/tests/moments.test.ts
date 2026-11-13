import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import type { RideSummary } from '../src/core/ride'
import { MOMENT_LINES } from '../src/fun/momentLines'
import { Moments, momentCard } from '../src/modes/freeRide/moments'
import { postcardTiles } from '../src/ui/ridePostcard'

describe('summit and finish moments', () => {
  it('fires the summit once over the top, then the finish once at the line', () => {
    const m = new Moments(4000, 10000)
    expect(m.next(3999)).toBeUndefined()
    expect(m.next(4001)).toBe('summit')
    expect(m.next(4500)).toBeUndefined()
    expect(m.next(10000)).toBe('finish')
    expect(m.next(10000)).toBeUndefined()
  })

  it('leaves a summit at the line to the finish, and a flat route has no summit', () => {
    const hilltop = new Moments(10000 - CFG.moments.nearFinishM + 1, 10000)
    expect(hilltop.next(9990)).toBeUndefined()
    expect(hilltop.next(10000)).toBe('finish')
    const flat = new Moments(undefined, 5000)
    expect(flat.next(4000)).toBeUndefined()
    expect(flat.next(5000)).toBe('finish')
  })

  it('still fires the finish when a late joiner lands past the top', () => {
    const m = new Moments(4000, 10000)
    expect(m.next(10000)).toBe('finish')
    expect(m.next(10000)).toBeUndefined()
  })

  it('builds the card: a line that is stable for a time, and the four numbers', () => {
    const c = momentCard('summit', { el: 754, avgPower: 212.4, kg: 80, prs: 2 })
    expect(c.head).toBe('Summit')
    expect(MOMENT_LINES.summit).toContain(c.line)
    expect(momentCard('summit', { el: 754, avgPower: 1, kg: 80, prs: 0 }).line).toBe(c.line)
    expect(c.tiles).toEqual([
      ['Time', '12:34'],
      ['Avg power', '212 W'],
      ['W/kg', '2.66'],
      ['PRs', '2'],
    ])
    const f = momentCard('finish', { el: 10, avgPower: 200, kg: 80, prs: 0, place: '2nd' })
    expect(f.head).toBe('Finished 2nd')
    expect(MOMENT_LINES.finish).toContain(f.line)
  })
})

describe('postcard numbers', () => {
  const ride = {
    distance: 12040,
    ascent: 303,
    avgPower: 200,
    record: { secs: 1830 },
    segments: [{ pr: true }, { pr: false }, { pr: true }],
  } as unknown as RideSummary

  it('lists distance, climb, time, power, W/kg and PRs', () => {
    expect(postcardTiles(ride, 80)).toEqual([
      ['Distance', '12.0 km'],
      ['Climbed', '303 m'],
      ['Time', '30:30'],
      ['Avg power', '200 W'],
      ['W/kg', '2.50'],
      ['PRs', '2'],
    ])
  })
  it('leaves PRs off when there are none', () => {
    const tiles = postcardTiles({ ...ride, segments: [] }, 80)
    expect(tiles.map((t) => t[0])).not.toContain('PRs')
  })
})
