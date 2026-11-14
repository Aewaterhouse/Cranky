import { CFG } from '../../config'
import type { Profile } from '../../core/curve'
import { shiftGear } from '../../core/gears'
import type { GhostSpec } from '../../core/ghost'
import { LapTimer, lapToast } from '../../core/laps'
import { normalisedPower } from '../../core/ride'
import { draftGrade, draftSaving, stepSpeed, totalMass } from '../../core/physics'
import { ascentFrom, routeAt, routeSeconds, type Route } from '../../core/route'
import { VIS } from '../../scene/params'
import type { RoadSummary } from '../../net/protocol'
import type { RoadRider } from '../../scene/route/routeWorld'
import { settings } from '../../core/settings'
import { clickSource, onClickShift } from '../../trainer/zwiftClick'
import { SFX } from '../../ui/audio'
import { clock, show } from '../../ui/dom'
import { freeRideView } from '../../ui/freeRideView'
import { finishRide } from '../../ui/results'
import type { Plan, Trainer } from '../../types'
import { RideController } from '../rideController'
import { loadDifficulty, saveDifficulty } from './difficulty'
import { RoadFeel, trainerTarget } from './feel'
import { freeKeys } from './keys'
import { Moments, momentCard } from './moments'
import { PauseState } from './pauseState'
import { recentPct } from './quips'
import { rideExtras } from './rideExtras'
import { rideWorld } from './rideWorld'
import { stepStrength, strengthPct } from '../../ui/gearTile'
import type { RoadLink } from './roadLink'

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
  ghostSpecs?: GhostSpec[],
) {
  const params = new URLSearchParams(location.search)
  const fast = link ? 1 : +(params.get('fast') ?? 1)
  const mass = totalMass(profile.weightKg)
  const plan = freePlan(route, profile.ftp, profile.weightKg)
  const ride = new RideController(trainer, profile, plan)
  let difficulty = loadDifficulty()
  // `?at=7000` starts a solo ride that many metres in (a dev aid for looking at a summit or the finish).
  let dist = link ? 0 : Math.min(route.distance - 1, Math.max(0, +(params.get('at') ?? 0)))
  let speed = 0
  let el = 0
  let finished = false
  const pause = new PauseState()
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
      photo: () => scene.photo(() => togglePause()),
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
  const kg = profile.weightKg || F.defaultKg
  const lapM = route.lapOf?.distance
  const lapTimer = lapM ? new LapTimer(lapM, Math.round(route.distance / lapM)) : undefined
  const extras = rideExtras(route, { id: profile.id, kg, ftp: profile.ftp }, ride.rec, view, {
    me,
    group: !!link,
    ghosts: ghostSpecs,
    mates: link ? 0 : +(params.get('ghosts') ?? 0),
  })
  const feel = new RoadFeel(route)
  const scene = rideWorld(route, view, me, params.get('intro') !== '0')
  let wind = 0
  const moments = new Moments(scene.topD, route.distance)
  let finishing = false
  view.root.addEventListener('click', (e) => (e.target as HTMLElement).closest('button')?.blur())

  function togglePause() {
    if (link) return view.toast('No pausing in a group ride. Stop pedalling and you stop.')
    pause.toggle()
  }
  const nudge = (d: number) => {
    difficulty = Math.min(1, Math.max(0, +(difficulty + d).toFixed(2)))
    view.setDifficulty(difficulty)
    save()
  }
  const shift = (d: number) => {
    const to = shiftGear(gear, d)
    if (to !== gear) scene.clunk()
    shifted = true
    gear = to
  }
  const onKey = freeKeys({
    pause: togglePause,
    end: () => view.confirmEnd(),
    nudge,
    shift,
    strength: (d) => (stepStrength(d), view.toast(`Shift strength ${strengthPct()}`)),
    toggle: (part) => view.toggle(part),
    camera: () => scene.cycleView(),
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
    const count = link?.countdown() ?? 0
    if (link && count <= CFG.intro.settleS) scene.skipIntro()
    // The clock cannot start while the flyover is still showing the place off.
    if (!scene.intro) pause.step(stopped, speed, dt)
    const home = link?.mine()?.st === 'finished'
    if (link) pause.never()
    const paused = link ? count > 0 || home : pause.paused || finishing
    ride.paused = paused
    const p = routeAt(route, dist)
    let draft = 1
    let band = 1
    if (paused) speed = 0
    else {
      wind = link ? 0 : feel.wind(dist, settings.wind, scene.mood, el)
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
      settings.shiftStrength,
      draftGrade(speed, draft, mass),
    )
    if (Math.abs(want - sent) > F.sendDeltaPct || now / 1000 - sentAt >= F.sendEveryS) {
      sent = want
      sentAt = now / 1000
      ride.erg.setGrade(sent, F.grade)
    }
    scene.sound({ speed, coasting: live.power === 0, paused, headwind: wind, ele: p.ele })
    ride.setFrame({ el, i: 0, bel: el, type: 'free', label: route.name, dur: el + 1, tgt: null })
    me.d = dist
    me.speed = speed * band * fast
    me.offset = link?.mine()?.lane ?? VIS.route.lane
    me.cadence = paused ? 0 : live.cadence
    me.power = paused ? 0 : live.power
    me.effort = live.power / profile.ftp
    me.cheer = !pause.starting && scene.cheer(dist)
    // The lap toast goes first, so a PR lap's fanfare (from the segments, just below) is what stays up.
    const lap = lapTimer?.info(dist)
    if (lap && lapTimer?.update(dist, el, speed) !== undefined) {
      const now = lapTimer.info(dist)
      Object.assign(lap, now)
      view.toast(lapToast(now, clock))
      SFX.bell(now.n === now.of ? CFG.sound.bell.lastRings : 1)
    }
    const { riders, ...seg } = extras.tick(dist, el, paused ? 0 : live.power, { paused, fast, dt })
    const others = [...(link?.others() ?? []), ...riders]
    scene.draw([me, ...others])
    ride.rec.distance = Math.round(dist)
    ride.rec.ascent = Math.round(route.ascent - ascentFrom(route, dist))
    const pw = ride.rec.power
    const avgPower = pw.length ? pw.reduce((a, b) => a + b, 0) / pw.length : 0
    view.frame({
      live,
      speed: speed * band,
      grade: p.grade,
      trainerGrade: sent,
      gear,
      gears: shifted || !!clickSource(),
      dist,
      el,
      paused: pause.why,
      starting: pause.starting,
      intro: scene.intro,
      avgPower,
      np: normalisedPower(pw),
      ftp: profile.ftp,
      weightKg: kg,
      etaS: el > 30 && dist > 50 ? (route.distance - dist) / (dist / el) : plan.blocks[0].dur,
      riders: [
        {
          ...me,
          wkg: live.avg / kg,
          power: live.avg,
          hr: live.hr ?? null,
          ftp: profile.ftp,
          kg: profile.weightKg || null,
        },
        ...others,
      ],
      me: me.id,
      lap,
      ...seg,
      wind: settings.wind === 'off' || link ? undefined : wind,
      group: link && { draftW: draftSaving(speed, draft), band },
      banner: link?.banner(),
    })
    if (!pause.starting)
      scene.quip({
        now: now / 1000,
        t: el,
        dist,
        grade: p.grade,
        speed,
        ftpPct: recentPct(pw, live.power, profile.ftp),
        stopped: paused,
      })
    // Over the top and at the line: a moment each. A solo ride holds at the line for it before the results.
    const moment = moments.next(home ? route.distance : dist)
    if (moment) {
      const prs = extras.results.filter((r) => r.pr).length
      scene.celebrate(momentCard(moment, { el, avgPower, kg, prs }))
      if (moment === 'finish' && !link) {
        finishing = true
        setTimeout(() => void end(), fast > 1 ? 1500 : CFG.moments.finishHoldS * 1000)
      }
    }
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
    const still = scene.still
    scene.dispose()
    await ride.stop()
    extras.finish(dist)
    finishRide(
      profile,
      ride.rec.summary(),
      done,
      undefined,
      road ? 'Back to the lobby' : 'Done',
      road,
      still,
    )
  }
  return { end }
}
