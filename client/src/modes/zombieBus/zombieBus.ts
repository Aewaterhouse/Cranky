import { CFG } from '../../config'
import { busScore } from '../../core/hud'
import { saveSettings, settings } from '../../core/settings'
import type { Profile } from '../../core/curve'
import { frameAt, planTotal } from '../../core/plan'
import { saveProfile } from '../../core/profile'
import { RideRecorder } from '../../core/ride'
import { busKey, clearSnap, loadSnap, saveSnap, type BusSnap } from '../../core/snapshot'
import { ClockSync } from '../../net/clockSync'
import { currentHr } from '../../trainer/heartRate'
import type { Lobby, Tick } from '../../net/protocol'
import type { WsClient } from '../../net/wsClient'
import { World, debugPanel } from '../../scene/world'
import type { Mood } from '../../scene/params'
import { mood as moodAudio, SFX, stopAudio } from '../../ui/audio'
import { h, show } from '../../ui/dom'
import { makeHud } from '../../ui/hud'
import type { Trainer } from '../../types'
import { RideController } from '../rideController'
import { busGears } from './busGears'
import { camButton, camKey } from '../../ui/camButton'
import { VIEW_NAMES } from '../../scene/camVis'
import { busErgOn } from '../../core/gears'
import { totalMass } from '../../core/physics'
import { onClickShift } from '../../trainer/zwiftClick'

const FX_SOUND: Record<string, () => void> = {
  buy: SFX.scrap,
  repel: SFX.shake,
  hit: SFX.hit,
  grab: SFX.grab,
  shake: SFX.shake,
  smash: SFX.MEGA,
  crash: SFX.hit,
  hauled: SFX.scrap,
  tune: SFX.GREAT,
  fell: SFX.FAIL,
  go: SFX.go,
  box: SFX.MEGA,
  crown: SFX.GREAT,
  lead: SFX.scrap,
  sandbag: SFX.FAIL,
  drop: SFX.scrap,
  airstrike: SFX.GREAT,
  gunship: SFX.MEGA,
}

/** Zombie Bus ride view driven by server ticks. */
export function startBusRide(
  lobby0: Lobby,
  profile: Profile,
  trainer: Trainer,
  net: WsClient,
  leave: () => void,
) {
  const stage = h('div', { class: 'stage' })
  show(stage)
  const world = new World(stage)
  if (location.search.includes('debug')) debugPanel()
  let l = lobby0
  const plan = l.plan
  const total = planTotal(plan.blocks)
  const key = busKey(profile.id, l.code)
  const saved = loadSnap<BusSnap>(key)
  const ride = new RideController(
    trainer,
    profile,
    plan,
    undefined,
    undefined,
    saved?.planId === plan.id ? RideRecorder.fromJSON(saved.rec) : undefined,
  )
  const isHost = () => l.host === profile.id
  const looks = () => Object.fromEntries(l.riders.map((r) => [r.id, r.look]))
  let lk = looks()
  // Non-ERG riding: virtual gears, the trainer gets a gradient; targets still score. All writes stay in ergController.
  const ergOn = () => busErgOn(l.trainers, settings.busErg)
  const gears = busGears(ride.erg, totalMass(profile.weightKg), ergOn)
  const applyErg = () => (ergOn() ? ride.erg.setErg() : gears.send(ride.live.cadence, true))
  const hud = makeHud(
    (t) => {
      profile.tier = t
      saveProfile(profile)
      net.send({ t: 'tier', tier: t })
    },
    () => {
      if (isHost() && confirm('End the ride for everyone?')) net.send({ t: 'end' })
      else if (!isHost() && confirm('Leave the bus?')) leave()
    },
    {
      erg: {
        on: ergOn,
        toggle: () => {
          if (l.trainers && l.trainers !== 'choose')
            return hud.toast(
              `The driver has everyone on ${l.trainers === 'erg' ? 'ERG' : 'gears'} this ride`,
            )
          saveSettings({ busErg: !settings.busErg })
          net.send({ t: 'erg', on: settings.busErg })
          applyErg()
          hud.toast(
            settings.busErg
              ? 'ERG on: the trainer holds your target'
              : 'ERG off: shift to hold the target. Z X or ↓ ↑ change gear',
          )
        },
        shift: (d) => gears.shift(d, ride.live.cadence),
        strength: (d) => gears.strength(d, ride.live.cadence),
        tile: gears.tile,
        slider: gears.slider,
      },
      plan,
      tier: profile.tier,
      rec: ride.rec,
      meId: profile.id,
      weightKg: profile.weightKg,
      quitLabel: () => (isHost() ? 'End ride' : 'Leave the bus'),
      onBuy: (item) => net.send({ t: 'buy', item }),
      mad:
        l.game === 'madness'
          ? [...new Set(plan.blocks.filter((x) => x.work).map((x) => x.label ?? ''))]
          : undefined,
    },
  )
  hud.setTier(profile.tier)
  stage.append(hud.root)
  // C or the camera button: the next camera view (Chase, High, Rear, Side).
  const cycleView = () => {
    const v = world.cycleView()
    if (v) hud.toast(`Camera: ${VIEW_NAMES[v]}`)
  }
  hud.root.querySelector('.dock-l')?.append(camButton(cycleView))
  const offCam = camKey(() => hud.root.isConnected, cycleView)
  ride.onSprint = (r) => {
    SFX[r.grade]()
    hud.sprint(r)
    net.send({ t: 'sprint', ...r })
  }
  ride.onTrainerStatus = (s) =>
    hud.banner(
      s === 'connected' ? 'Trainer reconnected' : 'Trainer disconnected, reconnecting…',
      4000,
    )
  ride.start()
  if (!ergOn()) applyErg()
  const offClick = onClickShift((d) => !ergOn() && gears.shift(d, ride.live.cadence))
  const sender = setInterval(() => {
    const v = ride.live
    gears.send(v.cadence)
    const hr = currentHr()
    net.send({
      t: 'data',
      p: v.power,
      w: Math.round(v.avg),
      cad: v.cadence,
      s: busScore(ride.frame, v.c),
      hr,
      hrp: hr && profile.maxHr ? Math.round((hr / profile.maxHr) * 100) / 100 : null,
    })
  }, 1000 / CFG.net.sendHz)
  const saver = setInterval(
    () => ride.rec.power.length && saveSnap(key, { planId: plan.id, rec: ride.rec }),
    CFG.recovery.saveMs,
  )
  // Block changes are scheduled off a local estimate of the server clock, not the 2 Hz tick.
  const clock = new ClockSync()
  let running = false
  const localFrame = () => {
    const el = running ? clock.now(performance.now()) : null
    return el === null ? null : frameAt(plan.blocks, el, profile.tier, profile.ftp)
  }
  const scheduler = setInterval(() => {
    const f = localFrame()
    if (f) ride.setFrame(f)
  }, 1000 / CFG.clock.hz)
  let lastI = -2
  let lastEv = ''
  let lastCount = 0

  function tick(m: Tick) {
    const me = m.riders[profile.id]
    if (me && me.tier !== profile.tier) {
      profile.tier = me.tier
      hud.setTier(me.tier)
      saveProfile(profile)
    }
    clock.tick(m.el, performance.now())
    running = m.i >= 0
    if (m.i < 0) {
      hud.countdown(Math.ceil(-m.el), ride.live)
      ride.setFrame(null)
    } else {
      const f = localFrame() ?? frameAt(plan.blocks, m.el, profile.tier, profile.ftp)
      if (f) {
        if (f.i === m.i) f.tgt = me?.tgt ?? f.tgt
        ride.setFrame(f)
        hud.frame(f, ride.live, total, m.ev)
        const count = f.next?.type === 'sprint' ? Math.ceil(f.next.in) : 0
        if (count !== lastCount && count > 0 && count <= 3) SFX.countdown()
        lastCount = count
      }
      if (m.i !== lastI) {
        SFX.block()
      }
    }
    lastI = m.i
    if (m.ev !== lastEv) moodAudio((lastEv = m.ev))
    for (const fx of m.fx) {
      FX_SOUND[fx.k]?.()
      if (fx.k === 'hit' || fx.k === 'crash') world.fx('hit')
      if (fx.k === 'smash' || fx.k === 'crash') world.fx('smash')
      if (fx.k === 'shake' || fx.k === 'go' || fx.k === 'crown') world.fx('shake')
      if (fx.k === 'box') world.fx('slowmo')
      if (fx.k === 'drop' || fx.k === 'airstrike') world.fx(fx.k)
      if (fx.k === 'slowmo') {
        world.fx('slowmo')
        world.fx('shake')
      }
    }
    const b = m.bus
    const calm = m.i < 0 || m.ev in { warmup: 1, cooldown: 1 } || (b.mad && m.ev === 'servo')
    world.state = {
      speed: b.speed,
      gap: b.mad ? null : b.gap,
      mad: b.mad,
      armour: b.armour,
      mood: (calm ? 'drill' : m.ev) as Mood,
      roadblock: b.rb,
      busLook: lk[l.host],
      gunship: b.gunship,
      riders: Object.entries(m.riders).map(([id, r]) => ({
        id,
        name: r.name,
        c: r.s,
        st: r.st,
        cadence: r.cad,
        look: lk[id],
        hr: r.hr,
        hrp: r.hrp,
        effort: r.tgt ? r.w / r.tgt : r.w > 0 ? 1 : 0,
      })),
    }
    hud.tick(m)
  }

  const cleanup = async () => {
    offClick()
    offCam()
    clearInterval(sender)
    clearInterval(saver)
    clearInterval(scheduler)
    running = false
    clearSnap(key)
    stopAudio()
    await ride.stop()
    world.dispose()
  }
  return {
    tick,
    toast: (t: string) => hud.toast(t),
    lobby(m: Lobby) {
      l = m
      lk = looks()
    },
    async finish() {
      let postcard = ''
      try {
        postcard = world.snapshot()
      } catch {
        /* no snapshot */
      }
      await cleanup()
      return { summary: ride.rec.summary(), postcard }
    },
    abort: () => void cleanup(),
  }
}
export type BusRide = ReturnType<typeof startBusRide>
