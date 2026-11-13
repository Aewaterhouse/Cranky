import { CFG } from '../../config'
import type { Route } from '../../core/route'
import { settings } from '../../core/settings'
import { VIS } from '../../scene/params'
import type { RoadRider, RouteWorld } from '../../scene/route/routeWorld'
import { rideSound } from '../../ui/rideSound'
import { cheering } from './feel'
import { Quipper, speak, type QuipState } from './quips'

const F = CFG.freeRide

/**
 * The look-and-listen side of a ride: the 3D world (when the setting and WebGL allow), the ride sounds and the
 * commentator. Nothing here moves the rider or talks to the trainer; the ride loop feeds it every tick.
 */
export function rideWorld(
  route: Route,
  view: { stage: HTMLElement; flat(): void; toast(text: string): void },
  me: RoadRider,
) {
  let world: RouteWorld | undefined
  let gone = false
  const sound = rideSound()
  const quipper = new Quipper()
  const top = route.points.reduce((a, p) => (p.ele > a.ele ? p : a))
  const climbs = top.ele - route.points[0].ele >= F.quips.summitGainM
  if (settings.freeRideView === '3d')
    import('../../scene/route/routeWorld')
      .then((m) => {
        if (gone) return
        VIS.route.feel.cam.calm = settings.calmCamera ? 1 : 0
        world = new m.RouteWorld(view.stage, route.lapOf ?? route)
        world.state = { me: me.id, riders: [me] }
      })
      .catch(() => view.flat())

  return {
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
      world?.dispose()
      sound?.stop()
    },
  }
}
