import { CFG } from '../../config'
import type { Profile } from '../../core/curve'
import { shiftGear } from '../../core/gears'
import { LapTimer, lapToast } from '../../core/laps'
import { normalisedPower } from '../../core/ride'
import { steadySpeed, stepSpeed, totalMass } from '../../core/physics'
import { ascentFrom, routeAt, routeSeconds, type Route } from '../../core/route'
import { VIS } from '../../scene/params'
import type { RoadRider, RouteWorld } from '../../scene/route/routeWorld'
import { settings } from '../../core/settings'
import { clickSource, onClickShift } from '../../trainer/zwiftClick'
import { SFX } from '../../ui/audio'
import { clock, show } from '../../ui/dom'
import { toast } from '../../ui/toast'
import { freeRideView, type FreePart } from '../../ui/freeRideView'
import { finishRide } from '../../ui/results'
import type { Plan, Trainer } from '../../types'
import { RideController } from '../rideController'
import { RoadFeel, cheering, trainerTarget } from './feel'
import { Quipper, speak } from './quips'

const STOP_S = 3
const GO_S = 1.5
const DIFF_KEY = 'cranky.trainerDifficulty'
const F = CFG.freeRide
const G = F.ghosts
const HUD_KEYS: Record<string, FreePart> = { h: 'clean', s: 'stats', m: 'map', r: 'riders' }

function loadDifficulty() {
  try {
    const v = parseFloat(localStorage.getItem(DIFF_KEY) ?? '')
    if (v >= 0 && v <= 1) return v
  } catch {
    /* no storage */
  }
  return F.difficulty
}

/** The plan recorded for a free ride: one open block named for the route, with a duration estimate at ~75% FTP. */
export function freePlan(route: Route, ftp: number, weightKg?: number): Plan {
  const secs = routeSeconds(route, ftp * F.ftpFrac, weightKg)
  return {
    id: `free-${route.id}`,
    name: route.name,
    blocks: [{ type: 'free', dur: Math.round(secs), label: 'Free ride' }],
  }
}

/** Free ride on a route: no ERG. Power moves the rider along the road and the trainer gets the gradient. */
export function runFreeRide(
  route: Route,
  profile: Profile,
  trainer: Trainer,
  done: (p: Profile) => void,
) {
  const params = new URLSearchParams(location.search)
  const fast = +(params.get('fast') ?? 1)
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
  const save = () => {
    try {
      localStorage.setItem(DIFF_KEY, String(difficulty))
    } catch {
      /* no storage */
    }
  }
  show(view.root)
  view.toast(route.name)
  // The 3D world is one rider on the road for now; group rides will hand it more.
  const me: RoadRider = {
    id: profile.id,
    name: profile.name,
    d: 0,
    offset: VIS.route.lane,
    speed: 0,
    cadence: 0,
    look: profile.look,
  }
  // Dev aid (?ghosts=N): made-up mates riding steadily at a spread of efforts, to see the rider list and a bunch.
  const ghosts = G.names.slice(0, +(params.get('ghosts') ?? 0)).map((name, i, all) => ({
    rider: { ...me, id: `ghost${i}`, name, look: undefined, d: G.gapM * (i + 1) },
    watts: profile.ftp * (G.ftp[0] + ((G.ftp[1] - G.ftp[0]) * i) / all.length),
  }))
  const riders = [me, ...ghosts.map((g) => g.rider)]
  // On a lap ride the world draws one lap, so its riders wrap round at the lap length.
  const lapM = route.lapOf?.distance
  const shown = lapM ? riders.map((r) => ({ ...r })) : riders
  const lapTimer = lapM ? new LapTimer(lapM, Math.round(route.distance / lapM)) : undefined
  let world: RouteWorld | undefined
  const feel = new RoadFeel(route)
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
        world = new m.RouteWorld(view.stage, route.lapOf ?? route)
        world.state = { me: me.id, riders: shown }
      })
      .catch(() => view.flat())
  view.root.addEventListener('click', (e) => (e.target as HTMLElement).closest('button')?.blur())

  function togglePause() {
    if (starting) return
    manual = !manual
    if (!manual) auto = false
  }
  const nudge = (d: number) => {
    difficulty = Math.min(1, Math.max(0, +(difficulty + d).toFixed(2)))
    view.setDifficulty(difficulty)
    save()
  }
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || e.ctrlKey || e.metaKey) return
    const k = e.key
    const act =
      k === ' ' || k === 'p' || k === 'P'
        ? togglePause
        : k === 'Escape'
          ? view.confirmEnd
          : k === '+' || k === '='
            ? () => nudge(0.05)
            : k === '-' || k === '_'
              ? () => nudge(-0.05)
              : k === 'z' || k === 'Z' || k === 'x' || k === 'X'
                ? () => shift(k.toLowerCase() === 'x' ? 1 : -1)
                : k.toLowerCase() in HUD_KEYS
                  ? () => view.toggle(HUD_KEYS[k.toLowerCase()])
                  : null
    if (!act) return
    act()
    e.preventDefault()
  }
  const shift = (d: number) => ((shifted = true), (gear = shiftGear(gear, d)))
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
    const paused = manual || auto
    ride.paused = paused
    const p = routeAt(route, dist)
    if (paused) speed = 0
    else {
      wind = feel.wind(dist, settings.wind, world?.moodName, el)
      speed = stepSpeed(speed, live.power, p.grade, mass, dt * fast, wind, feel.limit(dist, speed))
      el += dt * fast
      dist = Math.min(route.distance, dist + speed * dt * fast)
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
    ride.setFrame({ el, i: 0, bel: el, type: 'free', label: route.name, dur: el + 1, tgt: null })
    me.d = dist
    me.speed = speed * fast
    me.cadence = paused ? 0 : live.cadence
    me.power = paused ? 0 : live.power
    me.effort = live.power / profile.ftp
    me.cheer = !starting && cheering(dist, route.distance, climbs ? top.d : undefined)
    for (const g of ghosts) {
      g.rider.speed = paused
        ? 0
        : steadySpeed(g.watts, routeAt(route, g.rider.d).grade, mass) * fast
      g.rider.cadence = paused ? 0 : G.cadence
      g.rider.d = Math.min(route.distance, g.rider.d + g.rider.speed * dt)
    }
    if (lapM) riders.forEach((r, i) => Object.assign(shown[i], r, { d: r.d % lapM }))
    const lap = lapTimer?.info(dist)
    if (lap && lapTimer?.update(dist, el, speed) !== undefined) {
      const now = lapTimer.info(dist)
      Object.assign(lap, now)
      view.toast(lapToast(now, clock))
      SFX.bell(now.n === now.of ? CFG.sound.bell.lastRings : 1)
    }
    ride.rec.distance = Math.round(dist)
    ride.rec.ascent = Math.round(route.ascent - ascentFrom(route, dist))
    const pw = ride.rec.power
    const kg = profile.weightKg || F.defaultKg
    view.frame({
      live,
      speed,
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
      riders: [
        { ...me, wkg: live.avg / kg },
        ...ghosts.map((g) => ({ ...g.rider, wkg: g.watts / kg })),
      ],
      me: me.id,
      lap,
      wind: settings.wind === 'off' ? undefined : wind,
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
    if (dist >= route.distance) void end()
  }
  const timer = setInterval(tick, 200)
  tick()

  async function end() {
    if (finished) return
    finished = true
    clearInterval(timer)
    removeEventListener('keydown', onKey)
    offClick()
    world?.dispose()
    await ride.stop()
    finishRide(profile, ride.rec.summary(), done)
  }
}
