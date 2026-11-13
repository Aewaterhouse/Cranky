import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveEfforts } from '../src/core/efforts'
import { ghostD, myGhost } from '../src/core/ghost'
import { riderRows } from '../src/core/hud'
import { buildRoute, withLaps } from '../src/core/route'
import { RideRecorder } from '../src/core/ride'
import { rideExtras } from '../src/modes/freeRide/rideExtras'

const flat = (id: string, m: number, loop = false) =>
  buildRoute(
    id,
    'Flat',
    Array.from({ length: m / 10 + 1 }, (_, i) => ({ d: i * 10, ele: 50 })),
    undefined,
    { loop },
  )
// 1 km in 100 s at a steady 10 m/s: 50 m every 5 s.
const spec = {
  id: 'ghost:me',
  name: 'Your PR',
  secs: 100,
  trace: Array.from({ length: 19 }, (_, i) => (i + 1) * 50),
}

describe('ghosts', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    })
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline')
    })
  })

  it('rides its trace, stops at the finish, and laps a circuit over and over', () => {
    expect(ghostD(spec, 1000, 1000, 0)).toBe(0)
    expect(ghostD(spec, 1000, 1000, 42)).toBeCloseTo(420)
    expect(ghostD(spec, 1000, 1000, 500)).toBe(1000)
    expect(ghostD(spec, 1000, 3000, 142)).toBeCloseTo(1420)
    expect(ghostD(spec, 1000, 3000, 900)).toBe(3000)
  })

  it('comes from the best whole-route effort kept on this device', async () => {
    const r = flat('flat', 1000)
    expect(myGhost('me', r)).toBeUndefined()
    const effort = {
      route: 'flat',
      segment: 'flat:route:0',
      name: 'Flat',
      kind: 'route' as const,
      watts: 200,
      wkg: 2.5,
    }
    await saveEfforts('me', [{ ...effort, secs: 100, date: 'a', trace: spec.trace }])
    await saveEfforts('me', [{ ...effort, secs: 120, date: 'b', trace: [1, 2, 3] }])
    expect(myGhost('me', r)).toMatchObject({ id: 'ghost:me', secs: 100, trace: spec.trace })
    expect(myGhost('me', withLaps(flat('ring', 1000, true), 3))).toBeUndefined()
  })

  it('is listed with a ghost mark and a gap, and is only ever a position', () => {
    const route = withLaps(flat('ring', 1000, true), 2)
    const rec = new RideRecorder({ id: 'p', name: 'p', blocks: [] }, 200)
    const me = { id: 'me', name: 'Me', d: 0, offset: 0, speed: 0, cadence: 0 }
    const view = { toast: () => {} }
    const extras = rideExtras(route, { id: 'me', kg: 80, ftp: 250 }, rec, view, {
      me,
      group: false,
      ghosts: [spec],
    })
    let out = extras.tick(0, 0, 200)
    for (let s = 1; s <= 30; s++) out = extras.tick(s * 8, s, 200)
    const [g] = out.riders
    expect(g).toMatchObject({ id: 'ghost:me', ghost: true, d: 300 })
    expect(g.speed).toBeCloseTo(10)
    expect(g.power).toBeUndefined()
    const rows = riderRows([{ id: 'me', name: 'Me', d: 240 }, g], 'me')
    expect(rows.map((r) => [r.name, r.ghost, r.gapM])).toEqual([
      ['Your PR', true, 60],
      ['Me', undefined, 0],
    ])
    // Into the second lap the ghost is on its second go round.
    for (let s = 31; s <= 150; s++) out = extras.tick(s * 8, s, 200)
    expect(out.riders[0].d).toBeCloseTo(1500)
    extras.finish(1200)
    expect(rec.route).toEqual({ id: 'ring', name: 'Flat', laps: 2, done: false })
  })
})
