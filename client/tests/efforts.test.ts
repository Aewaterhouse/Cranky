import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushEfforts, localBests, rideBests, saveEfforts } from '../src/core/efforts'
import type { Effort } from '../src/core/segmentTracker'

const effort = (secs: number, date: string, segment = 'hill:climb:1000'): Effort => ({
  route: 'hill',
  segment,
  name: 'Hill',
  kind: 'climb',
  secs,
  watts: 200,
  wkg: 2.5,
  date,
})

describe('efforts on this device', () => {
  let posted: Effort[][]
  let online: boolean
  let server: unknown
  beforeEach(() => {
    const data = new Map<string, string>()
    posted = []
    online = true
    server = { mine: {}, crew: {} }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    })
    vi.stubGlobal('fetch', async (_: string, init?: RequestInit) => {
      if (!online) throw new TypeError('offline')
      if (init?.method === 'POST') posted.push(JSON.parse(String(init.body)).efforts)
      return { ok: true, json: async () => (init?.method === 'POST' ? { saved: 1 } : server) }
    })
  })

  it('keeps the best per segment and sends efforts straight away when online', async () => {
    await saveEfforts('me', [effort(400, 'a')])
    await saveEfforts('me', [effort(380, 'b'), effort(420, 'c')])
    expect(localBests('me')['hill:climb:1000'].secs).toBe(380)
    expect(posted.map((b) => b.map((e) => e.date))).toEqual([['a'], ['b', 'c']])
  })

  it('queues efforts ridden offline and sends them all once the server is back', async () => {
    online = false
    await saveEfforts('me', [effort(400, 'a')])
    await saveEfforts('me', [effort(390, 'b')])
    expect(posted).toEqual([])
    expect(localBests('me')['hill:climb:1000'].secs).toBe(390)
    online = true
    await flushEfforts('me')
    expect(posted.map((b) => b.map((e) => e.date))).toEqual([['a', 'b']])
    await flushEfforts('me')
    expect(posted).toHaveLength(1)
  })

  it('starts a ride with this device’s bests and merges in the server’s and the crew’s', async () => {
    online = false
    await saveEfforts('me', [effort(400, 'a')])
    online = true
    server = {
      mine: {
        'hill:climb:1000': { secs: 395, date: 'z' },
        'hill:route:0': { secs: 900, date: 'y' },
      },
      crew: {
        'hill:climb:1000': [
          { id: 'me', name: 'Me', secs: 395, date: 'z' },
          { id: 'luke', name: 'Luke', secs: 410, date: 'x' },
        ],
      },
    }
    const bests = rideBests('me', 'hill')
    expect(bests['hill:climb:1000'].pr?.secs).toBe(400)
    await new Promise((r) => setTimeout(r, 0))
    expect(bests['hill:climb:1000'].pr?.secs).toBe(395)
    expect(bests['hill:climb:1000'].crew).toMatchObject({ name: 'Luke', secs: 410 })
    expect(bests['hill:route:0'].pr?.secs).toBe(900)
    expect(localBests('me')['hill:route:0'].secs).toBe(900)
  })
})
