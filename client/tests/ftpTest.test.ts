import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { blockTarget, parsePlan, startOf } from '../src/core/plan'
import { bestAverage, coolStart, ftpResult, testSpec } from '../src/modes/drill/ftpTest'

const load = (id: string) =>
  parsePlan(
    JSON.parse(readFileSync(new URL(`../../content/workouts/${id}.json`, import.meta.url), 'utf8')),
  )

describe('ftp test plans', () => {
  const ramp = load('ftp-ramp-test')
  it('ramp steps start at 46% and rise 6% a minute, never past the 150% cap', () => {
    const s = testSpec(ramp)!
    const steps = ramp.blocks.slice(s.from, s.to)
    expect(steps).toHaveLength(18)
    steps.forEach((b, n) => {
      expect(b.dur).toBe(60)
      expect(blockTarget(b, 'hard', 0)).toBeCloseTo((46 + 6 * n) / 100)
    })
    expect(blockTarget(steps[17], 'hard', 0)).toBeLessThanOrEqual(1.5)
    expect(ramp.blocks[0].dur).toBe(300)
    expect(ramp.blocks[s.to].label).toBe('Cool-down')
    expect(coolStart(ramp)).toBe(startOf(ramp.blocks, s.to))
  })
  it('20 minute test has a free-ride 20 minutes after warm-up, openers and blow-out', () => {
    const p = load('ftp-20min-test')
    const s = testSpec(p)!
    expect(p.blocks[s.from]).toMatchObject({ type: 'free', dur: 1200 })
    expect(p.blocks.filter((b) => b.label === 'Opener')).toHaveLength(3)
    expect(p.blocks.some((b) => b.label === 'Blow-out' && b.dur === 300)).toBe(true)
  })
  it('plain plans have no test spec', () => {
    expect(testSpec(load('ss-2x15'))).toBeNull()
  })
})

describe('ftp result', () => {
  const ramp = load('ftp-ramp-test')
  const t0 = startOf(ramp.blocks, testSpec(ramp)!.from)
  const series = (watts: (t: number) => number, from: number, to: number) => {
    const xs = Array.from({ length: to - from }, (_, i) => from + i)
    return { xs, power: xs.map(watts) }
  }

  it('best average finds the strongest window', () => {
    const { xs, power } = series((t) => (t >= 100 && t < 160 ? 300 : 100), 0, 300)
    expect(bestAverage(power, xs, 60)).toBe(300)
    expect(bestAverage([100, 100], [0, 1], 60)).toBeNull()
  })
  it('ramp: 75% of the best minute', () => {
    const { xs, power } = series((t) => 100 + (t - t0) * 2, t0, t0 + 600)
    // best 60 s is the last one: mean of 100 + 2k over k = 540..599
    const best = 100 + 2 * 569.5
    expect(ftpResult(ramp, power, xs)).toBe(Math.round(best * 0.75))
  })
  it('ramp ignores the warm-up and cool-down', () => {
    const cool = startOf(ramp.blocks, testSpec(ramp)!.to)
    const { xs, power } = series((t) => (t < t0 || t >= cool ? 900 : 200), 0, cool + 100)
    expect(ftpResult(ramp, power, xs)).toBe(150)
  })
  it('ramp with too little data gives null', () => {
    const { xs, power } = series(() => 200, t0, t0 + 20)
    expect(ftpResult(ramp, power, xs)).toBeNull()
  })
  it('20 minute: 95% of the average, null when cut short', () => {
    const p = load('ftp-20min-test')
    const a = startOf(p.blocks, testSpec(p)!.from)
    const full = series(() => 263, a, a + 1200)
    expect(ftpResult(p, full.power, full.xs)).toBe(250)
    const short = series(() => 263, a, a + 600)
    expect(ftpResult(p, short.power, short.xs)).toBeNull()
  })
})
