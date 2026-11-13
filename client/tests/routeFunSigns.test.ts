import { describe, expect, it } from 'vitest'
import { CHALK_LINES } from '../src/fun/chalkLines'
import { SIGN_LINES } from '../src/fun/signLines'
import { VIS } from '../src/scene/params'
import {
  chalkRows,
  chalkSpan,
  dealer,
  planChalk,
  planFunSigns,
  stretches,
  wrap,
} from '../src/scene/route/funSigns'
import { FUN } from '../src/scene/route/funVis'
import { rng } from '../src/scene/route/scatter'
import { funWorld } from './funWorld'

const R = VIS.route
const S = FUN.signs
const C = FUN.chalk
const flat = <T extends { d: number }>(m: Map<number, T[]>) =>
  [...m.values()].flat().sort((a, b) => a.d - b.d)
const tagOf = (text: string) => SIGN_LINES.find((l) => wrap(l[0]) === text)?.[1]
const chalkTag = (text: string) =>
  CHALK_LINES.find((l) =>
    new RegExp(`^${l[0].replace(/[()?]/g, '\\$&').replace('{km}', '\\d+')}$`).test(text),
  )?.[1]

describe('the words', () => {
  it('has a good-sized pool of each, with no repeats', () => {
    expect(SIGN_LINES.length).toBeGreaterThanOrEqual(60)
    expect(CHALK_LINES.length).toBeGreaterThanOrEqual(40)
    expect(new Set(SIGN_LINES.map((l) => l[0])).size).toBe(SIGN_LINES.length)
    expect(new Set(CHALK_LINES.map((l) => l[0])).size).toBe(CHALK_LINES.length)
  })
  it('wraps every sign into three lines that fit a board', () => {
    expect(wrap('SHUT THE GATE', 13)).toBe('SHUT THE GATE')
    expect(wrap('IT GETS WORSE AFTER THIS', 13)).toBe('IT GETS WORSE\nAFTER THIS')
    for (const [text] of SIGN_LINES) {
      const lines = wrap(text).split('\n')
      expect(lines.length).toBeLessThanOrEqual(3)
      for (const l of lines) expect(l.length, text).toBeLessThanOrEqual(19)
    }
  })
  it('keeps chalk short enough to paint across a road', () => {
    for (const [text] of CHALK_LINES) expect(text.length, text).toBeLessThanOrEqual(24)
  })
  it('deals by tag, the same way for the same seed, using every line before any repeats', () => {
    const deal = dealer(SIGN_LINES, rng(7))
    const again = dealer(SIGN_LINES, rng(7))
    const ramps = SIGN_LINES.filter((l) => l[1] === 'ramp')
    const got = ramps.map(() => deal('ramp')!)
    expect(got.map((l) => l[1])).toEqual(ramps.map(() => 'ramp'))
    expect(new Set(got).size).toBe(ramps.length)
    expect(ramps.map(() => again('ramp'))).toEqual(got)
    expect(deal('ramp')).toBe(got[0])
    expect(deal('nothing')).toBeUndefined()
  })
})

// 1 km flat, 1.5 km at 10%, 1 km at 2% (a false flat), 1 km down at 6%, then flat to 8 km.
const ele = (d: number) =>
  100 +
  Math.min(Math.max(0, d - 1000), 1500) * 0.1 +
  Math.min(Math.max(0, d - 2500), 1000) * 0.02 -
  Math.min(Math.max(0, d - 3500), 1000) * 0.06
const hilly = () => funWorld(8, 100, (_, n) => (n > 5000 ? 'u' : 'f'), undefined, ele)

describe('funny signs', () => {
  const w = hilly()
  const plan = () => flat(planFunSigns('x', w.field, w.cover, w.features, [1000, 2000, 960]))
  const signs = plan()
  it('finds false flats and descents', () => {
    const ff = stretches(w.path, S.falseMin, S.falseMax, S.falseLength)
    expect(ff).toHaveLength(1)
    expect(ff[0].d0).toBeGreaterThan(2450)
    expect(ff[0].d0).toBeLessThan(2650)
    expect(stretches(w.path, -1, -S.descentMin, S.descentLength)).toHaveLength(1)
  })
  it('is the same for everyone on the route and different on another', () => {
    expect(plan()).toEqual(signs)
    expect(flat(planFunSigns('y', w.field, w.cover, w.features, []))).not.toEqual(signs)
  })
  it('ties signs to the road: before the ramp, on the false flat, over the top, down the hill, 1 km to go', () => {
    const at = (tag: string) => signs.filter((s) => s.tag === tag).map((s) => Math.round(s.d))
    expect(at('ramp')[0]).toBeGreaterThan(1000 - S.rampAhead - 60)
    expect(at('ramp')[0]).toBeLessThan(1000)
    expect(at('falseflat')).toHaveLength(1)
    expect(at('top')).toHaveLength(1)
    expect(at('top')[0]).toBeGreaterThan(3400)
    expect(at('descent')).toHaveLength(1)
    expect(at('togo')).toEqual([7000 + S.nudge])
    expect(at('start')).toEqual([S.startAt])
  })
  it('words every sign to suit its spot', () => {
    for (const s of signs) expect(tagOf(s.text), s.text).toBe(s.tag)
    const fillers = signs.filter((s) => s.d > 5200 && !['togo'].includes(s.tag))
    expect(fillers.length).toBeGreaterThan(1)
    for (const s of fillers) expect(['suburb', 'any']).toContain(s.tag)
    for (const s of signs.filter((q) => q.d < 4800)) expect(s.tag).not.toBe('suburb')
  })
  it('keeps them apart, off the road and away from real signs', () => {
    signs.forEach((s, i) => {
      if (i) expect(s.d - signs[i - 1].d).toBeGreaterThanOrEqual(S.apart)
      expect(Math.abs(s.x - 600)).toBeGreaterThan(R.roadHalf + R.verge)
      for (const t of [1000, 2000, 960])
        expect(Math.abs(s.d - t)).toBeGreaterThanOrEqual(S.clearFurn)
      expect(s.d).toBeGreaterThanOrEqual(S.endClear)
    })
    expect(signs.length).toBeGreaterThan(8000 / S.gapMax)
  })
  it('marks the snowline and sea level once each way', () => {
    const snowy = funWorld(
      4,
      100,
      () => 's',
      undefined,
      (d) => R.snowLine - 100 + d * 0.08,
    )
    const up = flat(planFunSigns('x', snowy.field, snowy.cover, snowy.features, []))
    expect(up.filter((s) => s.tag === 'snow')).toHaveLength(1)
    const coast = funWorld(
      4,
      3,
      () => 'g',
      undefined,
      () => 3,
    )
    const low = flat(planFunSigns('x', coast.field, coast.cover, coast.features, []))
    expect(low.filter((s) => s.tag === 'sea')).toHaveLength(1)
  })
})

describe('chalk', () => {
  const w = hilly()
  const chalk = flat(planChalk('x', w.path))
  it('is the same for everyone', () => {
    expect(flat(planChalk('x', hilly().path))).toEqual(chalk)
  })
  it('goes up the ramp every couple of hundred metres with climbing words, and "nearly there" near the top', () => {
    const up = chalk.filter((c) => c.d > 950 && c.d < 2550)
    expect(up.length).toBeGreaterThanOrEqual(Math.floor(1400 / C.gapMax))
    up.forEach((c, i) => {
      expect(c.text).not.toContain('{km}')
      expect(['climb', 'steep', 'top', 'long', 'km'], c.text).toContain(chalkTag(c.text))
      if (i) expect(c.d - up[i - 1].d).toBeGreaterThanOrEqual(C.gapMin)
    })
    const last = up[up.length - 1]
    expect(chalkTag(last.text)).toBe('top')
    expect(
      up.filter((c) => chalkTag(c.text) === 'top').every((c) => c.d > 2500 - C.topWithin - 60),
    ).toBe(true)
  })
  it('only leaves flat-road words on the flat', () => {
    const off = chalk.filter((c) => c.d < 900 || c.d > 4700)
    expect(off.length).toBeGreaterThan(0)
    for (const c of off) expect(chalkTag(c.text)).toBe('flat')
    expect(chalk.filter((c) => c.d > 2800 && c.d < 4400)).toHaveLength(0)
  })
  it('counts down the kilometres on a long ramp', () => {
    const long = funWorld(
      12,
      100,
      () => 'f',
      undefined,
      (d) => 100 + d * 0.07,
    )
    const km = flat(planChalk('x', long.path)).filter((c) => /\d KM/.test(c.text))
    expect(km.length).toBeGreaterThan(0)
    for (const c of km)
      expect(+c.text.match(/(\d+) KM/)![1]).toBeCloseTo((12000 - c.d) / 1000, -0.2)
  })
})

describe('chalk and the centre line', () => {
  it('breaks the line under the whole message with room either end', () => {
    const C = FUN.chalk
    expect(chalkRows('ALLEZ ALLEZ ALLEZ').length).toBe(3)
    const [a, b] = chalkSpan({ d: 500, text: 'ALLEZ ALLEZ ALLEZ', tint: 0 })
    expect(a).toBeLessThan(500 - C.letterL / 2)
    expect(b).toBeGreaterThan(500 + 2 * C.letterL * C.rowGap + C.letterL / 2)
    const [c, e] = chalkSpan({ d: 500, text: 'ARROW', tint: 0 })
    expect(e - c).toBeCloseTo(C.letterL + 2 * C.lineClear)
  })
})
