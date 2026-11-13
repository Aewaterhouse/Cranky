import { describe, expect, it } from 'vitest'
import { LapTimer, lapAt, lapToast } from '../src/core/laps'

const clock = (s: number) => `${Math.round(s)}s`

describe('lap maths', () => {
  it('counts laps from 1 and never past the last', () => {
    expect(lapAt(0, 1000, 5)).toBe(1)
    expect(lapAt(999, 1000, 5)).toBe(1)
    expect(lapAt(1000, 1000, 5)).toBe(2)
    expect(lapAt(4999, 1000, 5)).toBe(5)
    expect(lapAt(5000, 1000, 5)).toBe(5)
  })
  it('times each lap and keeps the last and the best', () => {
    const t = new LapTimer(1000, 4)
    expect(t.update(500, 60)).toBeUndefined()
    expect(t.info(500)).toEqual({ n: 1, of: 4, lastS: undefined, bestS: undefined })
    expect(t.update(1000, 120)).toBe(120)
    expect(t.update(1001, 120.2)).toBeUndefined()
    expect(t.update(2000, 220)).toBe(100)
    expect(t.update(3000, 330)).toBe(110)
    expect(t.info(3000)).toEqual({ n: 4, of: 4, lastS: 110, bestS: 100 })
  })
  it('does not report the final lap: that is the finish', () => {
    const t = new LapTimer(1000, 2)
    t.update(1000, 100)
    expect(t.update(2000, 200)).toBeUndefined()
    expect(t.times).toEqual([100])
  })
  it('times the line to where it was crossed, not to the tick', () => {
    const t = new LapTimer(1000, 3)
    expect(t.update(1005, 100.5, 10)).toBeCloseTo(100)
    expect(t.update(2000, 200, 10)).toBeCloseTo(100)
  })
  it('shares the time over laps skipped in one jump', () => {
    const t = new LapTimer(1000, 5)
    expect(t.update(3000, 300)).toBe(100)
    expect(t.times).toEqual([100, 100, 100])
  })
  it('words the toast, with the last lap called', () => {
    const t = new LapTimer(1000, 4)
    t.update(1000, 120)
    expect(lapToast(t.info(1000), clock)).toBe('Lap 1 done · 120s')
    t.update(2000, 220)
    expect(lapToast(t.info(2000), clock)).toBe('Lap 2 done · 100s · best yet')
    t.update(3000, 330)
    expect(lapToast(t.info(3000), clock)).toBe('Last lap · Lap 3 done · 110s')
  })
})
