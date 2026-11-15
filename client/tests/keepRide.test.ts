import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CFG } from '../src/config'
import { holdEfforts, localBests, saveEfforts } from '../src/core/efforts'
import { autoPosts, endWith, rideKeeper, takeEndChoice } from '../src/core/keepRide'
import { postRide, queuedList } from '../src/core/rideQueue'

const ride = (date: string) => ({ record: { date, secs: 1800 }, power: [100, 120] })
const effort = (secs: number, rideDate: string) => ({
  segment: 'r:climb',
  route: 'r',
  name: 'Climb',
  kind: 'climb' as const,
  secs,
  date: `${rideDate}-${secs}`,
  watts: 200,
  wkg: 3,
  rideDate,
})

describe('keeping or binning a ride on the results screen', () => {
  let calls: { url: string; body: { summary?: { noStrava?: boolean }; efforts?: unknown[] } }[]
  beforeEach(() => {
    vi.useFakeTimers()
    const data = new Map<string, string>()
    calls = []
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    })
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
      return {
        ok: true,
        status: 200,
        json: async () => ({ saved: true, id: calls.length, mine: {}, crew: {} }),
      }
    })
  })
  afterEach(() => vi.useRealTimers())
  const rides = () => calls.filter((c) => c.url === '/api/rides')
  const efforts = () => calls.filter((c) => c.url === '/api/efforts')
  const flush = () => vi.advanceTimersByTimeAsync(0)

  it('binning sends and keeps nothing, puts back the bests and the profile', async () => {
    saveEfforts('me', [effort(300, 'old')])
    await flush()
    holdEfforts('a')
    saveEfforts('me', [effort(250, 'a')])
    expect(localBests('me')['r:climb'].secs).toBe(250)
    await postRide('me', ride('a'), true)
    const restore = vi.fn()
    const k = rideKeeper({ rider: 'me', date: 'a', queued: true, restore })
    k.countdown()
    k.bin()
    await vi.advanceTimersByTimeAsync(CFG.stravaPostDelayS * 2000)
    k.keep() // leaving afterwards changes nothing
    await flush()
    expect(rides()).toEqual([])
    expect(efforts().flatMap((c) => c.body.efforts)).toHaveLength(1) // only the old ride's
    expect(queuedList('me')).toEqual([])
    expect(localBests('me')['r:climb'].secs).toBe(300)
    expect(restore).toHaveBeenCalledOnce()
    expect(k.state()).toBe('binned')
  })

  it('holds the ride until the countdown runs out, then sends it', async () => {
    await postRide('me', ride('b'), true)
    const ticks: number[] = []
    const k = rideKeeper({
      rider: 'me',
      date: 'b',
      queued: true,
      restore: () => {},
      onTick: (s) => ticks.push(s),
    })
    k.countdown()
    await vi.advanceTimersByTimeAsync((CFG.stravaPostDelayS - 1) * 1000)
    expect(rides()).toEqual([])
    expect(ticks.at(-1)).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(rides()).toHaveLength(1)
    expect(k.state()).toBe('kept')
  })

  it('leaving the screen sends it at once, without waiting', async () => {
    await postRide('me', ride('c'), true)
    const k = rideKeeper({ rider: 'me', date: 'c', queued: true, restore: () => {} })
    k.countdown()
    await vi.advanceTimersByTimeAsync(5000)
    expect(rides()).toEqual([])
    k.keep()
    await flush()
    expect(rides()).toHaveLength(1)
    expect(rides()[0].body.summary?.noStrava).toBeUndefined()
  })

  it("don't post keeps the ride, marked, and stops the countdown", async () => {
    await postRide('me', ride('d'), true)
    const k = rideKeeper({ rider: 'me', date: 'd', queued: true, restore: () => {} })
    k.countdown()
    k.noPost()
    await vi.advanceTimersByTimeAsync(CFG.stravaPostDelayS * 2000)
    expect(rides()).toEqual([]) // no countdown: kept only on leaving
    k.keep()
    await flush()
    const sent = rides()[0].body.summary!
    expect(sent.noStrava).toBe(true)
    expect(autoPosts({ connected: true, auto: true }, { ...ride('d'), ...sent })).toBe(false)
  })

  it('only a long enough real ride with Strava on posts by itself', () => {
    const on = { connected: true, auto: true }
    expect(autoPosts(on, ride('e'))).toBe(true)
    expect(autoPosts({ ...on, auto: false }, ride('e'))).toBe(false)
    expect(autoPosts(null, ride('e'))).toBe(false)
    expect(autoPosts(on, { ...ride('e'), test: true })).toBe(false)
    expect(autoPosts(on, { ...ride('e'), noStrava: true })).toBe(false)
    expect(autoPosts(on, { record: { secs: 10 }, power: [1] })).toBe(false)
  })

  it('a ride held when the page died is on the device and goes up (and on to Strava) at the next load', async () => {
    holdEfforts('f')
    saveEfforts('me', [effort(240, 'f')])
    await postRide('me', ride('f'), true)
    await flush()
    expect(rides()).toEqual([])
    // A reload or crash: the holds lived in memory only, the queue in storage.
    vi.resetModules()
    const q = await import('../src/core/rideQueue')
    const ef = await import('../src/core/efforts')
    const saved = vi.fn()
    q.onRideSaved(saved)
    expect(q.queuedList('me')).toHaveLength(1)
    await ef.flushEfforts('me')
    await q.flushRides('me')
    expect(
      rides().map((c) => (c.body.summary as { record: { date: string } }).record.date),
    ).toEqual(['f'])
    expect(efforts().flatMap((c) => c.body.efforts)).toHaveLength(1)
    expect(saved).toHaveBeenCalledOnce() // what starts the Strava upload when it is due
    expect(q.queuedList('me')).toEqual([])
  })

  it('the end-ride choice is read once', () => {
    endWith('bin')
    expect(takeEndChoice()).toBe('bin')
    expect(takeEndChoice()).toBeNull()
  })
})
