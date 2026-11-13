import { CFG } from '../../config'
import type { Profile } from '../../core/curve'
import { gearGrade, shiftGear } from '../../core/gears'
import { normalisedPower } from '../../core/ride'
import { stepSpeed, totalMass } from '../../core/physics'
import { ascentFrom, routeAt, routeSeconds, type Route } from '../../core/route'
import { settings } from '../../core/settings'
import { onClickShift } from '../../trainer/zwiftClick'
import { show } from '../../ui/dom'
import { freeRideView } from '../../ui/freeRideView'
import { finishRide } from '../../ui/results'
import type { Plan, Trainer } from '../../types'
import { RideController } from '../rideController'

const STOP_S = 3
const GO_S = 1.5
const DIFF_KEY = 'cranky.trainerDifficulty'
const F = CFG.freeRide

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
  const fast = +(new URLSearchParams(location.search).get('fast') ?? 1)
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

  const view = freeRideView(
    route,
    {
      pause: () => togglePause(),
      end: () => end(),
      difficulty: (v) => ((difficulty = v), save()),
    },
    difficulty,
  )
  const save = () => {
    try {
      localStorage.setItem(DIFF_KEY, String(difficulty))
    } catch {
      /* no storage */
    }
  }
  show(view.root)
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
                : null
    if (!act) return
    act()
    e.preventDefault()
  }
  const shift = (d: number) => (gear = shiftGear(gear, d))
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
      speed = stepSpeed(speed, live.power, p.grade, mass, dt * fast)
      el += dt * fast
      dist = Math.min(route.distance, dist + speed * dt * fast)
    }
    // Paused means an easy, flat trainer; riding means road × difficulty plus the gear offset × shift
    // strength. Game speed above still comes from power alone.
    const { chainring, shiftStrength } = settings
    const want = paused
      ? 0
      : gearGrade(p.grade, live.cadence, gear, mass, F.grade, chainring, difficulty, shiftStrength)
    if (Math.abs(want - sent) > F.sendDeltaPct || now / 1000 - sentAt >= F.sendEveryS) {
      sent = want
      sentAt = now / 1000
      ride.erg.setGrade(sent, F.grade)
    }
    ride.setFrame({ el, i: 0, bel: el, type: 'free', label: route.name, dur: el + 1, tgt: null })
    ride.rec.distance = Math.round(dist)
    ride.rec.ascent = Math.round(route.ascent - ascentFrom(route, dist))
    const pw = ride.rec.power
    view.frame({
      live,
      speed,
      grade: p.grade,
      trainerGrade: sent,
      gear,
      dist,
      el,
      paused: manual ? 'manual' : auto ? 'auto' : null,
      starting,
      avgPower: pw.length ? pw.reduce((a, b) => a + b, 0) / pw.length : 0,
      np: normalisedPower(pw),
      weightKg: profile.weightKg || F.defaultKg,
      etaS: el > 30 && dist > 50 ? (route.distance - dist) / (dist / el) : plan.blocks[0].dur,
    })
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
    await ride.stop()
    finishRide(profile, ride.rec.summary(), done)
  }
}
