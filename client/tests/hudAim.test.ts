import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { busAim, soloAim } from '../src/core/aim'
import { effortSummary, isRest, listWindow, nextText, tolerance, tolText } from '../src/core/hud'

describe('tolerance bar', () => {
  it.each([
    [200, 'ok'],
    [210, 'ok'],
    [190, 'ok'],
    [211, 'warn'],
    [180, 'warn'],
    [221, 'bad'],
    [150, 'bad'],
  ])('%i W against 200 W is %s', (w, state) => expect(tolerance(w, 200).state).toBe(state))

  it('uses the compliance band the ride is scored with', () =>
    expect(tolerance(200 * (1 + CFG.compliance.band), 200).state).toBe('ok'))

  it('puts the needle in the middle on target and pins it at the ends', () => {
    expect(tolerance(200, 200).pos).toBe(0.5)
    expect(tolerance(0, 200).pos).toBe(0)
    expect(tolerance(900, 200).pos).toBe(1)
    expect(tolerance(230, 200).pos).toBeCloseTo(0.75)
  })

  it('says which way to go in words', () => {
    expect(tolText(203, 200)).toBe('on target')
    expect(tolText(170, 200)).toBe('▲ push 30 W')
    expect(tolText(240, 200)).toBe('▼ ease 40 W')
  })
})

describe('the Next chip', () => {
  it('names the duration and the power', () =>
    expect(nextText({ type: 'steady', tgt: 320 }, 300)).toBe('Next: 5:00 at 320 W'))
  it('never names a power for a sprint or a free block', () => {
    expect(nextText({ type: 'sprint', tgt: null }, 10)).toBe('Next: 0:10 sprint, all out')
    expect(nextText({ type: 'sprint', tgt: 900 }, 10)).not.toMatch(/\d W/)
    expect(nextText({ type: 'free', tgt: null }, 120)).toBe('Next: 2:00 free ride')
  })
  it('counts zone 1 and free blocks as rests, never a sprint', () => {
    expect(isRest('steady', 100, 200)).toBe(true)
    expect(isRest('steady', 120, 200)).toBe(false)
    expect(isRest('free', null, 200)).toBe(true)
    expect(isRest('sprint', null, 200)).toBe(false)
  })
})

describe('interval summary and list', () => {
  it('gives average, watts off target and the share in band', () =>
    expect(effortSummary({ secs: 200, avgPower: 247, avgTarget: 250, inBandSecs: 150 })).toEqual({
      avg: 247,
      off: -3,
      inBand: 0.75,
    }))
  it('survives an interval with no seconds', () =>
    expect(effortSummary({ secs: 0, avgPower: 0, avgTarget: 0, inBandSecs: 0 }).inBand).toBe(0))
  it('keeps the current interval one from the top and never runs off either end', () => {
    expect(listWindow(20, 0, 7)).toEqual([0, 7])
    expect(listWindow(20, 5, 7)).toEqual([4, 11])
    expect(listWindow(20, 19, 7)).toEqual([13, 20])
    expect(listWindow(3, 2, 7)).toEqual([0, 3])
  })
})

describe('what the power panel is told', () => {
  const frame = (type: 'steady' | 'sprint' | 'free', tgt: number | null) => ({
    el: 0,
    i: 0,
    bel: 0,
    type,
    label: 'x',
    dur: 60,
    tgt,
  })
  it('leads with the target in ERG and with power outside it', () => {
    expect(soloAim(frame('steady', 250), null)).toMatchObject({ target: 250, targetLeads: true })
    const res = soloAim(frame('steady', 250), 'Resistance 40%')
    expect(res.targetLeads).toBeFalsy()
    expect(res.note).toBe('Resistance 40%')
    expect(res.chip).toBe('aim 250 W')
  })
  it('never gives a sprint a target power, even if the frame carries one', () => {
    for (const aim of [
      soloAim(frame('sprint', null), null),
      soloAim(frame('sprint', 900), null),
      soloAim(frame('sprint', 900), 'Slope +2%'),
      busAim(frame('sprint', null), 700, 640),
      busAim(frame('sprint', 900), 300, 640),
    ]) {
      expect(aim.target ?? null).toBeNull()
      expect(aim.cap).toBe('Sprint')
      expect(aim.chip).toBe('ERG off')
    }
  })
  it('shows the best sprint so far, and says when it is beaten', () => {
    expect(busAim(frame('sprint', null), 300, 640).note).toBe('All out · best 640 W')
    expect(busAim(frame('sprint', null), 700, 640).note).toBe('All out · new best!')
    expect(busAim(frame('sprint', null), 640 * CFG.hud.sprintBarOver, 640).fill).toBeCloseTo(1)
  })
  it('has no target in a free block or before the start', () => {
    expect(soloAim(frame('free', null), null).target ?? null).toBeNull()
    expect(busAim(frame('free', null), 150, 640).target ?? null).toBeNull()
    expect(busAim(null, 150, 640).note).toBe('Get ready')
  })
  it('puts power first in the bus, with the target beneath', () =>
    expect(busAim(frame('steady', 180), 150, 640)).toMatchObject({ target: 180 }))
})
