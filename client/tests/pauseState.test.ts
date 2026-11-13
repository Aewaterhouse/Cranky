import { describe, expect, it } from 'vitest'
import { PauseState } from '../src/modes/freeRide/pauseState'

describe('free-ride pause', () => {
  it('waits for the first pedal strokes, then rides', () => {
    const p = new PauseState()
    expect([p.paused, p.starting, p.why]).toEqual([true, true, 'auto'])
    p.toggle()
    expect(p.manual).toBe(false)
    p.step(false, 0, 1)
    expect(p.paused).toBe(true)
    p.step(false, 1, 0.6)
    expect([p.paused, p.starting, p.why]).toEqual([false, false, null])
  })

  it('auto-pauses after three seconds halted, not on a coasting descent', () => {
    const p = new PauseState()
    p.step(false, 5, 2)
    for (let i = 0; i < 10; i++) p.step(true, 12, 1)
    expect(p.paused).toBe(false)
    p.step(true, 1, 2.9)
    expect(p.paused).toBe(false)
    p.step(true, 1, 0.2)
    expect(p.why).toBe('auto')
    p.step(false, 1, 1.5)
    expect(p.paused).toBe(false)
  })

  it('pauses and resumes by hand, and never in a group ride', () => {
    const p = new PauseState()
    p.step(false, 5, 2)
    p.toggle()
    expect(p.why).toBe('manual')
    p.step(false, 5, 5)
    expect(p.paused).toBe(true)
    p.toggle()
    expect(p.paused).toBe(false)
    p.toggle()
    p.never()
    expect([p.paused, p.starting]).toEqual([false, false])
  })
})
