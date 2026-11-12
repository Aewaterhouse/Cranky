import { describe, expect, it } from 'vitest'
import { badges, prTimeline, stickBadges, weekStreak } from '../src/core/badges'
import { applyRide, newProfile, rideRecord, type RideRecord } from '../src/core/curve'

const WEEK = 7 * 86400000
const T0 = Date.parse('2026-01-05T08:00:00Z')
const ride = (i: number, over: Partial<RideRecord> = {}): RideRecord => ({
  date: new Date(T0 + i * WEEK).toISOString(),
  secs: 3600,
  kj: 500,
  best: { 5: 400 + i, 60: 250 },
  zones: [],
  ...over,
})
const build = (rides: RideRecord[]) => rides.reduce(applyRide, newProfile('a'))
const earned = (p: ReturnType<typeof build>) =>
  badges(p)
    .filter((b) => b.earned)
    .map((b) => b.id)

describe('badges', () => {
  it('a new rider has none, a first ride earns the first', () => {
    expect(earned(newProfile('a'))).toEqual([])
    const p = build([ride(0)])
    expect(earned(p)).toEqual(['first'])
    expect(badges(p)[0].date).toBe(ride(0).date)
  })
  it('counts rides, kJ and single big rides, with dates', () => {
    const p = build(Array.from({ length: 10 }, (_, i) => ride(i, { kj: i === 4 ? 1200 : 500 })))
    expect(earned(p)).toEqual(['first', 'rides10', 'kj5k', 'streak4', 'bigday'])
    const get = (id: string) => badges(p).find((b) => b.id === id)!
    expect(get('rides10').date).toBe(ride(9).date)
    expect(get('bigday').date).toBe(ride(4).date)
  })
  it('minute power badges follow the 1 min best', () => {
    expect(earned(build([ride(0, { best: { 60: 299 } })]))).not.toContain('w300')
    const p = build([ride(0, { best: { 60: 410 } })])
    expect(earned(p)).toEqual(expect.arrayContaining(['w300', 'w400']))
    expect(earned(p)).not.toContain('w500')
  })
  it('weekly streak needs consecutive weeks', () => {
    expect(weekStreak([ride(0), ride(1), ride(2), ride(4)]).best).toBe(3)
    expect(weekStreak([ride(0), ride(0), ride(1), ride(2), ride(3)])).toEqual({
      best: 4,
      reached: ride(3).date,
    })
  })
  it('LEGEND sprint comes from the ride record and sticks', () => {
    const s = {
      record: ride(0),
      tss: 40,
      np: 200,
      sprints: [{ grade: 'MEGA' }, { grade: 'LEGEND' }],
    }
    const rec = rideRecord(s)
    expect(rec.legend).toBe(true)
    expect(rec.tss).toBe(40)
    expect(rideRecord({ ...s, sprints: [] }).legend).toBeUndefined()
    const p = build([rec])
    expect(earned(p)).toContain('legend')
    p.rides = []
    expect(earned(p)).toContain('legend')
  })
  it('stickBadges keeps earned badges after rides drop off', () => {
    const p = build([ride(0, { kj: 1500 })])
    expect(stickBadges(p)).toBe(true)
    expect(stickBadges(p)).toBe(false)
    p.rides = []
    expect(earned(p)).toEqual(expect.arrayContaining(['first', 'bigday']))
  })
})

describe('PR timeline', () => {
  it('lists each improvement, newest first, with the previous best', () => {
    const p = build([
      ride(0),
      ride(1, { best: { 5: 390, 60: 260 } }),
      ride(2, { best: { 5: 450 } }),
    ])
    const t = prTimeline(p)
    expect(t[0]).toMatchObject({ d: 5, w: 450, prev: 400 })
    expect(t.find((e) => e.d === 60 && e.w === 260)).toMatchObject({ prev: 250 })
    expect(t.filter((e) => e.d === 5).map((e) => e.w)).toEqual([450, 400])
    expect(t.find((e) => e.d === 5 && e.w === 400)!.prev).toBeNull()
  })
  it('keeps an all-time best whose ride has left the list', () => {
    const p = build([ride(0)])
    p.allTime[1200] = { w: 250, date: '2025-01-01T00:00:00Z' }
    expect(prTimeline(p).at(-1)).toMatchObject({ d: 1200, prev: null })
  })
})
