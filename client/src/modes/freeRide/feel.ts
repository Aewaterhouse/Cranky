import { CFG } from '../../config'
import { gearGrade } from '../../core/gears'
import { headwind, leadM, speedLimit } from '../../core/physics'
import { routeAt, type Route } from '../../core/route'
import { hash } from '../../scene/math'
import { seedOf } from '../../scene/route/oddPlan'
import { newPose, RoadPath } from '../../scene/route/roadPath'

const F = CFG.freeRide
const W = F.wind
export type WindName = keyof typeof W.ms

/**
 * The gradient (%) free ride hands to `ErgController.setGrade`: flat when paused, otherwise the road a second or
 * two of travel ahead (so the resistance arrives as the road tilts), scaled by the difficulty, plus the virtual
 * gear's offset times the shift strength, less `draftPct` while drafting in a group. Always inside the
 * free-ride range; never a power target.
 */
export function trainerTarget(
  route: Route,
  dist: number,
  speed: number,
  difficulty: number,
  paused: boolean,
  cadence: number,
  gear: number,
  mass: number,
  chainring?: number,
  strength = 1,
  draftPct = 0,
) {
  if (paused) return 0
  const ahead = routeAt(route, Math.min(route.distance, dist + leadM(speed))).grade - draftPct
  return gearGrade(ahead, cadence, gear, mass, F.grade, chainring, difficulty, strength)
}

/** True while the rider should be celebrating: just over the top of a real climb, or rolling up to the finish. */
export const cheering = (dist: number, total: number, topD: number | undefined) =>
  dist >= total - F.cheer.finishM ||
  (topD !== undefined && dist >= topD && dist < topD + F.cheer.summitM)

/** What the shape of the road does to the ride: how fast the bends ahead allow, and the wind along it. */
export class RoadFeel {
  private path: RoadPath
  private lapM: number
  private pose = newPose()
  /** Radians the day's wind blows from. */
  readonly from: number

  constructor(route: Route, day = Math.floor(Date.now() / 86400000)) {
    const lap = route.lapOf ?? route
    this.path = new RoadPath(lap)
    this.lapM = route.lapOf ? lap.distance : Infinity
    this.from = hash(seedOf(lap.id) * 0.003 + day * 2.9) * Math.PI * 2
  }

  private at(d: number) {
    return this.path.poseAt(this.lapM === Infinity ? d : d % this.lapM, this.pose)
  }

  /** The speed (m/s) the bends ahead of `d` allow a rider doing `v`. */
  limit(d: number, v: number) {
    return speedLimit(v, (s) => this.at(d + s).curv)
  }

  /** Headwind in m/s at `d` (a tailwind is negative) for the wind setting, the sky's mood and the ride clock. */
  wind(d: number, name: WindName, mood: string | undefined, t: number) {
    const ms = W.ms[name] ?? 0
    if (!ms) return 0
    const sky = (W.mood as Record<string, number>)[mood ?? ''] ?? 1
    const gust = 1 + W.gust * Math.sin((t / W.gustS) * Math.PI * 2)
    const p = this.at(d)
    return headwind(ms * sky * gust, this.from, p.fx, p.fz)
  }
}
