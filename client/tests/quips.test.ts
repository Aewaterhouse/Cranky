import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { QUIP_LINES } from '../src/fun/quipLines'
import { Quipper, nearTag, type QuipState } from '../src/modes/freeRide/quips'
import { LANDMARK_KINDS } from '../src/scene/route/landmarkPlan'
import { ODD_KINDS } from '../src/scene/route/oddPlan'
import { rng } from '../src/scene/route/scatter'

const Q = CFG.freeRide.quips
const tagOf = (text: string | undefined) => QUIP_LINES.find((l) => l[0] === text)?.[1]
const has = (tag: string) => QUIP_LINES.some((l) => l[1] === tag)
const base: QuipState = {
  now: 0,
  t: 0,
  dist: 0,
  total: 20000,
  grade: 0,
  speed: 8,
  ftpPct: 70,
  stopped: false,
}
/** Rides for `secs` a second at a time with `state(t)` and collects [time, remark] pairs. */
function ride(secs: number, state: (t: number) => Partial<QuipState>, q = new Quipper(rng(3))) {
  const out: [number, string][] = []
  for (let t = 0; t < secs; t++) {
    const said = q.next({ ...base, now: t, t, dist: t * 8, ...state(t) })
    if (said) out.push([t, said])
  }
  return out
}

describe('quip lines', () => {
  it('has a good-sized pool with no repeats', () => {
    expect(QUIP_LINES.length).toBeGreaterThanOrEqual(80)
    expect(new Set(QUIP_LINES.map((l) => l[0])).size).toBe(QUIP_LINES.length)
  })
  it('has words for every oddity, every landmark and every way of riding', () => {
    for (const k of [...ODD_KINDS, ...LANDMARK_KINDS]) expect(nearTag(k, has), k).toBeDefined()
    for (const t of 'summit halfway togo start steep climb descent fast slow easy hard stopped long flat any'.split(
      ' ',
    ))
      expect(has(t), t).toBe(true)
    expect(nearTag('bigPie', has)).toBe('near:big')
    expect(nearTag('nothing', has)).toBeUndefined()
  })
  it('keeps encouragement short', () => {
    for (const [text, tag] of QUIP_LINES) if (tag === 'hard') expect(text.length).toBeLessThan(20)
  })
})

describe('the commentator', () => {
  it('never speaks more than about once a minute on an ordinary ride', () => {
    const said = ride(3600, (t) => ({
      grade: Math.sin(t / 200) * 8,
      near: t % 90 < 5 ? 'couch' : undefined,
    }))
    expect(said.length).toBeGreaterThan(10)
    expect(said.length).toBeLessThanOrEqual(60)
    said.forEach(([t], i) => {
      if (i) expect(t - said[i - 1][0]).toBeGreaterThanOrEqual(Q.milestoneGapS)
    })
    const ordinary = said.filter(
      ([, s]) => !['start', 'halfway', 'summit', 'togo'].includes(tagOf(s)!),
    )
    ordinary.forEach(([t], i) => {
      if (i) expect(t - ordinary[i - 1][0]).toBeGreaterThanOrEqual(Q.gapS)
    })
  })
  it('says the same things given the same luck', () => {
    const state = (t: number) => ({ grade: Math.sin(t / 200) * 8 })
    expect(ride(1500, state)).toEqual(ride(1500, state))
  })
  it('only encourages during a hard effort, and not often', () => {
    const said = ride(900, () => ({
      ftpPct: Q.hardPct + 10,
      near: 'couch',
      grade: 10,
      summit: true,
    }))
    expect(said.length).toBeGreaterThan(1)
    for (const [, s] of said) expect(tagOf(s)).toBe('hard')
    said.forEach(([t], i) => {
      if (i) expect(t - said[i - 1][0]).toBeGreaterThanOrEqual(Q.hardGapS)
    })
  })
  it('remarks on what is beside the road when it first appears', () => {
    const said = ride(
      400,
      (t) => ({ near: t >= 100 && t < 104 ? 'couch' : t >= 330 && t < 334 ? 'bigPie' : undefined }),
      new Quipper(() => 0.5),
    )
    expect(said.map(([t, s]) => [t, tagOf(s)])).toEqual(
      expect.arrayContaining([
        [100, 'near:couch'],
        [330, 'near:big'],
      ]),
    )
  })
  it('lets a thing go by when it has only just spoken', () => {
    const said = ride(
      130,
      (t) => ({ near: t >= 100 && t < 104 ? 'couch' : t >= 110 && t < 114 ? 'hay' : undefined }),
      new Quipper(() => 0.5),
    )
    expect(said.map(([, s]) => tagOf(s)).filter((t) => t?.startsWith('near'))).toEqual([
      'near:couch',
    ])
  })
  it('marks the start, halfway, the summit and the last kilometre once each', () => {
    const said = ride(2500, (t) => ({ summit: t > 1500 })).map(([, s]) => tagOf(s))
    for (const tag of ['start', 'halfway', 'summit', 'togo'])
      expect(said.filter((t) => t === tag)).toHaveLength(1)
    expect(said.indexOf('start')).toBe(0)
    const short = ride(250, () => ({ total: 2000 })).map(([, s]) => tagOf(s))
    expect(short).not.toContain('togo')
    expect(short).not.toContain('halfway')
  })
  it('suits the remark to the riding', () => {
    const tags = (state: Partial<QuipState>) =>
      new Set(ride(3000, () => ({ ...state, t: 100, dist: 100 })).map(([, s]) => tagOf(s)))
    expect([...tags({ grade: 11, speed: 3 })]).toEqual(['steep'])
    expect([...tags({ grade: 6, speed: 4 })]).toEqual(['climb'])
    expect([...tags({ grade: 6, speed: 1.5 })]).toEqual(['slow'])
    expect([...tags({ grade: -6, speed: 10 })]).toEqual(['descent'])
    expect([...tags({ grade: -6, speed: 18 })]).toEqual(['fast'])
    expect([...tags({ grade: 0, ftpPct: 30 })]).toEqual(['easy'])
    const cruising = tags({ grade: 0 })
    expect(cruising.has('any')).toBe(true)
    for (const t of cruising) expect(['any', 'flat']).toContain(t)
  })
  it('notices a stop once, after a while, and never repeats a line until the pool is used up', () => {
    const said = ride(400, (t) => ({
      stopped: t > 100,
      speed: t > 100 ? 0 : 8,
      ftpPct: t > 100 ? 0 : 70,
      t: Math.min(t, 100),
    }))
    const stops = said.filter(([, s]) => tagOf(s) === 'stopped')
    expect(stops).toHaveLength(1)
    expect(stops[0][0]).toBeGreaterThan(100 + Q.stoppedS)
    const any = ride(6000, () => ({ t: 100, dist: 100 })).map(([, s]) => s)
    const pool = QUIP_LINES.filter((l) => l[1] === 'any').length
    expect(new Set(any.filter((s) => tagOf(s) === 'any').slice(0, pool)).size).toBe(
      Math.min(pool, any.filter((s) => tagOf(s) === 'any').length),
    )
  })
})
