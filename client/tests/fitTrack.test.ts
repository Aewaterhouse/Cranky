import { describe, expect, it } from 'vitest'
import { encodeFit, fitCrc } from '../src/core/fit'
import { trackOn } from '../src/core/rideTrack'
import { buildRoute } from '../src/core/route'

/** A just-enough FIT reader: every data message as {global message number, fields by number}. */
function decode(f: Uint8Array) {
  const v = new DataView(f.buffer)
  const defs = new Map<number, { global: number; fields: [number, number, number][] }>()
  const out: { global: number; f: Record<number, number> }[] = []
  let i = f[0]
  const end = f[0] + v.getUint32(4, true)
  while (i < end) {
    const head = f[i++]
    if (head & 0x40) {
      const global = v.getUint16(i + 2, true)
      const n = f[i + 4]
      const fields: [number, number, number][] = []
      for (let k = 0; k < n; k++)
        fields.push([f[i + 5 + k * 3], f[i + 6 + k * 3], f[i + 7 + k * 3]])
      defs.set(head & 0xf, { global, fields })
      i += 5 + n * 3
      continue
    }
    const d = defs.get(head & 0xf)!
    const rec: Record<number, number> = {}
    for (const [num, size, type] of d.fields) {
      rec[num] =
        type === 0x85
          ? v.getInt32(i, true)
          : size === 4
            ? v.getUint32(i, true)
            : size === 2
              ? v.getUint16(i, true)
              : f[i]
      i += size
    }
    out.push({ global: d.global, f: rec })
  }
  return out
}
const deg = (semi: number) => (semi * 180) / 2 ** 31

describe('FIT export with position', () => {
  // A 1 km lap heading north from Brisbane, climbing 2%, ridden at 8 m/s for 150 s: one lap and a bit.
  const lap = buildRoute(
    'north',
    'North',
    Array.from({ length: 101 }, (_, i) => ({
      d: i * 10,
      ele: 20 + i * 0.2,
      lat: -27.47 + (i * 10) / 111_195,
      lon: 153.02,
    })),
    undefined,
    { loop: true },
  )
  const n = 150
  const dist = Array.from({ length: n }, (_, i) => (i + 1) * 8)
  const base = {
    start: '2026-11-14T08:00:00.000Z',
    power: Array.from({ length: n }, (_, i) => 180 + (i % 20)),
    cadence: Array(n).fill(88),
    hr: Array(n).fill(140),
  }
  const track = trackOn(lap, 2, dist)!
  const f = encodeFit({ ...base, track, lapM: 1000 })
  const msgs = decode(f)
  const records = msgs.filter((m) => m.global === 20)

  it('is still a valid file', () => {
    expect(fitCrc(f)).toBe(0)
    expect(msgs.map((m) => m.global).filter((g) => g !== 20)).toEqual([0, 19, 19, 18, 34])
  })

  it('puts latitude, longitude, altitude, distance and speed on every record', () => {
    expect(records).toHaveLength(n)
    const r = records[49].f // 400 m into the first lap
    expect(deg(r[0])).toBeCloseTo(-27.47 + 400 / 111_195, 5)
    expect(deg(r[1])).toBeCloseTo(153.02, 5)
    expect(r[2] / 5 - 500).toBeCloseTo(28, 0)
    expect(r[5] / 100).toBe(400)
    expect(r[6] / 1000).toBe(8)
    expect([r[7], r[4], r[3]]).toEqual([base.power[49], 88, 140])
    // Second time round the rider is back where the lap starts, with the distance still counting up.
    const again = records[129].f
    expect(again[5] / 100).toBe(1040)
    expect(deg(again[0])).toBeCloseTo(-27.47 + 40 / 111_195, 5)
    expect(deg(again[0])).toBeLessThan(0)
  })

  it('writes a lap message per lap and the totals on the session', () => {
    const laps = msgs.filter((m) => m.global === 19).map((m) => m.f)
    expect(laps.map((l) => [l[254], l[7] / 1000, l[9] / 100])).toEqual([
      [0, 124, 992],
      [1, 26, 208],
    ])
    expect(laps[1][2] - laps[0][2]).toBe(124)
    const session = msgs.find((m) => m.global === 18)!.f
    expect(session[26]).toBe(2)
    expect(session[9] / 100).toBe(1200)
    expect(session[6]).toBe(58)
    expect(session[22]).toBeGreaterThanOrEqual(19)
    expect(session[14] / 1000).toBe(8)
  })

  it('leaves a ride without positions exactly as it was', () => {
    const plain = encodeFit(base)
    const m = decode(plain)
    expect(m.filter((x) => x.global === 19)).toHaveLength(1)
    expect(Object.keys(m.find((x) => x.global === 20)!.f).sort()).toEqual(['253', '3', '4', '7'])
    expect(m.find((x) => x.global === 18)!.f[6]).toBe(6)
    // Length and checksum of the same ride from the encoder as it was before positions were added.
    expect([plain.length, plain[plain.length - 2] | (plain[plain.length - 1] << 8)]).toEqual(PLAIN)
    // A track of the wrong length (a ride restored after a crash) is ignored rather than written skewed.
    expect(encodeFit({ ...base, track: track.slice(5) })).toEqual(plain)
  })

  it('has no track for a route without coordinates', () => {
    const bare = buildRoute('bare', 'Bare', [
      { d: 0, ele: 0 },
      { d: 500, ele: 10 },
    ])
    expect(trackOn(bare, 1, [10, 20])).toBeUndefined()
  })
})

const PLAIN = [1608, 42397]
