import { describe, expect, it } from 'vitest'
import { parseBikeData, parseControlReply } from '../src/trainer/ftms'

const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer)

describe('control point replies', () => {
  it('parses success and failure codes', () => {
    expect(parseControlReply(view([0x80, 0x05, 0x01]))).toEqual({ op: 5, result: 1 })
    expect(parseControlReply(view([0x80, 0x05, 0x05]))).toEqual({ op: 5, result: 5 })
    expect(parseControlReply(view([0x80, 0x00, 0x02]))).toEqual({ op: 0, result: 2 })
  })
  it('ignores short or foreign packets', () => {
    expect(parseControlReply(view([0x80, 0x05]))).toBeNull()
    expect(parseControlReply(view([0x00, 0x05, 0x01]))).toBeNull()
  })
})

describe('indoor bike data', () => {
  it('reads cadence and power with flags 0x0044', () => {
    // flags, speed, cadence 180 half-rpm = 90 rpm, power 215 W
    const v = view([0x44, 0x00, 0x10, 0x0e, 0xb4, 0x00, 0xd7, 0x00])
    expect(parseBikeData(v)).toEqual({ power: 215, cadence: 90 })
  })
  it('skips distance and resistance to find power', () => {
    // flags 0x0075: no speed, cadence, distance (3 bytes), resistance (2 bytes), power
    const v = view([0x75, 0x00, 0xa0, 0x00, 0x10, 0x27, 0x00, 0x0a, 0x00, 0x2c, 0x01])
    expect(parseBikeData(v)).toEqual({ power: 300, cadence: 80 })
  })
  it('passes negative power glitches through', () => {
    expect(parseBikeData(view([0x44, 0x00, 0, 0, 0, 0, 0xff, 0xff])).power).toBe(-1)
  })
})
