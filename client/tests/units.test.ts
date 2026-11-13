import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { gradeColour, setGradePalette, windText } from '../src/core/hud'
import { wantsLessMotion } from '../src/core/settings'
import {
  climbIn,
  climbLabel,
  distIn,
  distLabel,
  distText,
  speedIn,
  speedText,
  unitNames,
  weightIn,
  weightToKg,
} from '../src/core/units'

describe('display units', () => {
  it('leaves metric alone', () => {
    expect(speedIn(10, 'metric')).toBeCloseTo(36)
    expect(distIn(12345, 'metric')).toBeCloseTo(12.345)
    expect(climbIn(303, 'metric')).toBe(303)
    expect(weightIn(75, 'metric')).toBe(75)
    expect(unitNames('metric')).toEqual({ speed: 'km/h', dist: 'km', climb: 'm', weight: 'kg' })
  })

  it('converts to miles, feet, mph and pounds', () => {
    expect(speedIn(10, 'imperial')).toBeCloseTo(22.369, 2)
    expect(distIn(1609.344, 'imperial')).toBeCloseTo(1)
    expect(distIn(100000, 'imperial')).toBeCloseTo(62.137, 2)
    expect(climbIn(1000, 'imperial')).toBeCloseTo(3280.84, 1)
    expect(weightIn(75, 'imperial')).toBeCloseTo(165.35, 1)
    expect(unitNames('imperial')).toEqual({ speed: 'mph', dist: 'mi', climb: 'ft', weight: 'lb' })
  })

  it('takes a typed weight back to kilograms without drift', () => {
    for (const kg of [48.5, 75, 102.3]) {
      expect(weightToKg(weightIn(kg, 'imperial'), 'imperial')).toBeCloseTo(kg, 6)
      expect(weightToKg(kg, 'metric')).toBe(kg)
    }
    // What the box shows (one decimal of pounds) comes back within 50 g.
    const shown = +weightIn(75, 'imperial').toFixed(1)
    expect(Math.abs(weightToKg(shown, 'imperial') - 75)).toBeLessThan(0.05)
  })

  it('writes the labels the screens use', () => {
    expect(distLabel(12040, 'metric')).toBe('12.0 km')
    expect(distLabel(12040, 'imperial')).toBe('7.5 mi')
    expect(distText(9500, 'metric')).toBe('9.50')
    expect(distText(25000, 'metric')).toBe('25.0')
    expect(distText(25000, 'imperial')).toBe('15.5')
    expect(climbLabel(303, 'metric')).toBe('303 m')
    expect(climbLabel(303, 'imperial')).toBe('994 ft')
    expect(climbLabel(1402, 'imperial')).toBe('4,600 ft')
    expect(speedText(6.5, 'metric')).toBe('23.4')
    expect(speedText(6.5, 'imperial')).toBe('14.5')
    expect(windText(3, 'metric')).toBe('Head 11 km/h')
    expect(windText(-3, 'imperial')).toBe('Tail 7 mph')
    expect(windText(0.1)).toBe('Still')
  })
})

describe('gradient palette', () => {
  const H = CFG.hud
  it('has a colour-blind-safe colour for every band, on the same boundaries', () => {
    expect(H.gradeBandsCb.map((b) => b.lt)).toEqual(H.gradeBands.map((b) => b.lt))
    expect(new Set(H.gradeBandsCb.map((b) => b.colour)).size).toBe(H.gradeBandsCb.length)
    // No green in the safe set: green against red is the pair that goes missing.
    for (const b of H.gradeBandsCb) {
      const [r, g, bl] = [1, 3, 5].map((i) => parseInt(b.colour.slice(i, i + 2), 16))
      expect(g > r + 30 && g > bl + 30).toBe(false)
    }
  })

  it('picks the palette from the setting, or as asked', () => {
    expect(gradeColour(6)).toBe(H.gradeBands[3].colour)
    expect(gradeColour(6, true)).toBe(H.gradeBandsCb[3].colour)
    setGradePalette(true)
    expect(gradeColour(6)).toBe(H.gradeBandsCb[3].colour)
    expect(gradeColour(-8)).toBe(H.gradeBandsCb[0].colour)
    expect(gradeColour(40)).toBe(H.gradeBandsCb[6].colour)
    setGradePalette(false)
    expect(gradeColour(6)).toBe(H.gradeBands[3].colour)
  })
})

describe('settings', () => {
  it('reduced motion follows the device unless told otherwise', () => {
    expect(wantsLessMotion('auto', true)).toBe(true)
    expect(wantsLessMotion('auto', false)).toBe(false)
    expect(wantsLessMotion('on', false)).toBe(true)
    expect(wantsLessMotion('off', true)).toBe(false)
  })

  it('has three camera distances around the standard one', () => {
    const d = CFG.camDist
    expect(d.standard).toBe(1)
    expect(d.near).toBeLessThan(1)
    expect(d.far).toBeGreaterThan(1)
  })
})
