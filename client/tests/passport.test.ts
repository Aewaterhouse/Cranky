import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { BORDERS, MAINLAND, MAP_SIZE, ROUTE_AT, TASMANIA, mapXY, spread } from '../src/core/ausMap'
import { badges, stickBadges } from '../src/core/badges'
import { newProfile, type Profile } from '../src/core/curve'
import { passportBadges, stampRide } from '../src/core/passport'
import { ROUTE_INDEX, loadRoute } from '../src/core/routeLibrary'
import { featuredRoute, vertTarget, weekOf, weekState, weeklyRewards } from '../src/core/weekly'

const ride = (id: string, date: string, ascent: number, ...secs: number[]) => ({
  route: { id },
  ascent,
  record: { date },
  segments: [
    { kind: 'climb', secs: 99 },
    ...secs.map((s) => ({ kind: id === 'nundah-crit' ? 'lap' : 'route', secs: s })),
  ],
})
const finishAll = (p: Profile, ids: string[]) =>
  ids.reduce((q, id) => stampRide(q, ride(id, '2026-11-10T08:00:00Z', 100, 1000)), p)

describe('the map of Australia', () => {
  it('has a dot position for every bundled route, at the start of its pack', async () => {
    for (const r of ROUTE_INDEX) {
      const [lon, lat] = ROUTE_AT[r.id] ?? [NaN, NaN]
      const start = (await loadRoute(r.id)).points[0]
      expect(Math.abs(lat - start.lat!), r.id).toBeLessThan(0.01)
      expect(Math.abs(lon - start.lon!), r.id).toBeLessThan(0.01)
    }
  })

  it('keeps every corner and every route inside the drawing', () => {
    for (const ll of [...MAINLAND, ...TASMANIA, ...BORDERS.flat(), ...Object.values(ROUTE_AT)]) {
      const [x, y] = mapXY(ll)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(MAP_SIZE[0])
      expect(y).toBeLessThanOrEqual(MAP_SIZE[1])
    }
    // East is right and south is down.
    expect(mapXY([153, -27])[0]).toBeGreaterThan(mapXY([116, -32])[0])
    expect(mapXY([147, -42])[1]).toBeGreaterThan(mapXY([131, -12])[1])
  })

  it('spreads a city of dots apart, the same way every time, without sending them far', () => {
    const home = Object.values(ROUTE_AT).map(mapXY)
    const gap = CFG.passport.dotGap
    const at = spread(home, gap)
    for (let i = 0; i < at.length; i++) {
      expect(Math.hypot(at[i][0] - home[i][0], at[i][1] - home[i][1])).toBeLessThan(gap * 3.5)
      for (let j = i + 1; j < at.length; j++)
        expect(Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1])).toBeGreaterThan(gap * 0.85)
    }
    expect(spread(home, gap)).toEqual(at)
  })
})

describe('passport stamps', () => {
  it('counts finishes, keeps the best time and adds up the climbing', () => {
    let p = newProfile('me', 'Me')
    p = stampRide(p, ride('willunga-hill', '2026-11-01T08:00:00Z', 210, 700))
    p = stampRide(p, ride('willunga-hill', '2026-11-02T08:00:00Z', 120)) // gave up halfway
    p = stampRide(p, ride('willunga-hill', '2026-11-03T08:00:00Z', 210, 680))
    expect(p.passport!['willunga-hill']).toEqual({
      n: 2,
      bestS: 680,
      vertM: 540,
      first: '2026-11-01T08:00:00Z',
    })
    // Every lap of a circuit is a time ridden; the best is the best lap.
    p = stampRide(p, ride('nundah-crit', '2026-11-04T08:00:00Z', 30, 130, 121, 125))
    expect(p.passport!['nundah-crit']).toMatchObject({ n: 3, bestS: 121 })
    expect(stampRide(p, { record: { date: 'x' } })).toBe(p)
  })

  it('starts unfinished routes without a first date or a best', () => {
    const p = stampRide(newProfile('me'), ride('falls-creek', '2026-11-01T08:00:00Z', 400))
    expect(p.passport!['falls-creek']).toEqual({
      n: 0,
      vertM: 400,
      bestS: undefined,
      first: undefined,
    })
  })
})

describe('passport badges', () => {
  const got = (p: Profile) =>
    passportBadges(p, ROUTE_INDEX)
      .filter((b) => b[5])
      .map((b) => b[0])

  it('gives firsts, All of Brisbane, a state each and the grand tour as routes are finished', () => {
    const me = newProfile('me')
    expect(got(me)).toEqual([])
    expect(got(finishAll(me, ['willunga-hill']))).toEqual(['pp1'])
    const brisbane = [
      'mount-coot-tha',
      'mount-coot-tha-back',
      'mondo',
      'full-gas-friday',
      'nundah-crit',
    ]
    expect(got(finishAll(me, brisbane.slice(1)))).toEqual(['pp1'])
    expect(got(finishAll(me, brisbane))).toEqual(['pp1', 'pp5', 'ppBris'])
    const states = ['nundah-crit', 'akuna-bay', 'beach-road', 'ben-lomond', 'willunga-hill']
    expect(got(finishAll(me, states))).toEqual(['pp1', 'pp5', 'ppStates'])
    const all = got(
      finishAll(
        me,
        ROUTE_INDEX.map((r) => r.id),
      ),
    )
    expect(all).toEqual(['pp1', 'pp5', 'ppStates', 'ppBris', 'ppAll'])
  })

  it('names the climbing and repeat badges after the route they were earned on', () => {
    let p = newProfile('me')
    for (let i = 0; i < 5; i++)
      p = stampRide(p, ride('mount-coot-tha', `2026-10-0${i + 1}T08:00:00Z`, 1800, 2000))
    const b = passportBadges(p, ROUTE_INDEX)
    const by = (id: string) => b.find((x) => x[0] === id)!
    expect(
      by('ppRep1')
        .slice(1, 2)
        .concat(by('ppRep1')[5] as never),
    ).toEqual(['Regular at Coot-tha', true])
    expect(by('ppRep2')[5]).toBe(false)
    expect([by('ppVert1')[5], by('ppVert2')[5], by('ppVert3')[5]]).toEqual([true, true, true])
    expect(by('ppVert3')[1]).toBe('Everested Coot-tha')
  })

  it('is part of the badge list and stays earned', () => {
    const p = finishAll(newProfile('me'), ['willunga-hill'])
    const first = badges(p).find((b) => b.id === 'pp1')!
    expect(first).toMatchObject({ earned: true, date: '2026-11-10T08:00:00Z', name: 'First Stamp' })
    expect(stickBadges(p)).toBe(true)
    expect(badges({ ...p, passport: {} }).find((b) => b.id === 'pp1')!.earned).toBe(true)
    expect(new Set(badges(p).map((b) => b.id)).size).toBe(badges(p).length)
  })
})

describe('weekly route and climb', () => {
  const week = weekOf(Date.parse('2026-11-11T10:00:00Z'))
  const utc = (iso: string) => weekOf(Date.parse(iso), 0)

  it('picks the same featured route for everyone all week and a different one next week', () => {
    const a = featuredRoute(ROUTE_INDEX, week)!
    expect(featuredRoute([...ROUTE_INDEX].reverse(), week)).toBe(a)
    // Monday to Sunday, by the clock on the wall: Brisbane is ten hours ahead of UTC.
    expect([utc('2026-11-09T00:30:00Z'), utc('2026-11-15T23:30:00Z')]).toEqual([week, week])
    expect([utc('2026-11-08T23:30:00Z'), utc('2026-11-16T00:30:00Z')]).toEqual([week - 1, week + 1])
    expect(weekOf(Date.parse('2026-11-15T13:30:00Z'), -600)).toBe(week)
    expect(weekOf(Date.parse('2026-11-15T14:30:00Z'), -600)).toBe(week + 1)
    const year = Array.from({ length: 52 }, (_, i) => featuredRoute(ROUTE_INDEX, week + i)!.id)
    year.slice(1).forEach((id, i) => expect(id).not.toBe(year[i]))
    expect(new Set(year).size).toBeGreaterThan(8)
    expect(featuredRoute([], week)).toBeUndefined()
  })

  it('sets a default climbing target, then a bit more than the recent average, within limits', () => {
    const c = CFG.weekly.vert
    const p = newProfile('me')
    expect(vertTarget(p, week)).toBe(c.defaultM)
    p.weeks = { [week - 1]: { vertM: 1000 }, [week - 2]: { vertM: 0 }, [week - 3]: { vertM: 2000 } }
    expect(vertTarget(p, week)).toBe(1650)
    // This week's own climbing never moves this week's target.
    p.weeks[week] = { vertM: 5000 }
    expect(vertTarget(p, week)).toBe(1650)
    expect(vertTarget({ ...p, weeks: { [week - 1]: { vertM: 20 } } }, week)).toBe(c.minM)
    expect(vertTarget({ ...p, weeks: { [week - 1]: { vertM: 90000 } } }, week)).toBe(c.maxM)
  })

  it('pays for the featured route and the climbing target once each a week', () => {
    const feat = featuredRoute(ROUTE_INDEX, week)!
    const done = ride(feat.id, '2026-11-11T10:00:00Z', 400, 900)
    let { p, won } = weeklyRewards(newProfile('me'), done, ROUTE_INDEX)
    expect(won.map((w) => w.scrap)).toEqual([CFG.weekly.featuredScrap])
    expect(p.scrap).toBe(CFG.weekly.featuredScrap)
    expect(weekState(p, week)).toMatchObject({ vertM: 400, featuredDone: true, vertDone: false })
    // Riding it again the same week pays nothing more, but the climbing still counts to the target.
    ;({ p, won } = weeklyRewards(p, done, ROUTE_INDEX))
    expect(won.map((w) => w.scrap)).toEqual([CFG.weekly.vert.scrap])
    expect(p.scrap).toBe(CFG.weekly.featuredScrap + CFG.weekly.vert.scrap)
    ;({ p, won } = weeklyRewards(p, done, ROUTE_INDEX))
    expect(won).toEqual([])
    expect(p.scrap).toBe(CFG.weekly.featuredScrap + CFG.weekly.vert.scrap)
    expect(weekState(p, week)).toMatchObject({ vertM: 1200, featuredDone: true, vertDone: true })
  })

  it('pays nothing for an unfinished featured route, another route, or a ride that was not a free ride', () => {
    const feat = featuredRoute(ROUTE_INDEX, week)!
    const other = ROUTE_INDEX.find((r) => r.id !== feat.id)!
    const me = newProfile('me')
    expect(weeklyRewards(me, ride(feat.id, '2026-11-11T10:00:00Z', 50), ROUTE_INDEX).won).toEqual(
      [],
    )
    expect(
      weeklyRewards(me, ride(other.id, '2026-11-11T10:00:00Z', 50, 900), ROUTE_INDEX).won,
    ).toEqual([])
    const plain = weeklyRewards(me, { record: { date: '2026-11-11T10:00:00Z' } }, ROUTE_INDEX)
    expect(plain.p).toBe(me)
    // Old weeks are dropped once the target no longer looks at them.
    const old = { ...me, weeks: { [week - 9]: { vertM: 500 }, [week - 2]: { vertM: 700 } } }
    const kept = weeklyRewards(old, ride(other.id, '2026-11-11T10:00:00Z', 50), ROUTE_INDEX).p
      .weeks!
    expect(Object.keys(kept).map(Number).sort()).toEqual([week - 2, week])
  })
})
