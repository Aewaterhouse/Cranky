import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newProfile } from '../src/core/curve'
import { RideController } from '../src/modes/rideController'
import { SimTrainer } from '../src/trainer/simTrainer'
import type { Frame } from '../src/types'

const frame: Frame = { el: 0, i: 0, bel: 0, type: 'steady', label: 'x', dur: 600, tgt: 180 }

describe('trainer dropout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('re-requests control and re-sends the target, and the controller survives', async () => {
    const sim = new SimTrainer(undefined, () => 0.5)
    const ride = new RideController(
      sim,
      newProfile('a', 'A', 200),
      { id: 'p', name: 'P', blocks: [{ type: 'steady', dur: 600 }] },
      () => Date.now() / 1000,
    )
    const status: string[] = []
    ride.onTrainerStatus = (s) => status.push(s)
    ride.start()
    ride.setFrame(frame)
    const run = async (n: number) => {
      for (let i = 0; i < n; i++) {
        sim.step(0.25)
        await vi.advanceTimersByTimeAsync(250)
      }
    }
    await run(40)
    expect(sim.erg).toBe(180)
    expect(ride.live.power).toBe(180)
    const controls = sim.log.filter((l) => l === 'control').length

    sim.dropFor(15000)
    expect(ride.trainerStatus).toBe('reconnecting')
    expect(ride.live.power).toBe(0)
    await run(40)
    expect(ride.live.power).toBe(0)
    expect(sim.log).not.toContain('release')

    await vi.advanceTimersByTimeAsync(6000)
    await run(8)
    expect(status).toEqual(['reconnecting', 'connected'])
    expect(sim.erg).toBe(180)
    expect(sim.log.filter((l) => l === 'control').length).toBe(controls + 1)
    expect(ride.live.power).toBe(180)
    await ride.stop()
    expect(sim.log.slice(-2)).toEqual(['erg 100', 'release'])
  })

  it('exposes live.hr and records it each second', async () => {
    let bpm: number | null = null
    const sim = new SimTrainer(undefined, () => 0.5)
    const plan = { id: 'p', name: 'P', blocks: [{ type: 'steady' as const, dur: 600 }] }
    const ride = new RideController(
      sim,
      newProfile('a', 'A', 200),
      plan,
      () => Date.now() / 1000,
      () => bpm,
    )
    ride.start()
    ride.setFrame(frame)
    await vi.advanceTimersByTimeAsync(1000)
    bpm = 150
    sim.step(0.25)
    await vi.advanceTimersByTimeAsync(1000)
    await ride.stop()
    expect(ride.live.hr).toBe(150)
    expect(ride.rec.hr).toEqual([null, 150])
  })
})
