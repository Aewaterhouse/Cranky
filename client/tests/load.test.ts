import { describe, expect, it } from 'vitest'
import { RideRecorder, loadStats, normalisedPower } from '../src/core/ride'

describe('normalised power', () => {
  it('equals the power for a steady ride', () => {
    expect(normalisedPower(Array(120).fill(200))).toBeCloseTo(200)
  })
  it('is plain mean under 30 s', () => {
    expect(normalisedPower([100, 200])).toBe(150)
    expect(normalisedPower([])).toBe(0)
  })
  it('weights variable power above the average', () => {
    const p = [...Array(60).fill(100), ...Array(60).fill(300)]
    expect(normalisedPower(p)).toBeGreaterThan(200)
    expect(normalisedPower(p)).toBeLessThan(300)
  })
  it('computes IF and TSS: one hour at FTP is 100 TSS', () => {
    const l = loadStats(Array(3600).fill(250), 250)
    expect(l.if).toBeCloseTo(1)
    expect(l.tss).toBeCloseTo(100)
    expect(loadStats(Array(1800).fill(125), 250).tss).toBeCloseTo(12.5)
  })
})

describe('summary', () => {
  it('records the target series and load figures', () => {
    const r = new RideRecorder({ id: 'x', name: 'X', blocks: [{ type: 'steady', dur: 60 }] }, 200)
    for (let i = 0; i < 40; i++) r.sample(0, 200, 90, i < 30 ? 200 : null, 1, true)
    const s = r.summary()
    expect(s.power).toHaveLength(40)
    expect(s.target[35]).toBeNull()
    expect(s.np).toBe(200)
    expect(s.if).toBe(1)
    expect(s.avgCadence).toBe(90)
    expect(s.tss).toBe(Math.round((40 / 3600) * 100))
  })
})

describe('heart rate in the summary', () => {
  const plan = { id: 'x', name: 'X', blocks: [{ type: 'steady' as const, dur: 60 }] }
  it('has null hr and avg/max without a strap', () => {
    const r = new RideRecorder(plan, 200)
    r.sample(0, 200, 90, 200, 1, true)
    const s = r.summary()
    expect(s.hr).toEqual([null])
    expect(s.avgHr).toBeNull()
    expect(s.maxHr).toBeNull()
  })
  it('averages and maxes the recorded samples, skipping gaps', () => {
    const r = new RideRecorder(plan, 200)
    for (const hr of [120, null, 140, 160]) r.sample(0, 200, 90, 200, 1, true, hr)
    const s = r.summary()
    expect(s.hr).toEqual([120, null, 140, 160])
    expect(s.avgHr).toBe(140)
    expect(s.maxHr).toBe(160)
  })
})
