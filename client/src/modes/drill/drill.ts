import { loadGhost } from './ghost'
import '../../solo.css'
import type { Profile } from '../../core/curve'
import { recordFtp } from '../../core/curve'
import { frameAt, planTotal, startOf } from '../../core/plan'
import { shiftGear } from '../../core/gears'
import { totalMass } from '../../core/physics'
import { saveProfile } from '../../core/profile'
import { RideRecorder } from '../../core/ride'
import { clearSnap, saveSnap, soloKey, type SoloSnap } from '../../core/snapshot'
import { CFG } from '../../config'
import { isRest } from '../../core/hud'
import { SFX } from '../../ui/audio'
import type { SoloAction } from '../../ui/soloExtras'
import { show } from '../../ui/dom'
import { finishRide } from '../../ui/results'
import { startMode, stepMode, type ModeState, type RideMode } from '../../ui/soloMode'
import { soloView } from '../../ui/soloView'
import type { Frame, Plan, Trainer } from '../../types'
import { RideController } from '../rideController'
import { addEasy, addMinute, ownPlan } from './extend'
import { CueTracker } from './cues'
import { soloClick, soloKeys } from './keys'
import { slopeGears } from './slope'
import { LiveTally } from './liveTally'
import { pickOverlay, type Overlay } from './overlays'
import { coolStart, ftpResult, testSpec } from './ftpTest'

const START_S = 5
const PAUSE_ERG = 0.4
const STOP_S = 3
const GO_S = 1.5

/** Solo ERG workout player: local clock, no scene. Owns pause, skip, intensity and the sprint flow. */
export function runDrill(
  rawPlan: Plan,
  profile: Profile,
  trainer: Trainer,
  done: (p: Profile) => void,
  resume?: SoloSnap,
) {
  const plan = ownPlan(rawPlan)
  let total = planTotal(plan.blocks)
  let completing = false
  let grace = 0
  const fast = +(new URLSearchParams(location.search).get('fast') ?? 1)
  const origTier = profile.tier
  const spec = testSpec(plan)
  if (resume) profile.tier = resume.tier
  if (plan.test) profile.tier = 'hard'
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
  let intensity = plan.test ? 1 : (resume?.intensity ?? 1)
  let below = 0
  let mode = startMode()
  let manual = false
  let auto = false
  let finished = false
  let last = performance.now()
  let idleFor = 0
  let activeFor = 0
  let lastI = -1
  let lastF: Frame | undefined
  let lastCount = 0
  let splashUntil = 0
  const tally = new LiveTally(plan, profile.ftp, resume)
  const cues = new CueTracker(plan.blocks, el)

  const view = soloView(
    plan,
    profile.ftp,
    profile.tier,
    {
      pause: () => togglePause(),
      skip: () => skip(),
      end: () => end(),
      intensity: (d) => bump(d),
      mode: (k) => setMode(k),
      nudge: (d) => setMode(mode.kind, stepMode(mode, d)),
      tier: (t) => !plan.test && ((profile.tier = t), saveProfile(profile)),
    },
    profile.maxHr,
  )
  if (!plan.test) void loadGhost(plan.name).then((g) => view.setGhost(g))
  const slope = slopeGears(ride.erg, totalMass(profile.weightKg), view.root)
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

  /** Switch ride mode (or change its level) and tell the ERG controller; ERG power is only ever sent in ERG mode. */
  function setMode(kind: RideMode, next: ModeState = { ...mode, kind }) {
    if (plan.test) return
    mode = next
    if (kind === 'erg') ride.erg.setErg()
    else if (kind === 'res') ride.erg.setResistance(mode.level)
    else slope.send(mode, ride.live.cadence, true)
  }
  const gear = (d: number) =>
    mode.kind === 'slope' &&
    ((mode = { ...mode, gear: shiftGear(mode.gear, d) }), slope.send(mode, ride.live.cadence, true))
  const inRamp = (i: number | undefined) =>
    spec?.kind === 'ramp' && i !== undefined && i >= spec.from && i < spec.to
  function rampDone() {
    el = coolStart(plan) ?? el
    below = 0
    splashUntil = performance.now() + 2800
    view.overlay('Ramp over', 'Well ridden. Easy spin now.', 'count')
  }
  const extend = () => {
    addEasy(plan)
    completing = false
  }
  const actions = (f: Frame): SoloAction[] => [
    ...(inRamp(f.i) ? [{ id: 'done', label: "I'm done", cls: 'primary', run: rampDone }] : []),
    ...(f.type === 'steady' && !plan.test && !completing
      ? [
          {
            id: 'm1',
            label: '+1 min',
            title: 'Make this interval a minute longer',
            run: () => addMinute(plan, f.i),
          },
        ]
      : []),
    ...(f.i === plan.blocks.length - 1 || completing
      ? [
          { id: 'p5', label: '+5 min', title: 'Five more easy minutes at 50% FTP', run: extend },
          { id: 'fin', label: 'Finish now', cls: 'danger', run: end },
        ]
      : []),
  ]
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
  const bump = (d: number) =>
    !plan.test && (intensity = Math.min(1.5, Math.max(0.5, +(intensity + d).toFixed(2))))
  const keyActs = {
    pause: togglePause,
    skip,
    end: view.confirmEnd,
    bump,
    mode: (k: RideMode) => setMode(k),
    step: (d: number) => setMode(mode.kind, stepMode(mode, d)),
    gear,
    toggle: view.toggle,
  }
  const onKey = soloKeys(keyActs, !isSim)
  addEventListener('keydown', onKey)
  const offClick = plan.test ? () => {} : soloClick(keyActs, () => mode.kind)
  ride.start()

  const scaled = (f: Frame, k: number): Frame => ({
    ...f,
    tgt: f.tgt == null ? null : Math.round(f.tgt * k),
    next: f.next && { ...f.next, tgt: f.next.tgt == null ? null : Math.round(f.next.tgt * k) },
  })

  const tick = () => {
    const now = performance.now()
    const dt = Math.min(1, (now - last) / 1000)
    last = now
    const live = ride.live
    let overlay: Overlay = [null]
    let changeIn = 0
    if (count > 0) {
      const before = Math.ceil(count)
      count -= dt
      if (count <= 0) SFX.go()
      else if (Math.ceil(count) !== before) SFX.countdown()
      overlay = count > 0 ? [String(Math.ceil(count)), 'Get ready to ride', 'count'] : [null]
    } else {
      const stopped = live.power === 0 || live.cadence === 0
      const tgt = ride.frame?.tgt
      below =
        inRamp(ride.frame?.i) && !manual && tgt && live.avg < tgt * CFG.ftpTest.failBelow
          ? below + dt
          : 0
      if (below >= CFG.ftpTest.failS) rampDone()
      idleFor = stopped ? idleFor + dt : 0
      activeFor = stopped ? 0 : activeFor + dt
      if (!manual && !auto && !sprinting() && idleFor >= STOP_S) auto = true
      else if (auto && activeFor >= GO_S) auto = false
      if (!manual && !auto && !completing) el += dt * fast
      if (!completing && el >= total) {
        completing = true
        grace = CFG.extend.graceS
      }
      if (completing && (grace -= dt) <= 0) return void end()
    }
    total = planTotal(plan.blocks)
    const paused = count <= 0 && (manual || auto || completing)
    ride.paused = paused
    const base = frameAt(plan.blocks, completing ? total - 0.001 : el, profile.tier, profile.ftp)
    if (!base) return void end()
    const f = scaled(base, intensity)
    if (count <= 0) {
      ride.setFrame(paused ? { ...f, type: 'steady', tgt: Math.round(profile.ftp * PAUSE_ERG) } : f)
      const cue = paused ? undefined : cues.due(f.i, f.bel)
      if (cue) {
        view.cue(cue)
        SFX.cue()
      }
      if (f.i !== lastI) {
        if (lastI >= 0) SFX.block()
        const blocks = ride.rec.summary().blocks
        const was = blocks.find((b) => b.i === lastI)
        // An effort just ended (not a rest, not a sprint, which has its own grade): say how it went.
        if (
          was?.secs &&
          lastF &&
          lastF.type !== 'sprint' &&
          !isRest(lastF.type, lastF.tgt, profile.ftp)
        )
          view.summary(was, tally.cad.pct()[lastI])
        lastI = f.i
        view.panel.done(blocks, ride.rec.sprints, f.i)
      }
      lastF = f
      // 3-2-1 with a tone before every change; into a sprint it is the big one over the chart.
      const toGo = paused ? 0 : Math.ceil((f.dur - f.bel) / fast)
      changeIn = toGo <= CFG.hud.countS ? toGo : 0
      const n = f.type !== 'sprint' && f.next?.type === 'sprint' ? changeIn : 0
      if (changeIn !== lastCount && changeIn > 0) SFX.countdown()
      lastCount = changeIn
      overlay = pickOverlay({
        f,
        power: live.power,
        paused,
        completing,
        grace,
        manual,
        ergOn: mode.kind === 'erg',
        sprintIn: n,
        reconnecting: ride.trainerStatus === 'reconnecting',
      })
    }
    slope.frame(mode, live.cadence)
    tally.record(ride.rec, el, live)
    if (now >= splashUntil || overlay[2] === 'pause') {
      view.overlay(...overlay)
    }
    view.frame({
      f,
      live,
      fast,
      total,
      intensity,
      paused: paused && !completing ? (manual ? 'manual' : 'auto') : null,
      power: ride.rec.power,
      xs: tally.xs,
      cadence: ride.rec.cadence,
      hr: ride.rec.hr,
      mode,
      weightKg: profile.weightKg || CFG.freeRide.defaultKg,
      count: overlay[0] === null ? changeIn : 0,
      cadPct: tally.cad.pct(),
      actions: actions(f),
      stats: tally.stats(ride.rec, el, total),
    })
  }
  const timer = setInterval(tick, 200)
  const key = soloKey(profile.id)
  const saver = setInterval(() => {
    if (!finished && ride.rec.power.length)
      saveSnap(key, {
        plan,
        el,
        intensity,
        tier: profile.tier,
        rec: ride.rec,
        xs: tally.xs,
        cSum: tally.cSum,
        cN: tally.cN,
      })
  }, CFG.recovery.saveMs)
  tick()

  async function end() {
    if (finished) return
    finished = true
    clearInterval(timer)
    clearInterval(saver)
    clearSnap(key)
    removeEventListener('keydown', onKey)
    offClick()
    await ride.stop()
    profile.tier = origTier
    tally.record(ride.rec, el, ride.live)
    const r = ftpResult(plan, ride.rec.power, tally.xs)
    if (r) {
      const pick = await view.prompt(
        `Your new FTP: ${r} W`,
        [`Was ${profile.ftp} W. Use it for all your workouts?`],
        ['Accept', 'Keep old'],
      )
      if (pick === 0) {
        recordFtp(profile, r)
        saveProfile(profile)
      }
    }
    finishRide(profile, ride.rec.summary(), done)
  }
}
