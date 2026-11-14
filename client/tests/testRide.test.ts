import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newProfile } from '../src/core/curve'
import { RideRecorder } from '../src/core/ride'
import { noteTrainer, simConnected, usesSim } from '../src/core/testRide'
import { RideController } from '../src/modes/rideController'
import { SimTrainer } from '../src/trainer/simTrainer'
import { rideRewards } from '../src/ui/resultsRewards'
import { mvpLine, type GroupSummary } from '../src/ui/resultsViews'
import type { Frame, Trainer } from '../src/types'

const frame: Frame = { el: 0, i: 0, bel: 0, type: 'steady', label: 'x', dur: 600, tgt: 180 }
const plan = { id: 'p', name: 'P', blocks: [{ type: 'steady' as const, dur: 600 }] }

/** A real trainer as the ride sees one: power on every reading, no `sim` flag. */
function realTrainer(): Trainer & { push: () => void } {
  let cb: (d: { power: number; cadence: number }) => void = () => {}
  const ok = async () => {}
  return {
    name: 'KICKR',
    connect: ok,
    onData: (f) => void (cb = f),
    onStatus: () => {},
    requestControl: ok,
    setPower: ok,
    setSim: ok,
    setResistance: ok,
    release: ok,
    push: () => cb({ power: 200, cadence: 90 }),
  }
}

async function ride(t: Trainer & { push?: () => void }, secs: number, mid?: () => void) {
  const r = new RideController(t, newProfile('a', 'A', 200), plan, () => Date.now() / 1000)
  r.start()
  r.setFrame(frame)
  for (let i = 0; i < secs; i++) {
    if (i === Math.floor(secs / 2)) mid?.()
    t.push?.()
    if (t instanceof SimTrainer) t.step(1)
    await vi.advanceTimersByTimeAsync(1000)
  }
  await r.stop()
  return r
}

describe('test rides (simulated trainer)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    noteTrainer(null)
    vi.useRealTimers()
  })

  it('a ride on a real trainer has no test flag at all', async () => {
    const r = await ride(realTrainer(), 10)
    expect(r.rec.power.length).toBeGreaterThan(5)
    expect('test' in JSON.parse(JSON.stringify(r.rec.summary()))).toBe(false)
  })

  it('a ride on the simulator is a test ride', async () => {
    const r = await ride(new SimTrainer(undefined, () => 0.5), 10)
    expect(r.rec.summary().test).toBe(true)
  })

  it('switching to the simulator mid-ride makes it a test ride, and switching back does not undo it', async () => {
    const sim = new SimTrainer()
    const r = await ride(realTrainer(), 20, () => noteTrainer(sim))
    expect(r.rec.summary().test).toBe(true)
    noteTrainer(realTrainer())
    expect(simConnected()).toBe(false)
    expect(r.noteSim()).toBe(true)
  })

  it('the app trainer flag follows the trainer modal', () => {
    noteTrainer(new SimTrainer())
    expect(simConnected() && usesSim(realTrainer())).toBe(true)
    noteTrainer(realTrainer())
    expect(usesSim(realTrainer())).toBe(false)
    expect(usesSim(new SimTrainer())).toBe(true)
  })

  it('crash recovery keeps the flag', () => {
    const rec = new RideRecorder(plan, 200)
    rec.sim = true
    expect(RideRecorder.fromJSON(JSON.parse(JSON.stringify(rec.toJSON()))).summary().test).toBe(
      true,
    )
    const old = rec.toJSON() as Partial<ReturnType<RideRecorder['toJSON']>>
    delete old.sim // a snapshot from before the flag
    expect(RideRecorder.fromJSON(old as ReturnType<RideRecorder['toJSON']>).sim).toBe(false)
  })

  it('a test ride earns nothing: no bests, totals, streak, scrap or badges', () => {
    const rec = new RideRecorder(plan, 200)
    for (let i = 0; i < 1200; i++) rec.sample(0, 250, 90, 180, 1, true, null)
    const p = newProfile('a', 'A', 200)
    const real = rideRewards(p, rec.summary())
    expect(real.p).not.toBe(p)
    rec.sim = true
    const test = rideRewards(p, rec.summary())
    expect(test.p).toBe(p)
    expect([test.unlocked, test.banked, test.week.won]).toEqual([[], 0, []])
  })

  it("a test rider has no best bit and doesn't push a real rider down the crew", () => {
    const row = (id: string, compliance: number, test?: boolean) =>
      ({
        id,
        name: id,
        compliance,
        inBandSecs: 0,
        sprints: [],
        falls: 0,
        test,
      }) as GroupSummary['riders'][number]
    const all = [row('sim', 0.99, true), row('real', 0.9), row('other', 0.5)]
    expect(mvpLine(all[0], all)).toBe('Test ride (simulator)')
    expect(mvpLine(all[1], all)).toMatch(/^🏅/)
  })
})
