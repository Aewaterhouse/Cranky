import { CFG } from '../../config'
import { rideBests, saveEfforts } from '../../core/efforts'
import type { RideRecorder } from '../../core/ride'
import type { Route } from '../../core/route'
import { baseRoute } from '../../core/segments'
import { SFX } from '../../ui/audio'
import { speak } from './quips'
import { segmentRun } from './segmentRun'

/**
 * The reasons-to-come-back side of a ride, wired to the toasts, the sound and storage: segments are timed and
 * saved as they are finished (so a crash keeps them), and the route and results go on the ride's record.
 */
export function rideExtras(
  route: Route,
  rider: { id: string; kg: number },
  rec: RideRecorder,
  toast: (text: string, secs?: number) => void,
  group: boolean,
) {
  const base = baseRoute(route)
  const segs = segmentRun(
    route,
    rider,
    rideBests(rider.id, base.id),
    (text, level) => {
      toast(text, level ? CFG.hud.toastBigS : undefined)
      if (level) (level > 1 ? SFX.MEGA : SFX.GREAT)()
      if (level) speak(text)
    },
    (e) => void saveEfforts(rider.id, [{ ...e, rideDate: rec.startedAt }]),
  )
  let was = { dist: 0, el: 0 }
  return {
    /** Every tick: the segment panel's state and the whole-route splits for the HUD. */
    tick(dist: number, el: number, power: number) {
      // In a group ride a jump up the road is a late join or a rejoin, not riding.
      const jumped = group && dist - was.dist > CFG.segments.jumpM
      const out = segs.tick(dist, el, power, Math.max(0, el - was.el), jumped)
      was = { dist, el }
      return out
    },
    /** At the end: what was ridden goes on the record for the results, history and exports. */
    finish(dist: number) {
      rec.segments = segs.results
      rec.route = {
        id: base.id,
        name: base.name,
        laps: route.lapOf ? Math.round(route.distance / base.distance) : undefined,
        done: dist >= route.distance,
      }
    },
  }
}
