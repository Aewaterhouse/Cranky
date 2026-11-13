import { CFG } from '../../config'
import type { Profile } from '../../core/curve'
import { shiftGear } from '../../core/gears'
import { LapTimer, lapToast } from '../../core/laps'
import { normalisedPower } from '../../core/ride'
import { draftSaving, stepSpeed, totalMass } from '../../core/physics'
import { ascentFrom, routeAt, routeSeconds, type Route } from '../../core/route'
import { VIS } from '../../scene/params'
import type { RoadSummary } from '../../net/protocol'
import type { RoadRider, RouteWorld } from '../../scene/route/routeWorld'
import { settings } from '../../core/settings'
import { clickSource, onClickShift } from '../../trainer/zwiftClick'
import { SFX } from '../../ui/audio'
import { clock, show } from '../../ui/dom'
import { toast } from '../../ui/toast'
import { freeRideView } from '../../ui/freeRideView'
import { finishRide } from '../../ui/results'
import { rideSound } from '../../ui/rideSound'
import type { Plan, Trainer } from '../../types'
import { RideController } from '../rideController'
import { loadDifficulty, saveDifficulty } from './difficulty'
import { RoadFeel, cheering, trainerTarget } from './feel'
import { makeGhosts, stepGhosts } from './ghosts'
import { freeKeys } from './keys'
import { Quipper, speak } from './quips'
import { rideExtras } from './rideExtras'
import type { RoadLink } from './roadLink'

const STOP_S = 3
const GO_S = 1.5
const F = CFG.freeRide

/** The plan recorded for a free ride: one open block named for the route, with a duration estimate at ~75% FTP. */
export function freePlan(route: Route, ftp: number, weightKg?: number): Plan {
  const secs = routeSeconds(route, ftp * F.ftpFrac, weightKg)
  return {
    id: `free-${route.id}`,
    name: route.name,
    blocks: [{ type: 'free', dur: Math.round(secs), label: 'Free ride' }],
  }
}

/**
 * Free ride on a route: no ERG. Power moves the rider along the road and the trainer gets the gradient. With a
 * `link` it is a group ride: the server places everyone, my rider is guessed ahead and eased onto its line, and
 * nobody pauses. The trainer still only ever gets the gradient under my own wheels.
 */
export function runFreeRide(
  route: Route,
  profile: Profile,
  trainer: Trainer,
  done: (p: Profile) => void,
  link?: RoadLink,
) {
  const params = new URLSearchParams(location.search)
  const fast = link ? 1 : +(params.get('fast') ?? 1)
  const mass = totalMass(profile.weightKg)
  const plan = freePlan(route, profile.ftp, profile.weightKg)
  const ride = new RideController(trainer, profile, plan)
  let difficulty = loadDifficulty()
  let dist = 0
  let speed = 0
  let el = 0
  let manual = false
  let auto = true
  let starting = true
  let finished = false
  let idleFor = 0
  let activeFor = 0
  let last = performance.now()
  let sent = 0
  let sentAt = -Infinity
  let gear = CFG.gears.start
  let shifted = false

  const view = freeRideView(
    route,
    {
      pause: () => togglePause(),
      end: () => end(),
      difficulty: (v) => ((difficulty = v), save()),
    },
    difficulty,
    settings.freeRideView === '3d',
  )
  const save = () => saveDifficulty(difficulty)
  show(view.root)
  view.toast(route.name)
  const me: RoadRider = {
    id: profile.id,
    name: profile.name,
    d: 0,
    offset: VIS.route.lane,
    speed: 0,
    cadence: 0,
    look: profile.look,
  }
  const ghosts = makeGhosts(me, profile.ftp, link ? 0 : +(params.get('ghosts') ?? 0))
  const kg = profile.weightKg || F.defaultKg
  const lapM = route.lapOf?.distance
  const lapTimer = lapM ? new LapTimer(lapM, Math.round(route.distance / lapM)) : undefined
  const extras = rideExtras(
    route,
    { id: profile.id, kg },
    ride.rec,
    (t, secs) => view.toast(t, secs),
    !!link,
  )
  let world: RouteWorld | undefined
  const feel = new RoadFeel(route)
  const sound = rideSound()
  let wind = 0
  // Remarks go to the HUD's toast when the view has one, and are spoken when the announcer is on.
  const quipper = new Quipper()
  const top = route.points.reduce((a, p) => (p.ele > a.ele ? p : a))
  const climbs = top.ele - route.points[0].ele >= F.quips.summitGainM
  const onQuip = (text: string) => {
    const v = view as { toast?: (text: string) => void }
    if (v.toast) v.toast(text)
    else toast(text)
    speak(text)
  }
  if (settings.freeRideView === '3d')
    import('../../scene/route/routeWorld')
      .then((m) => {
        if (finished) return
        VIS.route.feel.cam.calm = settings.calmCamera ? 1 : 0
        world = new m.RouteWorld(view.stage, route.lapOf ?? route)
        world.state = { me: me.id, riders: [me] }
      })
      .catch(() => view.flat())
  view.root.addEventListener('click', (e) => (e.target as HTMLElement).closest('button')?.blur())

  function togglePause() {
    if (link) return view.toast('No pausing in a group ride. Stop pedalling and you stop.')
    if (starting) return
    manual = !manual
    if (!manual) auto = false
  }
  const nudge = (d: number) => {
    difficulty = Math.min(1, Math.max(0, +(difficulty + d).toFixed(2)))
    view.setDifficulty(difficulty)
    save()
  }
  const shift = (d: number) => {
    const to = shiftGear(gear, d)
    if (to !== gear) sound?.clunk()
    shifted = true
    gear = to
  }
  const onKey = freeKeys({
    pause: togglePause,
    end: () => view.confirmEnd(),
    nudge,
    shift,
    toggle: (part) => view.toggle(part),
  })
  addEventListener('keydown', onKey)
  const offClick = onClickShift(shift)
  ride.start()

  const tick = () => {
    const now = performance.now()
    const dt = Math.min(1, (now - last) / 1000)
    last = now
    const live = ride.live
    const stopped = live.power === 0 || live.cadence === 0
    // A coasting descent is not a stop: only count idle time once the rider has nearly halted.
    idleFor = stopped && speed < 2 ? idleFor + dt : 0
    activeFor = stopped ? 0 : activeFor + dt
    if (!manual && !auto && idleFor >= STOP_S) auto = true
    else if (auto && activeFor >= GO_S) {
      auto = false
      starting = false
    }
    const count = link?.countdown() ?? 0
    const home = link?.mine()?.st === 'finished'
    if (link) manual = auto = starting = false
    const paused = link ? count > 0 || home : manual || auto
    ride.paused = paused
    const p = routeAt(route, dist)
    let draft = 1
    let band = 1
    if (paused) speed = 0
    else {
      wind = link ? 0 : feel.wind(dist, settings.wind, world?.moodName, el)
      draft = link?.draft(dist) ?? 1
      band = link?.band(dist, speed >= 0.5 || live.power > 0) ?? 1
      const lim = feel.limit(dist, speed)
      speed = stepSpeed(speed, live.power, p.grade, mass, dt * fast, wind, lim, draft)
      el += dt * fast
      dist = Math.min(route.distance, dist + speed * band * dt * fast)
    }
    if (link) {
      ;[dist, speed] = link.correct(dist, speed, dt)
      dist = Math.min(route.distance, Math.max(0, dist))
      if (!paused) el = link.clock()
      link.report(live.power, live.avg, live.cadence, live.hr ?? null)
      link.takeNotes().forEach((n) => view.toast(n))
    }
    // Game speed comes from power and the real gradient; the trainer gets the road just ahead (see trainerTarget).
    const want = trainerTarget(
      route,
      dist,
      speed,
      difficulty,
      paused,
      live.cadence,
      gear,
      mass,
      settings.chainring,
    )
    if (Math.abs(want - sent) > F.sendDeltaPct || now / 1000 - sentAt >= F.sendEveryS) {
      sent = want
      sentAt = now / 1000
      ride.erg.setGrade(sent, F.grade)
    }
    sound?.update({
      speed,
      coasting: live.power === 0,
      paused,
      headwind: wind,
      place: world?.place(CFG.sound.ride.coastM) ?? { cover: 'b', y: p.ele, coast: false },
      mood: world?.moodName ?? 'route',
    })
    ride.setFrame({ el, i: 0, bel: el, type: 'free', label: route.name, dur: el + 1, tgt: null })
    me.d = dist
    me.speed = speed * band * fast
    me.offset = link?.mine()?.lane ?? VIS.route.lane
    me.cadence = paused ? 0 : live.cadence
    me.power = paused ? 0 : live.power
    me.effort = live.power / profile.ftp
    me.cheer = !starting && cheering(dist, route.distance, climbs ? top.d : undefined)
    stepGhosts(ghosts, route, mass, paused, fast, dt)
    const others = link?.others() ?? ghosts.map((g) => ({ ...g.rider, wkg: g.watts / kg }))
    // On a lap ride the world draws one lap, so its riders wrap round at the lap length.
    if (world) world.state.riders = [me, ...others].map((r) => (lapM ? { ...r, d: r.d % lapM } : r))
    const lap = lapTimer?.info(dist)
    if (lap && lapTimer?.update(dist, el, speed) !== undefined) {
      const now = lapTimer.info(dist)
      Object.assign(lap, now)
      view.toast(lapToast(now, clock))
      SFX.bell(now.n === now.of ? CFG.sound.bell.lastRings : 1)
    }
    const seg = extras.tick(dist, el, paused ? 0 : live.power)
    ride.rec.distance = Math.round(dist)
    ride.rec.ascent = Math.round(route.ascent - ascentFrom(route, dist))
    const pw = ride.rec.power
    view.frame({
      live,
      speed: speed * band,
      grade: p.grade,
      trainerGrade: sent,
      gear,
      gears: shifted || !!clickSource(),
      dist,
      el,
      paused: manual ? 'manual' : auto ? 'auto' : null,
      starting,
      avgPower: pw.length ? pw.reduce((a, b) => a + b, 0) / pw.length : 0,
      np: normalisedPower(pw),
      ftp: profile.ftp,
      weightKg: kg,
      etaS: el > 30 && dist > 50 ? (route.distance - dist) / (dist / el) : plan.blocks[0].dur,
      riders: [{ ...me, wkg: live.avg / kg }, ...others],
      me: me.id,
      lap,
      ...seg,
      wind: settings.wind === 'off' || link ? undefined : wind,
      group: link && { draftW: draftSaving(speed, draft), band },
      banner: link?.banner(),
    })
    const quip =
      settings.quips &&
      !starting &&
      quipper.next({
        now: now / 1000,
        t: el,
        dist,
        total: route.distance,
        grade: p.grade,
        speed,
        ftpPct:
          (100 * pw.slice(-5).reduce((a, b) => a + b, live.power)) /
          (Math.min(5, pw.length) + 1) /
          profile.ftp,
        stopped: paused,
        summit: climbs && dist >= top.d,
        near: world?.near(),
      })
    if (quip) onQuip(quip)
    if (dist >= route.distance && !link) void end()
  }
  const timer = setInterval(tick, 200)
  tick()

  /** Stops the ride and shows the results; `road` is the server's crew results at the end of a group ride. */
  async function end(road?: RoadSummary) {
    if (finished) return
    finished = true
    clearInterval(timer)
    removeEventListener('keydown', onKey)
    offClick()
    world?.dispose()
    sound?.stop()
    await ride.stop()
    extras.finish(dist)
    finishRide(
      profile,
      ride.rec.summary(),
      done,
      undefined,
      road ? 'Back to the lobby' : 'Done',
      road,
    )
  }
  return { end }
}
