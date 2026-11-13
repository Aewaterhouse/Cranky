import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CFG } from '../src/config'
import { flushRides, postRide, queuedList, queuedRides } from '../src/core/rideQueue'

const ride = (date: string) => ({ record: { date }, power: [1, 2, 3] })

describe('rides waiting for the server', () => {
  let posted: string[]
  let online: boolean
  let status: number
  let room: number
  beforeEach(() => {
    const data = new Map<string, string>()
    posted = []
    online = true
    status = 200
    room = Infinity
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > room) throw new Error('QuotaExceededError')
        data.set(k, v)
      },
    })
    vi.stubGlobal('fetch', async (_: string, init?: RequestInit) => {
      if (!online) throw new TypeError('offline')
      if (status === 200) posted.push(JSON.parse(String(init?.body)).summary.record.date)
      return { ok: status === 200, status, statusText: 'x', json: async () => ({ saved: true }) }
    })
  })

  it('sends a ride straight away when online and keeps nothing', async () => {
    await postRide('me', ride('a'))
    expect(posted).toEqual(['a'])
    expect(queuedRides('me')).toBe(0)
  })

  it('keeps a ride finished offline and sends it when the server is back, once', async () => {
    online = false
    await postRide('me', ride('a'))
    await postRide('me', ride('b'))
    expect(posted).toEqual([])
    expect(queuedRides('me')).toBe(2)
    // History lists them with their downloads until the server has them
    expect(queuedList<ReturnType<typeof ride>>('me').map((r) => r.power)).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ])
    online = true
    await flushRides('me')
    expect(posted).toEqual(['a', 'b'])
    expect(queuedRides('me')).toBe(0)
    await flushRides('me')
    expect(posted).toEqual(['a', 'b'])
  })

  it('keeps rides through a server error but drops one the server refuses for good', async () => {
    status = 503
    await postRide('me', ride('a'))
    expect(queuedRides('me')).toBe(1)
    status = 422
    await flushRides('me')
    expect(queuedRides('me')).toBe(0)
  })

  it('keeps each rider their own queue, and only the newest few', async () => {
    online = false
    for (let i = 0; i < CFG.rideQueueMax + 2; i++) await postRide('me', ride(`r${i}`))
    await postRide('luke', ride('x'))
    expect(queuedRides('me')).toBe(CFG.rideQueueMax)
    expect(queuedRides('luke')).toBe(1)
    online = true
    await flushRides('me')
    expect(posted[0]).toBe('r2')
    expect(queuedRides('luke')).toBe(1)
  })

  it('drops the oldest queued ride when storage is full rather than losing the new one', async () => {
    online = false
    await postRide('me', ride('old'))
    room = JSON.stringify([ride('new')]).length
    await postRide('me', ride('new'))
    online = true
    room = Infinity
    await flushRides('me')
    expect(posted).toEqual(['new'])
  })
})
