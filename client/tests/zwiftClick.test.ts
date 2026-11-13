import { describe, expect, it } from 'vitest'
import { clickPresses, parseClick } from '../src/trainer/zwiftClick'

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
