import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { encodeFit, fitCrc } from '../src/core/fit'

describe('FIT export', () => {
  const ride = {
    start: '2026-11-12T08:00:00.000Z',
    power: Array.from({ length: 120 }, (_, i) => 150 + (i % 30)),
    cadence: Array(120).fill(90),
    hr: Array.from({ length: 120 }, (_, i) => (i < 5 ? null : 120 + (i % 10))),
    np: 166,
    tss: 5.2,
    intensity: 0.83,
  }
  const f = encodeFit(ride)
  it('has a valid header and checksums', () => {
    expect(f[0]).toBe(14)
    expect(String.fromCharCode(...f.slice(8, 12))).toBe('.FIT')
    const dataSize = new DataView(f.buffer).getUint32(4, true)
    expect(f.length).toBe(14 + dataSize + 2)
    expect(fitCrc(f.slice(0, 12))).toBe(f[12] | (f[13] << 8))
    expect(fitCrc(f)).toBe(0)
  })
  it('writes one record per second after a single definition', () => {
    const record = 1 + 4 + 1 + 1 + 2
    expect(f.length).toBeGreaterThan(120 * record)
    expect(f.length).toBeLessThan(120 * record + 400)
    if (process.env.FIT_OUT) writeFileSync(process.env.FIT_OUT, f)
  })
  it('handles an empty ride', () => {
    expect(fitCrc(encodeFit({ start: ride.start, power: [], cadence: [] }))).toBe(0)
  })
})
