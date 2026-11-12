import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RideRecorder } from '../src/core/ride'
import {
  busKey,
  clearSnap,
  loadSnap,
  rememberBus,
  rememberedBus,
  saveSnap,
  soloKey,
  type BusSnap,
} from '../src/core/snapshot'

const plan = {
  id: 'x',
  name: 'X',
  blocks: [
    { type: 'steady' as const, dur: 30 },
    { type: 'sprint' as const, dur: 10 },
  ],
}

function recorder() {
  const r = new RideRecorder(plan, 200)
  for (let i = 0; i < 40; i++)
    r.sample(i < 30 ? 0 : 1, 180 + i, 90, i < 30 ? 200 : null, 0.9, true, 120 + i)
  r.sprints.push({ blk: 1, dur: 10, avg: 500, pct: 0.9, grade: 'GREAT', combo: 1 })
  return r
}

describe('RideRecorder JSON', () => {
  it('round-trips through JSON.stringify to an identical summary', () => {
    const r = recorder()
    const back = RideRecorder.fromJSON(JSON.parse(JSON.stringify(r)))
    expect(back.summary()).toEqual(r.summary())
    expect(back.startedAt).toBe(r.startedAt)
    expect(back.sprints).toHaveLength(1)
  })
  it('keeps recording after a restore', () => {
    const back = RideRecorder.fromJSON(JSON.parse(JSON.stringify(recorder())))
    back.sample(1, 200, 90, null, null, false, 150)
    expect(back.power).toHaveLength(41)
    expect(back.summary().blocks.find((b) => b.i === 1)?.secs).toBe(11)
  })
  it('does not share arrays with the snapshot', () => {
    const j = JSON.parse(JSON.stringify(recorder()))
    const back = RideRecorder.fromJSON(j)
    back.sample(0, 1, 1, null, null, false)
    expect(j.power).toHaveLength(40)
  })
})

describe('snapshots', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.stubGlobal('sessionStorage', { getItem: () => null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves with a timestamp and loads while fresh', () => {
    saveSnap(busKey('a', 'ABCD'), { planId: 'x', rec: recorder() })
    const s = loadSnap<BusSnap>(busKey('a', 'ABCD'))
    expect(s?.planId).toBe('x')
    expect(RideRecorder.fromJSON(s!.rec).power).toHaveLength(40)
  })
  it('ignores snapshots older than 30 minutes', () => {
    saveSnap(soloKey('a'), { x: 1 })
    expect(loadSnap(soloKey('a'), Date.now() + 29 * 60000)).not.toBeNull()
    expect(loadSnap(soloKey('a'), Date.now() + 31 * 60000)).toBeNull()
  })
  it('survives corrupt data and clears', () => {
    store.set(soloKey('a'), '{nope')
    expect(loadSnap(soloKey('a'))).toBeNull()
    saveSnap(soloKey('a'), {})
    clearSnap(soloKey('a'))
    expect(loadSnap(soloKey('a'))).toBeNull()
  })
  it('remembers the bus code per rider', () => {
    rememberBus('a', 'ABCD')
    expect(rememberedBus('a')).toBe('ABCD')
    expect(rememberedBus('b')).toBeNull()
  })
})
