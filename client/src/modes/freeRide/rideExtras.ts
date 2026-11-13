import { CFG } from '../../config'
import { rideBests, saveEfforts } from '../../core/efforts'
import { ghostD, type GhostSpec } from '../../core/ghost'
import { totalMass } from '../../core/physics'
import type { RideRecorder } from '../../core/ride'
import type { Route } from '../../core/route'
import { baseRoute } from '../../core/segments'
import { VIS } from '../../scene/params'
import type { RoadRider } from '../../scene/route/roadRiders'
import { SFX } from '../../ui/audio'
import { makeGhosts, stepGhosts } from './ghosts'
import { speak } from './quips'
import { segmentRun } from './segmentRun'

/**
 * The reasons-to-come-back side of a ride, wired to the toasts, the sound and storage: segments are timed and
 * saved as they are finished (so a crash keeps them), the route and results go on the ride's record, and
 * `ghosts` (best efforts picked on the setup screen) ride again. Ghosts are only ever drawn and listed, as are
 * the `mates` made up by the `?ghosts=N` dev aid.
 */
export function rideExtras(
  route: Route,
  rider: { id: string; kg: number; ftp: number },
  rec: RideRecorder,
  view: { toast(text: string, secs?: number): void },
  o: { me: RoadRider; group: boolean; ghosts?: GhostSpec[]; mates?: number },
) {
  const ghosts = o.ghosts ?? []
  const mates = makeGhosts(o.me, rider.ftp, o.mates ?? 0)
  const base = baseRoute(route)
  const segs = segmentRun(
    route,
    rider,
    rideBests(rider.id, base.id),
    (text, level) => {
      view.toast(text, level ? CFG.hud.toastBigS : undefined)
      if (level) (level > 1 ? SFX.MEGA : SFX.GREAT)()
      if (level) speak(text)
    },
    (e) => void saveEfforts(rider.id, [{ ...e, rideDate: rec.startedAt }]),
  )
  let was = { dist: 0, el: 0 }
  const G = VIS.route.ghost
  const riders = ghosts.map((g, i): RoadRider => ({
    id: g.id,
    name: g.name,
    d: 0,
    offset: VIS.route.lane + G.lanes[i % G.lanes.length],
    speed: 0,
    cadence: 0,
    ghost: true,
  }))
  return {
    /**
     * Every tick: the segment panel's state, the whole-route splits and the riders that are not really there
     * (ghosts and dev mates). `fast` is the dev speed-up, so the scene carries a ghost on at the right pace.
     */
    tick(dist: number, el: number, power: number, { paused = false, fast = 1, dt = 0 } = {}) {
      // In a group ride a jump up the road is a late join or a rejoin, not riding.
      const jumped = o.group && dist - was.dist > CFG.segments.jumpM
      const out = segs.tick(dist, el, power, Math.max(0, el - was.el), jumped)
      riders.forEach((r, i) => {
        const d = ghostD(ghosts[i], base.distance, route.distance, el)
        r.speed = el > was.el ? ((d - r.d) / (el - was.el)) * fast : 0
        r.cadence = r.speed > 0 ? CFG.segments.ghostCadence : 0
        r.d = d
      })
      was = { dist, el }
      stepGhosts(mates, route, totalMass(rider.kg), paused, fast, dt)
      return {
        ...out,
        riders: [...mates.map((g) => ({ ...g.rider, wkg: g.watts / rider.kg })), ...riders],
      }
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
