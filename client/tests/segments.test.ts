import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { buildRoute, withLaps, type Route } from '../src/core/route'
import { ROUTE_INDEX, loadRoute } from '../src/core/routeLibrary'
import {
  modelTimes,
  routeSegments,
  segClock,
  segFrac,
  splitText,
  type Segment,
} from '../src/core/segments'
import { SegmentTracker, traceAt } from '../src/core/segmentTracker'
import { segmentRun } from '../src/modes/freeRide/segmentRun'

/** A route from [length m, gradient %] legs. */
const legs = (id: string, l: [number, number][], extra: Partial<Route> = {}) => {
  let d = 0
  let ele = 100
  const pts = [{ d, ele }]
  for (const [len, pct] of l) {
    for (let s = 10; s <= len; s += 10) pts.push({ d: d + s, ele: ele + (s * pct) / 100 })
    d += len
    ele += (len * pct) / 100
  }
  return buildRoute(id, 'Test Hill', pts, undefined, extra)
}
const hill = () =>
  legs('hill', [
    [1000, 0],
    [1500, 6],
    [1000, 0],
  ])

describe('segment derivation', () => {
  it('gives a climb, a sprint near the end and the whole route, the same every time', () => {
    const s = routeSegments(hill())
    expect(s.map((x) => x.kind)).toEqual(['climb', 'sprint', 'route'])
    expect(s[0].name).toBe('Test Hill · climb 1')
    expect(s[1].end - s[1].start).toBe(CFG.segments.sprint.lenM)
    expect(s[1].end).toBe(3500)
    expect(s[2]).toMatchObject({ id: 'hill:route:0', start: 0, end: 3500 })
    expect(routeSegments(hill())).toEqual(s)
  })

  it('makes ids from the route, the kind and the rounded start', () => {
    const [climb, sprint] = routeSegments(hill())
    expect(climb.id).toBe(`hill:climb:${Math.round(climb.start / 100) * 100}`)
    expect(sprint.id).toBe('hill:sprint:3200')
  })

  it('calls the whole of a circuit one lap, and a lap ride has the same segments as its lap', () => {
    const loop = legs(
      'ring',
      [
        [600, 0],
        [400, 5],
        [400, -5],
        [600, 0],
      ],
      { loop: true },
    )
    const s = routeSegments(loop)
    expect(s[s.length - 1]).toMatchObject({
      id: 'ring:lap:0',
      kind: 'lap',
      name: 'Test Hill · one lap',
    })
    expect(routeSegments(withLaps(loop, 3))).toEqual(s)
  })

  it('puts the sprint on the flattest stretch when nothing is flat, and skips it on a very short route', () => {
    const s = routeSegments(
      legs('up', [
        [1000, 6],
        [400, 3],
        [1000, 7],
      ]),
    )
    const sprint = s.find((x) => x.kind === 'sprint')!
    expect(sprint.start).toBeGreaterThanOrEqual(900)
    expect(sprint.end).toBeLessThanOrEqual(1500)
    expect(routeSegments(legs('short', [[400, 0]])).map((x) => x.kind)).toEqual(['route'])
  })

  it('names a climb after a named peak near its top', () => {
    const r = hill()
    r.points.forEach((p, i) => ((p.lat = -27 + i * 0.00009), (p.lon = 153)))
    r.terrain = { cell: 30, lat0: -27, lon0: 153, cols: 1, rows: 1, runs: [] }
    const top = routeSegments(r)[0].end
    r.features = {
      pois: [
        { n: 'Mount Test', k: 'peak', at: [50, top * 0.995] },
        { n: '', k: 'peak', at: [0, top] },
      ],
    }
    expect(routeSegments(r)[0].name).toBe('Mount Test climb')
  })

  it('finds segments with unique ids on every bundled route', async () => {
    for (const r of ROUTE_INDEX) {
      const segs = routeSegments(await loadRoute(r.id))
      expect(new Set(segs.map((s) => s.id)).size).toBe(segs.length)
      expect(segs[segs.length - 1].kind).toBe(r.loop ? 'lap' : 'route')
      for (const s of segs) expect(s.end).toBeGreaterThan(s.start)
    }
  })
})

describe('split maths', () => {
  it('shares time by how long a steady rider takes, not by distance', () => {
    const r = hill()
    const times = modelTimes(r)
    const whole = routeSegments(r)[2]
    expect(segFrac(times, 10, whole, 0)).toBe(0)
    expect(segFrac(times, 10, whole, 3500)).toBe(1)
    // 1 km of flat is 29% of the distance but far less of the time on a route with a 1.5 km climb.
    expect(segFrac(times, 10, whole, 1000)).toBeLessThan(0.2)
  })

  it('formats splits and times', () => {
    expect(splitText(-4)).toBe('−0:04')
    expect(splitText(71)).toBe('+1:11')
    expect(splitText(0)).toBe('+0:00')
    expect(segClock(24.31)).toBe('24.3 s')
    expect(segClock(402)).toBe('6:42')
    expect(segClock(3725)).toBe('1:02:05')
  })
})

describe('segment tracker', () => {
  const seg = { id: 's', kind: 'climb' as const, name: 'S', start: 100, end: 300 }
  const mk = (segs: Segment[] = [seg], lapM?: number, laps?: number) =>
    new SegmentTracker(segs, 'r', 80, lapM, laps, () => 'now')

  it('times a segment to where its lines were crossed, with average power', () => {
    const t = mk()
    // 10 m/s at 200 W in 3 s ticks: the lines at 100 and 300 m fall mid-tick.
    let out: ReturnType<typeof t.update> = []
    for (let i = 1; i <= 12 && !out.length; i++) out = t.update(i * 30, i * 3, i * 600)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      segment: 's',
      route: 'r',
      secs: 20,
      watts: 200,
      wkg: 2.5,
      date: 'now',
    })
    expect(out[0].trace).toBeUndefined()
  })

  it('knows the time so far only while on the segment', () => {
    const t = mk()
    t.update(50, 5, 0)
    expect(t.elapsed(seg, 5)).toBeUndefined()
    t.update(150, 15, 0)
    expect(t.elapsed(seg, 15)).toBeCloseTo(5)
    t.update(350, 35, 0)
    expect(t.elapsed(seg, 35)).toBeUndefined()
  })

  it('counts every lap as a go and keeps a trace of each lap', () => {
    const lap = { id: 'l', kind: 'lap' as const, name: 'L', start: 0, end: 1000 }
    const t = mk([lap], 1000, 3)
    const done = []
    for (let s = 1; s <= 300; s++) done.push(...t.update(Math.min(3000, s * 10), s, s * 150))
    expect(done.map((e) => [e.lap, e.secs, e.watts])).toEqual([
      [1, 100, 150],
      [2, 100, 150],
      [3, 100, 150],
    ])
    expect(done[0].trace).toHaveLength(19)
    expect(done[0].trace![0]).toBe(50)
    expect(traceAt(done[0].trace!, 100, 1000, 52)).toBeCloseTo(520)
    expect(traceAt(done[0].trace!, 100, 1000, 99)).toBeCloseTo(990)
    expect(traceAt(done[0].trace!, 100, 1000, 500)).toBe(1000)
    expect(traceAt([], 3, 30, 1.5)).toBeCloseTo(15)
  })

  it('drops a go on a position jump that was not ridden', () => {
    const t = mk()
    t.update(150, 15, 0)
    expect(t.update(400, 16, 0, true)).toEqual([])
    expect(t.elapsed(seg, 16)).toBeUndefined()
    expect(t.update(500, 26, 0)).toEqual([])
  })
})

describe('segments in a ride', () => {
  const ride = (bests: Parameters<typeof segmentRun>[2], speed = 10) => {
    const said: [string, number][] = []
    const stored: string[] = []
    const run = segmentRun(
      hill(),
      { id: 'me', kg: 80 },
      bests,
      (t, l) => said.push([t, l]),
      (e) => stored.push(e.segment),
    )
    const lives = []
    for (let s = 0; s <= 3500 / speed; s++)
      lives.push(run.tick(Math.min(3500, s * speed), s, 200, 1))
    return { run, said, stored, lives }
  }

  it('shows the segment coming up, then a live split against my best and the crew, then the result', () => {
    const climb = routeSegments(hill())[0]
    const len = climb.end - climb.start
    const bests = {
      [climb.id]: {
        pr: { secs: len / 10 + 10, date: '' },
        crew: { id: 'luke', name: 'Luke', secs: len / 10 - 20, date: '' },
      },
    }
    const { run, said, stored, lives } = ride(bests)
    const before = lives[Math.floor((climb.start - 50) / 10)].seg!
    expect(before.inM).toBeGreaterThan(0)
    expect(before.lines[0]).toMatch(/^PR /)
    const late = lives[Math.floor((climb.end - 20) / 10)].seg!
    expect(late.name).toBe(climb.name)
    expect(late.lines[1]).toMatch(/^−0:(09|1[0-2]) vs PR$/)
    expect(late.lines[2]).toMatch(/^\+0:(1[6-9]|20) vs Luke$/)
    const res = run.results.find((r) => r.segment === climb.id)!
    expect(res).toMatchObject({ pr: true, first: false, crewBest: false, watts: 200 })
    expect(said.find(([t]) => t.startsWith('New PR!'))?.[1]).toBe(1)
    expect(stored).toContain(climb.id)
    // The whole route was a first go: it is a PR too, and everything ridden is in the results.
    expect(run.results.map((r) => r.kind).sort()).toEqual(['climb', 'route', 'sprint'])
    expect(run.results.find((r) => r.kind === 'route')).toMatchObject({ first: true, pr: true })
    expect(bests[climb.id].pr.secs).toBeCloseTo(len / 10, 0)
  })

  it('gives a crew best the bigger fanfare and a miss a plain line', () => {
    const climb = routeSegments(hill())[0]
    const secs = (climb.end - climb.start) / 10
    const fast = ride({ [climb.id]: { crew: { id: 'l', name: 'Luke', secs: secs + 5, date: '' } } })
    expect(fast.said.find(([t]) => t.startsWith('Crew best!'))?.[1]).toBe(2)
    expect(fast.run.results[0]).toMatchObject({ crewBest: true, pr: true })
    const slow = ride({ [climb.id]: { pr: { secs: secs - 30, date: '' } } })
    expect(slow.said.find(([t]) => t.includes('on your best'))?.[1]).toBe(0)
    expect(slow.run.results[0]).toMatchObject({ pr: false, prevS: secs - 30 })
  })
})
