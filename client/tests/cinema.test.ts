import { describe, expect, it } from 'vitest'
import { CineClock, cineSecs } from '../src/scene/cineClock'
import { CAM } from '../src/scene/camVis'

/** Steps `secs` in 1/60 s frames and returns the last frame. */
const run = (c: CineClock, secs: number) => {
  let f = c.step(0)
  for (let t = 0; t < secs; t += 1 / 60) f = c.step(1 / 60)
  return f
}

describe('streak cinematics', () => {
  it('hold 3 to 5 s, then blend back to the rider view', () => {
    for (const k of ['airstrike', 'drop', 'gunship'] as const) {
      expect(cineSecs(k)).toBeGreaterThanOrEqual(3)
      expect(cineSecs(k)).toBeLessThanOrEqual(5)
    }
    const c = new CineClock()
    expect(c.start('airstrike', true)).toBe(true)
    let f = run(c, 0.5)
    expect(f.cam).toBe(1)
    expect(f.title).toBe('AIR STRIKE')
    expect(f.bars).toBe(1)
    f = run(c, CAM.strikeS - 0.5 + CAM.backS / 2)
    expect(f.title).toBe('')
    expect(f.cam).toBeGreaterThan(0)
    expect(f.cam).toBeLessThan(1)
    f = run(c, CAM.backS)
    expect(f).toEqual({ cam: 0, bars: 0, title: '' })
    expect(c.kind).toBeNull()
  })

  it('skips straight to the blend back, and only while showing', () => {
    const c = new CineClock()
    expect(c.skip()).toBe(false)
    c.start('drop', true)
    run(c, 1)
    expect(c.skip()).toBe(true)
    expect(c.showing).toBe(false)
    expect(c.skip()).toBe(false)
    expect(run(c, CAM.backS + 0.1).cam).toBe(0)
  })

  it('never takes the camera for the gunship, only the bars and title', () => {
    const c = new CineClock()
    c.start('gunship', true)
    const f = run(c, 1)
    expect(f.cam).toBe(0)
    expect(f.title).toBe('GUNSHIP')
    expect(f.bars).toBe(1)
  })

  it('does nothing with the setting off', () => {
    const c = new CineClock()
    expect(c.start('airstrike', false)).toBe(false)
    expect(run(c, 1)).toEqual({ cam: 0, bars: 0, title: '' })
  })
})
