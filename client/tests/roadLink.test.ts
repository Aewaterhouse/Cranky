import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import type { Profile } from '../src/core/curve'
import { draftSaving, stepSpeed, totalMass } from '../src/core/physics'
import { buildRoute, routeAt } from '../src/core/route'
import { trainerTarget } from '../src/modes/freeRide/feel'
import { freePlan } from '../src/modes/freeRide/freeRide'
import { RoadLink, ordinal } from '../src/modes/freeRide/roadLink'
import { RideController } from '../src/modes/rideController'
import type { ClientMsg, RoadLobby, RoadRiderTick, RoadTick } from '../src/net/protocol'
import { SimTrainer } from '../src/trainer/simTrainer'

const R = CFG.road
const rider = (id: string, name = id) => ({
  id,
  name,
  ftp: 250,
  kg: 75,
  connected: true,
  look: {},
  bot: false,
  line: null,
})
const lobby = (ids: string[], together = false): RoadLobby => ({
  t: 'lobby',
  kind: 'road',
  code: 'ABCD',
  host: 'me',
  state: 'running',
  route: 'nundah-crit',
  laps: 1,
  distance: 1190,
  style: 'social',
  together,
  riders: ids.map((id) => rider(id, id === 'me' ? 'Me' : id[0].toUpperCase() + id.slice(1))),
})
const at = (d: number, v = 10, over: Partial<RoadRiderTick> = {}): RoadRiderTick => ({
  d,
  v,
  w: 200,
  cad: 90,
  hr: null,
  lane: -1.1,
  draft: 1,
  band: 1,
  st: 'riding',
  fin: null,
  ...over,
})
const tick = (el: number, riders: Record<string, RoadRiderTick>, fx: RoadTick['fx'] = []) =>
  ({ t: 'tick', kind: 'road', el, riders, game: null, fx }) as RoadTick

function make(ids = ['me', 'kev']) {
  const sent: ClientMsg[] = []
  const clock = { t: 100 }
  const link = new RoadLink(
    'me',
    (m) => sent.push(m),
    () => clock.t,
  )
  link.lobby(lobby(ids))
  return { link, sent, clock }
}

describe('group ride link', () => {
  it('counts down, then rides, then waits at the finish', () => {
    const { link, clock } = make()
    expect(link.banner()?.[0]).toBe('Get ready')
    link.tick(tick(-3.2, { me: at(0, 0), kev: at(0, 0) }))
    expect(link.countdown()).toBeCloseTo(3.2)
    clock.t += 0.5
    expect(link.countdown()).toBeCloseTo(2.7)
    expect(link.banner()?.[0]).toBe('3')
    link.tick(tick(4, { me: at(20), kev: at(22) }))
    expect(link.countdown()).toBe(0)
    expect(link.banner()).toBeUndefined()
    link.tick(tick(90, { me: at(1190, 0, { st: 'finished', fin: 88 }), kev: at(900) }))
    expect(link.banner()?.[0]).toBe('Finished')
    expect(link.correct(1100, 9, 0.2)).toEqual([1190, 0])
  })

  it('carries the others on between ticks and drafts off the wheel in front', () => {
    const { link, clock } = make()
    link.tick(tick(10, { me: at(100), kev: at(103, 10) }))
    expect(link.draft(100)).toBeCloseTo(1 - 0.3 * Math.exp(-1.5 / R.draft.decayM))
    clock.t += 0.3
    expect(link.others()[0].d).toBeCloseTo(106)
    expect(link.draft(104.5)).toBeCloseTo(1 - R.draft.levels.strong[1])
    expect(link.draft(107)).toBe(1)
    expect(draftSaving(10, 0.73)).toBeCloseTo(0.5 * 1.225 * 0.32 * 0.27 * 1000)
    link.tick(tick(11, { me: at(100), kev: at(103, 1) }))
    expect(link.draft(100)).toBe(1) // nobody drafts a rider who has all but stopped
  })

  it('keep-together only when the host has it on and I am riding', () => {
    const { link } = make(['me', 'kev', 'shaz'])
    link.tick(tick(10, { me: at(100), kev: at(400), shaz: at(420) }))
    expect(link.band(100, true)).toBe(1)
    link.lobby(lobby(['me', 'kev', 'shaz'], true))
    expect(link.band(100, true)).toBeCloseTo(1 + R.band.max)
    expect(link.band(600, true)).toBeLessThan(1)
    expect(link.band(100, false)).toBe(1)
  })

  it('eases my rider onto the server line and snaps after a rejoin', () => {
    const { link } = make()
    link.tick(tick(10, { me: at(100, 10), kev: at(150) }))
    const [d, v] = link.correct(98, 9, 0.2)
    expect(d).toBeGreaterThan(98)
    expect(d).toBeLessThan(98.5)
    expect(v).toBeGreaterThan(9)
    expect(v).toBeLessThan(9.2)
    expect(link.correct(0, 0, 0.2)).toEqual([100, 10])
    link.tick(tick(11, { me: at(110, 12, { band: 1.2 }), kev: at(160) }))
    expect(link.correct(0, 0, 0.2)[1]).toBeCloseTo(10) // physics speed, without the tow
  })

  it("a race's bell rings and holds a banner for a few seconds", () => {
    const { link, clock } = make()
    const rang: string[] = []
    link.onBell = (t) => rang.push(t)
    link.tick(tick(60, { me: at(500), kev: at(600) }, [{ k: 'bell', id: null, text: 'LAST LAP' }]))
    expect(rang).toEqual(['LAST LAP'])
    expect(link.banner()).toEqual(['LAST LAP', ''])
    clock.t += R.bannerS + 0.1
    expect(link.banner()).toBeUndefined()
  })

  it('says who joined, who finished and who caught whom', () => {
    const { link } = make()
    link.lobby(lobby(['me', 'kev', 'shaz']))
    expect(link.takeNotes()).toEqual(['Shaz joined'])
    link.tick(tick(5, { me: at(50, 10), kev: at(200, 8), shaz: at(52, 10) }))
    expect(link.takeNotes()).toEqual([])
    link.tick(tick(60, { me: at(500, 10), kev: at(503, 8), shaz: at(420, 6) }))
    expect(link.takeNotes()).toEqual(['You caught Kev', 'You dropped Shaz'])
    link.tick(tick(90, { me: at(700, 8), kev: at(790, 11), shaz: at(695, 9) }))
    expect(link.takeNotes()).toEqual(['Kev has dropped you', 'Shaz caught you'])
    const home = { me: at(700), kev: at(1190, 0, { st: 'finished' }) }
    link.tick(tick(91, home, [{ k: 'finish', id: 'kev', text: '1' }]))
    expect(link.takeNotes()).toEqual(['Kev finished 1st'])
    expect([1, 2, 3, 4, 11].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th'])
  })

  it('a group ride never sends the trainer a power target, and the server only measurements', async () => {
    const route = buildRoute('t', 'Test hill', [
      { d: 0, ele: 0 },
      { d: 400, ele: 30 },
      { d: 800, ele: 10 },
    ])
    const profile = { id: 'me', name: 'Me', ftp: 250, weightKg: 75, tier: 'hard' } as Profile
    const sim = new SimTrainer()
    const ride = new RideController(sim, profile, freePlan(route, 250, 75))
    const { link, sent, clock } = make()
    const mass = totalMass(75)
    ride.start()
    let dist = 0
    let speed = 0
    let srv = 0
    for (let k = 0; k < 400 && dist < route.distance; k++) {
      const el = k * 0.2 - 2
      clock.t += 0.2
      if (el > 0) srv = Math.min(route.distance, srv + 9 * 0.2)
      link.tick(tick(el, { me: at(srv, 9), kev: at(srv + 3, 9) }))
      const waiting = link.countdown() > 0
      if (!waiting) {
        const g = routeAt(route, dist).grade
        speed = stepSpeed(speed, 260, g, mass, 0.2, 0, undefined, link.draft(dist))
        ;[dist, speed] = link.correct(dist + speed * 0.2, speed, 0.2)
      }
      ride.setFrame({ el, i: 0, bel: el, type: 'free', label: 't', dur: 999, tgt: null })
      const grade = trainerTarget(route, dist, speed, 0.5, waiting, 90, CFG.gears.start, mass)
      ride.erg.setGrade(grade, CFG.freeRide.grade)
      await ride.erg.tick()
      link.report(260, 258, 90, 150)
    }
    // Stopping is the one ERG write there is: the safe 50% of FTP before control is handed back (AGENTS.md).
    const during = [...sim.log]
    await ride.stop()
    expect(sim.log.slice(during.length)).toEqual(['erg 125', 'release'])
    expect(dist).toBeGreaterThan(700)
    expect(during.length).toBeGreaterThan(5)
    expect(during.filter((l) => l.startsWith('erg'))).toEqual([])
    expect(sent.length).toBeGreaterThan(50)
    expect(sent.every((m) => m.t === 'data' && !('tgt' in m))).toBe(true)
    expect(Object.keys(sent[0]).sort()).toEqual(['cad', 'hr', 'p', 't', 'w'])
  })

  it('the group-ride modules cannot reach the trainer except through setGrade', () => {
    const src = (f: string) => readFileSync(resolve(__dirname, '../src', f), 'utf8')
    const group = ['roadLink', 'group', 'roadSpectate'].map((f) => src(`modes/freeRide/${f}.ts`))
    for (const text of group)
      expect(text).not.toMatch(/\.erg\b|setTarget|setErg|setResistance|ftms/i)
    expect(src('modes/freeRide/freeRide.ts').match(/\.erg\.\w+/g)).toEqual(['.erg.setGrade'])
  })
})
