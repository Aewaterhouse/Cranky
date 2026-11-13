import { describe, expect, it } from 'vitest'
import { PerfMon } from '../src/scene/perfMon'

describe('frame-time monitor', () => {
  it('reports nothing before the first frame', () => {
    expect(new PerfMon().stats()).toMatchObject({ fps: 0, low1: 0, frames: 0, builds: 0 })
  })

  it('averages the frame rate and finds the slowest 1%', () => {
    const p = new PerfMon(200)
    // 198 frames at 10 ms and two at 100 ms: the 1% low is the two slow ones.
    for (let i = 0; i < 198; i++) p.frame(0.01)
    p.frame(0.1)
    p.frame(0.1)
    const s = p.stats()
    expect(s.frames).toBe(200)
    expect(s.fps).toBeCloseTo(1000 / ((198 * 10 + 200) / 200), 3)
    expect(s.low1).toBeCloseTo(10, 3)
    expect(s.worstMs).toBeCloseTo(100, 3)
  })

  it('keeps only the last window of frames', () => {
    const p = new PerfMon(50)
    for (let i = 0; i < 50; i++) p.frame(0.5)
    for (let i = 0; i < 50; i++) p.frame(0.02)
    const s = p.stats()
    expect(s.frames).toBe(50)
    expect(s.fps).toBeCloseTo(50, 3)
    expect(s.low1).toBeCloseTo(50, 3)
  })

  it('tallies chunk builds and forgets on reset', () => {
    const p = new PerfMon(10, 4)
    p.frame(0.016)
    for (const ms of [10, 20, 60]) p.build(ms)
    expect(p.stats()).toMatchObject({ builds: 3, buildMs: 30, buildWorstMs: 60 })
    for (const ms of [100, 100]) p.build(ms)
    expect(p.stats().builds).toBe(4)
    expect(p.stats().buildMs).toBeCloseTo(70)
    p.reset()
    expect(p.stats().frames).toBe(0)
  })
})
