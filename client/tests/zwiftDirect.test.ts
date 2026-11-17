import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  fields,
  gearMsg,
  hex,
  inclineMsg,
  READ_GEAR,
  RIDE_ON,
  START,
  varint,
} from '../src/trainer/zwiftDirect'

describe('direct gears bytes (docs/zwift-gear-protocol.md)', () => {
  it('encodes the handshake and gear ratios as the doc lists them', () => {
    expect(hex(RIDE_ON)).toBe('52 69 64 65 4f 6e 02 01')
    expect(hex(START)).toBe('41 08 05')
    expect(hex(READ_GEAR)).toBe('00 08 88 04')
    expect(hex(gearMsg(0.75))).toBe('04 2a 03 10 cc 3a')
    expect(hex(gearMsg(1.53))).toBe('04 2a 03 10 c4 77')
    expect(hex(gearMsg(2.4))).toBe('04 2a 04 10 c0 bb 01')
    expect(hex(gearMsg(3.49))).toBe('04 2a 04 10 d4 90 02')
    expect(hex(gearMsg(5.49))).toBe('04 2a 04 10 f4 ac 03')
  })

  it('encodes inclines with zigzag', () => {
    expect(hex(inclineMsg(0))).toBe('04 22 02 10 00')
    expect(hex(inclineMsg(1))).toBe('04 22 03 10 c8 01')
    expect(hex(inclineMsg(5))).toBe('04 22 03 10 e8 07')
    expect(hex(inclineMsg(-2))).toBe('04 22 03 10 8f 03')
    expect(varint(300)).toEqual([0xac, 0x02])
  })

  it('reads power and cadence from riding data', () => {
    const b = Uint8Array.from(
      '03 08 be 01 10 50 18 bd 06 20 00 28 e2 ba 01 30 8b eb 01'
        .split(' ')
        .map((x) => parseInt(x, 16)),
    )
    expect(fields(b)).toMatchObject({ 1: 190, 2: 80 })
  })

  it('no ride uses it: only the trainer check page imports it', () => {
    const src = resolve(__dirname, '../src')
    const files = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : [],
      )
    const users = files(src)
      .filter((f) => /from '.*(zwiftDirect|directGearsPanel)'/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(src.length + 1))
      .sort()
    expect(users).toEqual(['spike.ts', 'ui/directGearsPanel.ts'])
  })
})
