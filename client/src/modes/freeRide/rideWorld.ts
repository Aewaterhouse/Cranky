import { CFG } from '../../config'
import { flyStretch } from '../../core/flyover'
import type { Route } from '../../core/route'
import { lessMotion, settings } from '../../core/settings'
import { VIS } from '../../scene/params'
import type { RoadRider, RouteWorld } from '../../scene/route/routeWorld'
import { SFX } from '../../ui/audio'
import '../../perf.css'
import { perfOverlay } from '../../ui/perfOverlay'
import { rideIntro } from '../../ui/rideIntro'
import { momentFlash } from '../../ui/rideMoment'
import { rideSound } from '../../ui/rideSound'
import { cheering } from './feel'
import type { MomentCard } from './moments'
import { Quipper, speak, type QuipState } from './quips'

const F = CFG.freeRide

/**
 * The look-and-listen side of a ride: the 3D world (when the setting and WebGL allow), the ride sounds and the
 * commentator. Nothing here moves the rider or talks to the trainer; the ride loop feeds it every tick.
 */
export function rideWorld(
  route: Route,
  view: { root: HTMLElement; stage: HTMLElement; flat(): void; toast(text: string): void },
  me: RoadRider,
  withIntro = true,
) {
  let world: RouteWorld | undefined
  let gone = false
  // Less motion: a steady camera, no flyover, no turn round the rider, no confetti.
  const still = lessMotion()
  let orbit: ((secs: number, onFront: () => void) => void) | undefined
  const stills: Partial<Record<MomentCard['kind'], string>> = {}
  const sound = rideSound()
  const quipper = new Quipper()
  const top = route.points.reduce((a, p) => (p.ele > a.ele ? p : a))
  const climbs = top.ele - route.points[0].ele >= F.quips.summitGainM
  const base = route.lapOf ?? route
  // The card is up while the world loads, then captions the flyover; any key or tap ends both.
  let intro = withIntro ? rideIntro(base, () => endIntro()) : undefined
  const endIntro = () => {
    if (world) world.shot = undefined
    intro?.done()
    intro = undefined
    view.root.classList.remove('intro-on')
  }
  if (intro) view.root.append(intro.el)
  view.root.classList.toggle('intro-on', !!intro)
  const cardOnly = () => setTimeout(endIntro, CFG.intro.cardS * 1000)
  if (settings.freeRideView === '3d')
    Promise.all([
      import('../../scene/route/routeWorld'),
      import('../../scene/route/camShots'),
      import('../../scene/route/worldDev'),
    ])
      .then(([m, sp, dev]) => {
        if (gone) return
        VIS.route.feel.cam.calm = settings.calmCamera || still ? 1 : 0
        VIS.route.camDist = CFG.camDist[settings.camDist]
        world = new m.RouteWorld(view.stage, base)
        world.state = { me: me.id, riders: [me] }
        const w = world
        if (new URLSearchParams(location.search).get('perf') === '1')
          view.root.append(perfOverlay(dev.watchPerf(w)).el)
        orbit = (secs, onFront) => (w.shot = new sp.OrbitShot(secs, onFront))
        if (!intro) return
        if (still) return void cardOnly()
        const st = flyStretch(base, sp.hairpinsOf(world))
        world.shot = new sp.FlyShot(st.from, st.to, CFG.intro.secs, () => intro?.fly(st.what))
        world.onShotEnd = endIntro
      })
      .catch(() => (view.flat(), cardOnly()))
  else cardOnly()

  return {
    /** The pre-ride card or flyover is still up. */
    get intro() {
      return !!intro
    },
    skipIntro: () => intro && endIntro(),
    /** Where the main climb tops out, when the route has one worth a moment. */
    topD: climbs ? top.d : undefined,
    /** The still for the postcard: the lookout if there was one, else the finish. */
    get still() {
      return stills.summit ?? stills.finish
    },
    /** A summit or the finish: confetti, a turn of the camera, the announcer and the numbers so far. */
    celebrate(card: MomentCard) {
      view.root.append(momentFlash(card))
      speak(card.line)
      ;(card.kind === 'finish' ? SFX.MEGA : SFX.GREAT)()
      if (!world || intro) return
      const w = world
      const snap = () => {
        try {
          stills[card.kind] = w.snapshot()
        } catch {
          /* no still: the postcard draws without one */
        }
      }
      if (!still) w.party()
      if (settings.calmCamera || still || !orbit) snap()
      else orbit(CFG.moments.orbitS, snap)
    },
    /** The sky over the ride, for the wind. */
    get mood() {
      return world?.moodName
    },
    clunk: () => sound?.clunk(),
    /** Whether my rider should be celebrating here (the summit, the finish). */
    cheer: (dist: number) => cheering(dist, route.distance, climbs ? top.d : undefined),
    /** Riders to draw; on a lap ride the world draws one lap, so they wrap round at the lap length. */
    draw(riders: RoadRider[]) {
      const lapM = route.lapOf?.distance
      if (world) world.state.riders = riders.map((r) => (lapM ? { ...r, d: r.d % lapM } : r))
    },
    sound(s: { speed: number; coasting: boolean; paused: boolean; headwind: number; ele: number }) {
      sound?.update({
        ...s,
        place: world?.place(CFG.sound.ride.coastM) ?? { cover: 'b', y: s.ele, coast: false },
        mood: world?.moodName ?? 'route',
      })
    },
    /** A remark when one is due: on the HUD's toast, and spoken when the announcer is on. */
    quip(s: Omit<QuipState, 'summit' | 'near' | 'total'>) {
      if (!settings.quips) return
      const text = quipper.next({
        ...s,
        total: route.distance,
        summit: climbs && s.dist >= top.d,
        near: world?.near(),
      })
      if (!text) return
      view.toast(text)
      speak(text)
    },
    dispose() {
      gone = true
      endIntro()
      world?.dispose()
      sound?.stop()
    },
  }
}
