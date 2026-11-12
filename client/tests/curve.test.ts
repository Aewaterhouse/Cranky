import { describe, expect, it } from 'vitest'
import { applyRide, bestEfforts, curves, defaultCurve, ftpSuggestion, gradeSprint, newProfile } from '../src/core/curve'

const ride = (date: string, best: Record<number, number>) => ({ date, secs: 60, kj: 10, best, zones: [] })

describe('power curve and sprint grading', () => {
  it('default curve from FTP', () => {
    const c = defaultCurve(200)
    expect(c[5]).toBe(700)
    expect(c[1200]).toBe(210)
  })
  it('best efforts from 1 Hz power', () => {
    const p = [...Array(10).fill(100), ...Array(5).fill(500), ...Array(30).fill(100)]
    const b = bestEfforts(p)
    expect(b[5]).toBe(500)
    expect(b[1]).toBe(500)
    expect(b[60]).toBeUndefined()
  })
  it('defaults cap at GREAT', () => {
    const p = newProfile('a', 'A', 200)
    expect(gradeSprint(800, 5, p).grade).toBe('GREAT')
    expect(gradeSprint(680, 5, p).grade).toBe('GREAT')
    expect(gradeSprint(600, 5, p).grade).toBe('HIT')
    expect(gradeSprint(400, 5, p).grade).toBe('FAIL')
  })
  it('real points give MEGA and LEGEND', () => {
    const now = Date.parse('2026-06-01')
    let p = newProfile('a', 'A', 200)
    p = applyRide(p, ride('2025-01-01', { 5: 900, 15: 700 }))
    p = applyRide(p, ride('2026-05-20', { 5: 600, 15: 500 }))
    expect(curves(p, now).d90[5]).toEqual({ w: 600, real: true })
    expect(gradeSprint(650, 5, p, now).grade).toBe('MEGA')
    expect(gradeSprint(950, 5, p, now).grade).toBe('LEGEND')
    expect(gradeSprint(590, 5, p, now).grade).toBe('GREAT')
    expect(gradeSprint(530, 10, p, now).grade).toBe('GREAT')
  })
  it('suggests FTP from 20 min best', () => {
    let p = newProfile('a', 'A', 200)
    expect(ftpSuggestion(p)).toBeNull()
    p = applyRide(p, ride('2026-05-20', { 1200: 240 }))
    expect(ftpSuggestion(p)).toBe(228)
  })
  it('weekly streak', () => {
    let p = newProfile('a', 'A', 200)
    for (const d of ['2026-05-04', '2026-05-06', '2026-05-12', '2026-05-19']) p = applyRide(p, ride(d, {}))
    expect(p.stats.streak).toBe(3)
    p = applyRide(p, ride('2026-06-15', {}))
    expect(p.stats.streak).toBe(1)
  })
})
