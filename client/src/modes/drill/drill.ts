import { CFG } from '../../config'
import type { Profile } from '../../core/curve'
import { frameAt, planTotal } from '../../core/plan'
import { saveProfile } from '../../core/profile'
import { World, debugPanel } from '../../scene/world'
import { SFX } from '../../ui/audio'
import { h, show } from '../../ui/dom'
import { makeHud } from '../../ui/hud'
import { finishRide } from '../../ui/results'
import type { Plan, Trainer } from '../../types'
import { RideController } from '../rideController'

/** Solo plan runner: local clock, minimal road scene, no horde. */
export function runDrill(plan: Plan, profile: Profile, trainer: Trainer, done: (p: Profile) => void) {
  const stage = h('div', { class: 'stage' })
  show(stage)
  const world = new World(stage)
  if (location.search.includes('debug')) debugPanel()
  const ride = new RideController(trainer, profile, plan)
  const total = planTotal(plan.blocks)
  const fast = +(new URLSearchParams(location.search).get('fast') ?? 1)
  let t0 = performance.now() + 5000
  let lastI = -1
  let lastCount = 0
  let speed = 0
  let finished = false
  const hud = makeHud((t) => {
    profile.tier = t
    saveProfile(profile)
  }, () => end())
  hud.setTier(profile.tier)
  stage.append(hud.root)
  ride.onSprint = (r) => (SFX[r.grade](), hud.sprint(r), r.grade !== 'FAIL' && r.grade !== 'HIT' && world.fx(r.grade === 'GREAT' ? 'shake' : 'slowmo'))
  ride.start()

  const timer = setInterval(() => {
    const el = ((performance.now() - t0) / 1000) * fast
    if (el < 0) {
      hud.banner(`Starting in ${Math.ceil(-el)}`, '', 1100)
      return
    }
    const f = frameAt(plan.blocks, el, profile.tier, profile.ftp)
    if (!f) return end()
    ride.setFrame(f)
    if (f.i !== lastI) {
      lastI = f.i
      SFX.block()
      if (f.type === 'sprint') hud.banner('SPRINT! ERG off, go all out!', 'grade-MEGA')
    }
    const count = f.next?.type === 'sprint' ? Math.ceil(f.next.in) : 0
    if (count !== lastCount && count > 0 && count <= 3) SFX.countdown()
    lastCount = count
    const live = ride.live
    const c = f.tgt ? (live.c ?? 0) : Math.min(1, live.avg / profile.ftp)
    speed += (4 + c * (CFG.scene.speedMax - 4) - speed) * 0.15
    world.state = { ...world.state, speed, mood: 'drill', busLook: profile.look, riders: [{ id: profile.id, name: profile.name, c: live.c, st: 'riding', cadence: live.cadence, look: profile.look }] }
    hud.frame(f, live, total)
  }, 250)

  async function end() {
    if (finished) return
    finished = true
    clearInterval(timer)
    t0 = 0
    await ride.stop()
    world.dispose()
    finishRide(profile, ride.rec.summary(), done)
  }
}
