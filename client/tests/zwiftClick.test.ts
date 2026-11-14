import { describe, expect, it } from 'vitest'
import { clickPresses, parseClick, parseRide } from '../src/trainer/zwiftClick'

// 0x37 then protobuf fields 1 (plus) and 2 (minus): 0 pressed, 1 released (jat255/zwift_click_handling).
const msg = (...b: number[]) => new Uint8Array(b)
const idle = msg(0x37, 0x08, 0x01, 0x10, 0x01)
const plus = msg(0x37, 0x08, 0x00, 0x10, 0x01)
const minus = msg(0x37, 0x08, 0x01, 0x10, 0x00)

describe('Zwift Click messages', () => {
  it('reads plus and minus button states', () => {
    expect(parseClick(idle)).toEqual({ plus: false, minus: false })
    expect(parseClick(plus)).toEqual({ plus: true, minus: false })
    expect(parseClick(minus)).toEqual({ plus: false, minus: true })
  })
  it('treats a missing field as pressed (protobuf default 0)', () => {
    expect(parseClick(msg(0x37, 0x10, 0x01))).toEqual({ plus: true, minus: false })
    expect(parseClick(msg(0x37))).toEqual({ plus: true, minus: true })
  })
  it('ignores battery, empty and handshake messages', () => {
    expect(parseClick(msg(0x19, 0x08, 0x00, 0x10, 0x59))).toBeNull()
    expect(parseClick(msg(0x15))).toBeNull()
    expect(parseClick(msg(0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e, 0x01, 0x03))).toBeNull()
  })
  it('reports presses only, not repeats or releases', () => {
    const press = clickPresses()
    // The sequence the Click sends for one minus press, then one plus press.
    const seq = [minus, idle, idle, idle, plus, plus, idle, idle]
    expect(seq.flatMap((b) => press(parseClick(b)!))).toEqual([-1, 1])
  })
})

// Click v2: 0x23 then field 1, a bitmask with a 0 bit per held button (OpenBikeControl/bikecontrol).
const ride = (held: number, ...rest: number[]) => {
  let m = ~held >>> 0
  const out = [0x23, 0x08]
  for (; m > 0x7f; m = Math.floor(m / 128)) out.push((m & 0x7f) | 0x80)
  return msg(...out, m, ...rest)
}

describe('Zwift Click v2 messages', () => {
  it('reads the left puck: up and right are plus; down, left and the shifter are minus', () => {
    expect(parseRide(ride(0))).toEqual({ plus: false, minus: false })
    for (const b of [0x2, 0x4, 0x1000])
      expect(parseRide(ride(b))).toEqual({ plus: true, minus: false })
    for (const b of [0x1, 0x8, 0x100])
      expect(parseRide(ride(b))).toEqual({ plus: false, minus: true })
  })
  it('ignores face buttons, skips paddle fields and reads no bitmask as nothing held', () => {
    expect(parseRide(ride(0x10 | 0x800))).toEqual({ plus: false, minus: false })
    expect(parseRide(ride(0x2, 0x1a, 0x04, 0x08, 0x00, 0x10, 0x00))).toEqual({
      plus: true,
      minus: false,
    })
    expect(parseRide(msg(0x23))).toEqual({ plus: false, minus: false })
  })
  it('is not confused with v1, battery or handshake messages', () => {
    expect(parseRide(plus)).toBeNull()
    expect(parseRide(msg(0x19, 0x08, 0x00))).toBeNull()
    expect(parseClick(ride(0x2))).toBeNull()
  })
  it('gives one shift per press', () => {
    const press = clickPresses()
    const seq = [ride(0x2), ride(0x2), ride(0), ride(0x100), ride(0)]
    expect(seq.flatMap((b) => press(parseRide(b)!))).toEqual([1, -1])
  })
})
