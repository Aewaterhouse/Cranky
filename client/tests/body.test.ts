import { describe, expect, it } from 'vitest'
import {
  BODY_FIELDS,
  BODY_PRESETS,
  bodyOf,
  decodeBody,
  defaultBody,
  encodeBody,
  fullBody,
  presetBody,
  randomBody,
  withBody,
} from '../src/core/body'
import { equip } from '../src/core/cosmetics'
import { newProfile } from '../src/core/curve'

const inRange = (b: Record<string, number>) =>
  BODY_FIELDS.every((f) => Number.isInteger(b[f.key]) && b[f.key] >= 0 && b[f.key] <= f.max)

describe('rider body data', () => {
  it('gives each rider a stable, ordinary default from their id', () => {
    expect(defaultBody('luke')).toEqual(defaultBody('luke'))
    expect(defaultBody('luke')).not.toEqual(defaultBody('steve'))
    for (const id of ['alex', 'luke', 'steve', 'angus', 'ali', 'jack', 'bot-1', '']) {
      const b = defaultBody(id)
      expect(inRange(b)).toBe(true)
      // Nothing silly until the rider chooses: realistic skin and hair, no googly eyes, no extremes.
      for (const f of BODY_FIELDS) {
        if (f.normal) expect(f.normal, f.key).toContain(b[f.key])
        if (f.type === 'slider') expect(Math.abs(b[f.key] - f.def), f.key).toBeLessThanOrEqual(15)
        if (f.type === 'toggle') expect(b[f.key]).toBe(0)
      }
    }
  })

  it('round-trips through the look string', () => {
    for (let i = 0; i < 50; i++) {
      const b = randomBody()
      expect(inRange(b)).toBe(true)
      expect(decodeBody(encodeBody(b))).toEqual(b)
    }
    expect(encodeBody(defaultBody('luke')).length).toBeLessThan(120)
  })

  it('clamps what is out of range and refuses what it does not understand', () => {
    const wild = fullBody({ height: 900, belly: -5, hair: 99, googly: 7, calves: 33.6, nope: 3 })
    expect(wild.height).toBe(100)
    expect(wild.belly).toBe(0)
    expect(wild.hair).toBe(BODY_FIELDS.find((f) => f.key === 'hair')!.max)
    expect(wild.googly).toBe(1)
    expect(wild.calves).toBe(34)
    expect('nope' in wild).toBe(false)
    const s = encodeBody(defaultBody('luke'))
    const high = s
      .split('-')
      .map((v, i) => (i === 1 ? '5000' : v))
      .join('-')
    expect(decodeBody(high)!.height).toBe(100)
    for (const bad of [
      undefined,
      '',
      'hat-cap',
      '2' + s.slice(1),
      s + '-1',
      s.replace(/-\d+$/, ''),
      s.replace(/-\d+$/, '-x'),
    ])
      expect(decodeBody(bad), String(bad)).toBeUndefined()
  })

  it('uses the saved body when a look has one, else the default', () => {
    const b = presetBody('Bobblehead')
    expect(b.head).toBe(100)
    expect(presetBody('Top heavy').chest).toBe(100)
    expect(defaultBody('luke').chest).toBe(0)
    expect(bodyOf('luke', withBody({}, b))).toEqual(b)
    expect(bodyOf('luke', { body: 'junk' })).toEqual(defaultBody('luke'))
    expect(bodyOf('luke', undefined)).toEqual(defaultBody('luke'))
    for (const p of BODY_PRESETS) expect(inRange(presetBody(p.name)), p.name).toBe(true)
  })

  it('rides in the profile beside the Garage items without disturbing them', () => {
    let p = { ...newProfile('luke', 'Luke'), owned: ['hat-cap'] }
    p = { ...p, look: withBody(p.look, presetBody('Sprinter')) }
    p = equip(p, 'hat-cap')
    expect(p.look.hat).toBe('hat-cap')
    expect(bodyOf('luke', p.look)).toEqual(presetBody('Sprinter'))
    expect(bodyOf('luke', JSON.parse(JSON.stringify(equip(p, 'hat-cap'))).look).calves).toBe(100)
  })
})
