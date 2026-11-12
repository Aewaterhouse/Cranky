import '../../solo.css'
import { zoneOf, type Profile } from '../../core/curve'
import { frameAt, planTotal, startOf } from '../../core/plan'
import { saveProfile } from '../../core/profile'
import { loadStats, RideRecorder } from '../../core/ride'
import { clearSnap, saveSnap, soloKey, type SoloSnap } from '../../core/snapshot'
import { CFG } from '../../config'
import { SFX } from '../../ui/audio'
import { fmt, show } from '../../ui/dom'
import { finishRide } from '../../ui/results'
import { soloView } from '../../ui/soloView'
import type { Frame, Plan, Trainer } from '../../types'
import { RideController } from '../rideController'

const START_S = 5
const PAUSE_ERG = 0.4
const STOP_S = 3
const GO_S = 1.5

/** Solo ERG workout player: local clock, no scene. Owns pause, skip, intensity and the sprint flow. */
export function runDrill(
  plan: Plan,
  profile: Profile,
  trainer: Trainer,
  done: (p: Profile) => void,
  resume?: SoloSnap,
) {
  const total = planTotal(plan.blocks)
  const fast = +(new URLSearchParams(location.search).get('fast') ?? 1)
  if (resume) profile.tier = resume.tier
  const ride = new RideController(
    trainer,
    profile,
    plan,
    undefined,
    undefined,
    resume && RideRecorder.fromJSON(resume.rec),
  )
  const isSim = trainer.name.toLowerCase().includes('sim')
  let el = resume?.el ?? 0
  let count = START_S
  let intensity = resume?.intensity ?? 1
  let manual = false
  let auto = false
  let finished = false
  let last = performance.now()
  let idleFor = 0
  let activeFor = 0
  let lastI = -1
  let lastCount = 0
  let splashUntil = 0
  // incremental stats: one entry per recorded second
  const xs: number[] = resume?.xs ?? []
  const zones = Array(7).fill(0)
  resume?.rec.power.forEach((w) => zones[zoneOf(w, profile.ftp)]++)
  let cSum = resume?.cSum ?? 0
  let cN = resume?.cN ?? 0
  let load = loadStats([], profile.ftp)
  let loadN = 0
  let cadAvg = 0

  const view = soloView(
    plan,
    profile.ftp,
    profile.tier,
    {
      pause: () => togglePause(),
      skip: () => skip(),
      end: () => end(),
      intensity: (d) => (intensity = Math.min(1.5, Math.max(0.5, +(intensity + d).toFixed(2)))),
      tier: (t) => ((profile.tier = t), saveProfile(profile)),
    },
    profile.maxHr,
  )
  show(view.root)
  view.root.addEventListener('click', (e) => (e.target as HTMLElement).closest('button')?.blur())

  ride.onSprint = (r) => {
    SFX[r.grade]()
    splashUntil = performance.now() + 2800
    view.overlay(
      `${r.grade}!`,
      `${r.avg} W · ${Math.round(r.pct * 100)}% of your best`,
      `grade-${r.grade}`,
    )
  }

  const sprinting = () => ride.frame?.type === 'sprint'
  function togglePause() {
    if (count > 0 || sprinting()) return
    manual = !manual
    if (!manual) auto = false
  }
  function skip() {
    if (count > 0) return (count = 0)
    const i = ride.frame?.i ?? frameAt(plan.blocks, el, profile.tier, profile.ftp)?.i ?? 0
    el = startOf(plan.blocks, i + 1)
  }
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return
    const k = e.key
    const used =
      k === ' ' || k === 'p' || k === 'P'
        ? (togglePause(), true)
        : k === 'n' || k === 'N' || (k === 'ArrowRight' && !isSim)
          ? (skip(), true)
          : k === '+' || k === '='
            ? ((intensity = Math.min(1.5, +(intensity + 0.01).toFixed(2))), true)
            : k === '-' || k === '_'
              ? ((intensity = Math.max(0.5, +(intensity - 0.01).toFixed(2))), true)
              : k === 'Escape'
                ? (view.confirmEnd(), true)
                : false
    if (used) e.preventDefault()
  }
  addEventListener('keydown', onKey)
  ride.start()

  const scaled = (f: Frame, k: number): Frame => ({
    ...f,
    tgt: f.tgt == null ? null : Math.round(f.tgt * k),
    next: f.next && { ...f.next, tgt: f.next.tgt == null ? null : Math.round(f.next.tgt * k) },
  })

  function record(live = ride.live) {
    const p = ride.rec.power
    for (; xs.length < p.length; xs.push(el)) {
      const n = xs.length
      zones[zoneOf(p[n], profile.ftp)]++
      if (live.c !== null) {
        cSum += live.c
        cN++
      }
    }
  }
  const tick = () => {
    const now = performance.now()
    const dt = Math.min(1, (now - last) / 1000)
    last = now
    const live = ride.live
    let overlay: [string | null, string?, string?] = [null]
    if (count > 0) {
      const before = Math.ceil(count)
      count -= dt
      if (count <= 0) SFX.go()
      else if (Math.ceil(count) !== before) SFX.countdown()
      overlay = count > 0 ? [String(Math.ceil(count)), 'Get ready to ride', 'count'] : [null]
    } else {
      const stopped = live.power === 0 || live.cadence === 0
      idleFor = stopped ? idleFor + dt : 0
      activeFor = stopped ? 0 : activeFor + dt
      if (!manual && !auto && !sprinting() && idleFor >= STOP_S) auto = true
      else if (auto && activeFor >= GO_S) auto = false
      if (!manual && !auto) el += dt * fast
    }
    const paused = count <= 0 && (manual || auto)
    ride.paused = paused
    const base = frameAt(plan.blocks, el, profile.tier, profile.ftp)
    if (!base) return void end()
    const f = scaled(base, intensity)
    if (count <= 0) {
      ride.setFrame(paused ? { ...f, type: 'steady', tgt: Math.round(profile.ftp * PAUSE_ERG) } : f)
      if (f.i !== lastI) {
        if (lastI >= 0) SFX.block()
        lastI = f.i
        view.panel.done(ride.rec.summary().blocks, ride.rec.sprints, f.i)
      }
      const n = f.type !== 'sprint' && f.next?.type === 'sprint' ? Math.ceil(f.next.in / fast) : 0
      if (n !== lastCount && n > 0 && n <= 3) SFX.countdown()
      lastCount = n
      if (paused)
        overlay = [
          'PAUSED',
          manual
            ? 'Press Space to resume. ERG is easing off.'
            : 'Auto-paused. Start pedalling to carry on.',
          'pause',
        ]
      else if (f.type === 'sprint')
        overlay = [
          'SPRINT!',
          `ERG OFF · ${Math.round(live.power)} W · ${fmt(f.dur - f.bel)}`,
          'sprint',
        ]
      else if (n > 0 && n <= 3) overlay = [String(n), 'Sprint next. ERG switches off', 'count']
      if (ride.trainerStatus === 'reconnecting')
        overlay = [
          'Trainer disconnected, reconnecting…',
          'Keep pedalling, we will carry on when it is back.',
          'pause',
        ]
    }
    record(live)
    if (now >= splashUntil || overlay[2] === 'pause') {
      view.overlay(...overlay)
    }
    const p = ride.rec.power
    if (p.length !== loadN) {
      load = loadStats(p, profile.ftp)
      loadN = p.length
      cadAvg = ride.rec.cadence.reduce((a, b) => a + b, 0) / (p.length || 1)
    }
    view.frame({
      f,
      live,
      fast,
      total,
      intensity,
      paused: paused ? (manual ? 'manual' : 'auto') : null,
      power: p,
      xs,
      cadence: ride.rec.cadence,
      hr: ride.rec.hr,
      stats: {
        elapsed: el,
        remaining: total - el,
        avg: p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0,
        np: load.np,
        if: load.if,
        tss: load.tss,
        kj: p.reduce((a, b) => a + b, 0) / 1000,
        cadence: cadAvg,
        compliance: cN ? cSum / cN : null,
        zones,
      },
    })
  }
  const timer = setInterval(tick, 200)
  const key = soloKey(profile.id)
  const saver = setInterval(() => {
    if (!finished && ride.rec.power.length)
      saveSnap(key, { plan, el, intensity, tier: profile.tier, rec: ride.rec, xs, cSum, cN })
  }, CFG.recovery.saveMs)
  tick()

  async function end() {
    if (finished) return
    finished = true
    clearInterval(timer)
    clearInterval(saver)
    clearSnap(key)
    removeEventListener('keydown', onKey)
    await ride.stop()
    finishRide(profile, ride.rec.summary(), done)
  }
}
