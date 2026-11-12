import { describe, expect, it } from 'vitest'
import { currentHr, parseHr, setHr, simHrStep, SimHr } from '../src/trainer/heartRate'

const dv = (...b: number[]) => new DataView(new Uint8Array(b).buffer)

describe('parseHr', () => {
  it('reads uint8 when flag bit 0 is clear', () => expect(parseHr(dv(0x00, 142))).toBe(142))
  it('reads uint16 when flag bit 0 is set', () => expect(parseHr(dv(0x01, 0x2c, 0x01))).toBe(300))
  it('ignores other flag bits', () => expect(parseHr(dv(0x16, 77, 1, 2))).toBe(77))
})

describe('simulated heart rate', () => {
  const settle = (watts: number, secs: number, hr = 60) => {
    for (let i = 0; i < secs; i++) hr = simHrStep(hr, watts, 200, 1)
    return hr
  }
  it('stays at rest with no power', () => expect(settle(0, 120)).toBeCloseTo(60, 0))
  it('approaches 175 at FTP', () => expect(settle(200, 300)).toBeGreaterThan(172))
  it('lags: well short of target after 30 s', () => {
    const hr = settle(200, 30)
    expect(hr).toBeGreaterThan(100)
    expect(hr).toBeLessThan(150)
  })
  it('is capped', () => expect(settle(900, 600)).toBeLessThanOrEqual(200))
  it('feeds the singleton and clears on disconnect', () => {
    setHr(
      new SimHr(
        () => 200,
        () => 200,
      ),
    )
    expect(currentHr()).toBe(60)
    setHr(null)
    expect(currentHr()).toBeNull()
  })
})
