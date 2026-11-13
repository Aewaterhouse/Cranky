import { CFG } from '../../config'
import { steadySpeed } from '../../core/physics'
import { routeAt, type Route } from '../../core/route'
import type { RoadRider } from '../../scene/route/routeWorld'

const G = CFG.freeRide.ghosts

export interface Ghost {
  rider: RoadRider
  watts: number
}

/** Dev aid (`?ghosts=N`): made-up mates riding steadily at a spread of efforts, to see the rider list and a bunch. */
export const makeGhosts = (me: RoadRider, ftp: number, n: number): Ghost[] =>
  G.names.slice(0, n).map((name, i, all) => ({
    rider: { ...me, id: `ghost${i}`, name, look: undefined, d: G.gapM * (i + 1) },
    watts: ftp * (G.ftp[0] + ((G.ftp[1] - G.ftp[0]) * i) / all.length),
  }))

/** Moves the ghosts on by `dt` seconds at their steady speeds (no bends, no wind). */
export function stepGhosts(
  ghosts: Ghost[],
  route: Route,
  mass: number,
  paused: boolean,
  fast: number,
  dt: number,
) {
  for (const g of ghosts) {
    g.rider.speed = paused ? 0 : steadySpeed(g.watts, routeAt(route, g.rider.d).grade, mass) * fast
    g.rider.cadence = paused ? 0 : G.cadence
    g.rider.d = Math.min(route.distance, g.rider.d + g.rider.speed * dt)
  }
}
