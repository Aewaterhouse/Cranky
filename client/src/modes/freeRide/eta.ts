import { CFG } from '../../config'
import { steadySpeed } from '../../core/physics'
import { routeAt, type Route } from '../../core/route'

const F = CFG.freeRide
const E = F.eta

/** A rider's power on a `grade`% bit of road as a share of their power on the flat, at trainer `difficulty`. */
export const powerShare = (grade: number, difficulty: number) =>
  Math.max(E.minShare, 1 + (difficulty * E.climbLift * Math.min(10, Math.max(-10, grade))) / 10)

/**
 * Seconds to ride the rest of `route` from `dist`, bit by bit through its elevation profile with the ride's
 * physics: `flatW` watts on the flat (more up a climb, less down one, see `powerShare`) and `draft` on the drag.
 */
export function remainingS(
  route: Route,
  dist: number,
  flatW: number,
  mass: number,
  difficulty: number,
  draft = 1,
) {
  const speeds = new Map<number, number>()
  const p = route.points
  let t = 0
  for (let i = 0; i < p.length - 1; i++) {
    const len = p[i + 1].d - Math.max(p[i].d, dist)
    if (len <= 0) continue
    const g = Math.round(p[i].grade * 4) / 4
    let v = speeds.get(g)
    if (v === undefined) {
      v = Math.max(E.minMs, steadySpeed(flatW * powerShare(g, difficulty), g, mass, draft))
      speeds.set(g, v)
    }
    t += len / v
  }
  return t
}

/**
 * The free ride's "Finish in": `remainingS` at the rider's recent average power (eased in from the FTP guess over
 * the first minute), turned back into flat power for the road it was ridden on. The predicted finish (clock plus
 * time left) is eased, so the number counts down smoothly instead of jumping with every surge or coast.
 */
export class FinishEstimate {
  private finish = NaN
  private nextAt = -Infinity
  private trail: [number, number][] = []

  constructor(
    private route: Route,
    private mass: number,
    private guessW: number,
  ) {}

  /**
   * Seconds to the finish. `el` is the ride clock, `power` the ride's per-second power so far, `now` wall seconds.
   */
  update(
    el: number,
    dist: number,
    power: number[],
    difficulty: number,
    draft: number,
    now: number,
  ) {
    const trail = this.trail
    if (!trail.length || el > trail[trail.length - 1][0]) trail.push([el, dist])
    while (trail.length > 2 && trail[1][0] <= el - E.windowS) trail.shift()
    if (now >= this.nextAt) {
      const dt = Number.isFinite(this.nextAt) ? now - this.nextAt + E.everyS : 0
      this.nextAt = now + E.everyS
      const recent = power.slice(-E.windowS)
      const avg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1)
      // The recent average was ridden up (or down) the road just behind: what would it be on the flat?
      const [, d0] = trail[0]
      const back = dist - d0
      const grade =
        back > 20 ? ((routeAt(this.route, dist).ele - routeAt(this.route, d0).ele) / back) * 100 : 0
      const w = Math.min(1, recent.length / E.windowS)
      const flatW = w * (avg / powerShare(grade, difficulty)) + (1 - w) * this.guessW
      const target =
        el + remainingS(this.route, dist, Math.max(1, flatW), this.mass, difficulty, draft)
      this.finish = Number.isNaN(this.finish)
        ? target
        : this.finish + (target - this.finish) * Math.min(1, dt / E.smoothS)
    }
    return Math.max(0, this.finish - el)
  }
}
