import { describe, expect, it } from 'vitest'
import { cardLines, rideShares } from '../src/core/crewStats'
import { crewShares } from '../src/core/hud'

const stats = { ftp: 250, kg: 80, avg: 200, np: 220, on: 0.75, kj: 360, falls: 1 }
const get = (rows: [string, string][], k: string) => rows.find((r) => r[0] === k)?.[1]

describe('crew card numbers', () => {
  it('lists now and this ride from the tick and the ride stats', () => {
    const { now, ride, hint } = cardLines(
      { w: 200, tgt: 250, cad: 88, hr: 150, hrp: 0.8, erg: true, stats, rideShare: 0.25 },
      true,
    )
    expect(get(now, 'Target')).toBe('250 · 80%')
    expect(get(now, 'W/kg')).toBe('2.5')
    expect(get(now, 'FTP')).toBe('80%')
    expect(get(now, 'HR')).toBe('150 · 80%')
    expect(get(now, 'Mode')).toBe('ERG')
    expect(get(ride, 'NP')).toBe('220 W')
    expect(get(ride, 'Avg W/kg')).toBe('2.5')
    expect(get(ride, 'On target')).toBe('75%')
    expect(get(ride, 'kJ')).toBe('360')
    expect(get(ride, 'Falls')).toBe('1')
    expect(get(ride, 'Share')).toBe('25%')
    expect(hint).toBe(false)
  })

  it('with no weight: W/kg is a dash, % of FTP still shows, and only my card asks for a weight', () => {
    const noKg = { ...stats, kg: null }
    const mine = cardLines({ w: 200, erg: false, stats: noKg }, true)
    expect(get(mine.now, 'W/kg')).toBe('–')
    expect(get(mine.ride, 'Avg W/kg')).toBe('–')
    expect(get(mine.now, 'FTP')).toBe('80%')
    expect(get(mine.now, 'Mode')).toBe('Gears')
    expect(mine.hint).toBe(true)
    expect(cardLines({ w: 200, stats: noKg }, false).hint).toBe(false)
  })

  it('takes FTP and weight from the rider when there are no ride stats (group rides)', () => {
    const r = cardLines({ w: 210, ftp: 300, kg: 70 }, false)
    expect(get(r.now, 'W/kg')).toBe('3.0')
    expect(get(r.now, 'FTP')).toBe('70%')
    const mine = cardLines({ w: 210, ftp: 300, kg: null }, true)
    expect(get(mine.now, 'W/kg')).toBe('–')
    expect(mine.hint).toBe(true)
  })

  it('shows dashes before the server has sent the ride so far', () => {
    const { now, ride, hint } = cardLines({ w: 120 }, true)
    expect(get(now, 'FTP')).toBe('–')
    expect(get(ride, 'Avg')).toBe('–')
    expect(get(ride, 'Share')).toBe('–')
    expect(hint).toBe(false)
  })
})

describe('shares of the work', () => {
  it("ride share is each rider's kJ over the crew's, and zero for all at the start", () => {
    expect(rideShares({ a: { kj: 300 }, b: { kj: 100 } })).toEqual({ a: 0.75, b: 0.25 })
    expect(rideShares({ a: { kj: 0 }, b: { kj: 0 } })).toEqual({ a: 0, b: 0 })
  })
  it('live share counts riding riders only, and the carrier only while someone is off', () => {
    const r = { a: { w: 300, st: 'riding' }, b: { w: 100, st: 'riding' }, c: { w: 0, st: 'fell' } }
    const { share, carrier } = crewShares(r)
    expect(share).toEqual({ a: 0.75, b: 0.25 })
    expect(carrier).toBe('a')
    expect(crewShares({ a: r.a, b: r.b }).carrier).toBeNull()
  })
})
