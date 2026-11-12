import { CFG } from '../../config'
import type { Profile } from '../../core/curve'
import { frameAt, planTotal } from '../../core/plan'
import { saveProfile } from '../../core/profile'
import type { Lobby, Tick } from '../../net/protocol'
import type { WsClient } from '../../net/wsClient'
import { World, debugPanel } from '../../scene/world'
import type { Mood } from '../../scene/params'
import { mood as moodAudio, SFX, stopAudio } from '../../ui/audio'
import { h, show } from '../../ui/dom'
import { makeHud } from '../../ui/hud'
import type { Trainer } from '../../types'
import { RideController } from '../rideController'

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
  const ride = new RideController(trainer, profile, plan)
  const isHost = () => l.host === profile.id
  const looks = () => Object.fromEntries(l.riders.map((r) => [r.id, r.look]))
  let lk = looks()
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
      plan,
      tier: profile.tier,
      rec: ride.rec,
      meId: profile.id,
      onBuy: (item) => net.send({ t: 'buy', item }),
    },
  )
  hud.setTier(profile.tier)
  stage.append(hud.root)
  ride.onSprint = (r) => {
    SFX[r.grade]()
    hud.sprint(r)
    net.send({ t: 'sprint', ...r })
  }
  ride.start()
  const sender = setInterval(() => {
    const v = ride.live
    net.send({
      t: 'data',
      p: v.power,
      w: Math.round(v.avg),
      cad: v.cadence,
      s: ride.frame?.tgt ? v.c : null,
    })
  }, 1000 / CFG.net.sendHz)
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
    if (m.i < 0) {
      hud.countdown(Math.ceil(-m.el), ride.live)
      ride.setFrame(null)
    } else {
      const f = frameAt(plan.blocks, m.el, profile.tier, profile.ftp)
      if (f) {
        f.tgt = me?.tgt ?? f.tgt
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
      if (fx.k === 'shake') world.fx('shake')
      if (fx.k === 'slowmo') {
        world.fx('slowmo')
        world.fx('shake')
      }
    }
    const b = m.bus
    world.state = {
      speed: b.speed,
      gap: b.gap,
      armour: b.armour,
      mood: (m.i < 0 ? 'drill' : m.ev in { warmup: 1, cooldown: 1 } ? 'drill' : m.ev) as Mood,
      roadblock: b.rb,
      busLook: lk[l.host],
      riders: Object.entries(m.riders).map(([id, r]) => ({
        id,
        name: r.name,
        c: r.s,
        st: r.st,
        cadence: r.cad,
        look: lk[id],
      })),
    }
    hud.tick(m)
  }

  const cleanup = async () => {
    clearInterval(sender)
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
