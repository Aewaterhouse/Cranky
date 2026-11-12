import { describe, expect, it } from 'vitest'
import { newProfile, recordFtp } from '../src/core/curve'
import {
  ftpSeries,
  hrZones,
  powerZones,
  validBounds,
  wkg,
  zoneBounds,
} from '../src/core/riderMetrics'

describe('rider metrics', () => {
  it('power zones in watts at FTP 200', () => {
    const z = powerZones(200)
    expect(z).toHaveLength(7)
    expect(z[0]).toMatchObject({ lo: 0, hi: 110 })
    expect(z[1]).toMatchObject({ lo: 111, hi: 150 })
    expect(z[6]).toMatchObject({ lo: 301, hi: null })
  })
  it('custom bounds win; bad bounds are rejected', () => {
    const p = newProfile('a')
    expect(zoneBounds(p)).toHaveLength(6)
    p.zoneBounds = [0.5, 0.7, 0.85, 1, 1.2, 1.5]
    expect(zoneBounds(p)[0]).toBe(0.5)
    expect(validBounds([0.5, 0.7, 0.85, 1, 1.2, 1.5])).toBe(true)
    expect(validBounds([0.5, 0.5, 0.85, 1, 1.2, 1.5])).toBe(false)
    expect(validBounds([0.5, 0.7])).toBe(false)
  })
  it('HR zones, plain and reserve', () => {
    const z = hrZones(190)
    expect(z.map((x) => x.hi)).toEqual([114, 133, 152, 171, 190])
    expect(z[1].lo).toBe(115)
    expect(hrZones(190, 50)[4].hi).toBe(190)
    expect(hrZones(190, 50)[0].hi).toBe(134)
  })
  it('W/kg', () => {
    expect(wkg(300, 75)).toBe(4)
    expect(wkg(300)).toBeNull()
  })
  it('FTP history appends only on change and the series ends at today', () => {
    const p = newProfile('a', 'A', 200)
    recordFtp(p, 200)
    expect(p.ftpHistory).toHaveLength(0)
    recordFtp(p, 220, Date.parse('2026-01-01'))
    const copy = { ...p }
    recordFtp(copy, 230, Date.parse('2026-02-01'))
    expect(p.ftpHistory).toHaveLength(1)
    expect(copy.ftpHistory.map((x) => x.ftp)).toEqual([220, 230])
    expect(ftpSeries(copy, Date.parse('2026-03-01')).map((x) => x.ftp)).toEqual([220, 230])
    expect(ftpSeries(newProfile('b', 'B', 180), 5)).toEqual([{ t: 5, ftp: 180 }])
  })
})
