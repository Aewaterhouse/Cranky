import { clamp } from '../math'
import { FEEL } from './feelVis'

const P = FEEL.rider
const C = FEEL.cam

/** What a rider on the road is doing, each 0 or 1 as a target (or 0..1 once eased). */
export interface RoadPose {
  /** Out of the saddle, rocking the bike. */
  stand: number
  /** Low over the bars on a fast descent. */
  tuck: number
  /** Sitting up, arms in the air. */
  cheer: number
  /** Not pedalling: cranks level. */
  coast: number
}

export const newRoadPose = (): RoadPose => ({ stand: 0, tuck: 0, cheer: 0, coast: 0 })

/** What we know of a rider this frame. `grade` is a fraction; `power` and `effort` may be unknown. */
export interface PoseIn {
  grade: number
  speed: number
  cadence: number
  power?: number
  effort?: number
  cheer?: boolean
}

/**
 * The pose a rider should be moving towards. `was` is the last answer, so standing and tucking do not flicker
 * when the gradient or speed hovers at the threshold. Cheering beats everything; a coasting rider never stands.
 */
export function poseWants(s: PoseIn, was: RoadPose, out: RoadPose = newRoadPose()): RoadPose {
  const idle = s.power === undefined ? s.cadence <= 0 : s.power <= 0
  const coast = idle && s.speed > P.coastMs
  const cheer = !!s.cheer
  const effort = s.effort ?? 0
  const up = was.stand
    ? s.grade > P.standGrade - P.standGradeOff || effort > P.standEffort - P.standEffortOff
    : s.grade >= P.standGrade || effort >= P.standEffort
  const low = s.speed >= P.tuckMs - (was.tuck ? P.tuckOff : 0) && s.grade <= -P.tuckGrade
  out.coast = coast ? 1 : 0
  out.cheer = cheer ? 1 : 0
  out.stand = up && !idle && !cheer ? 1 : 0
  out.tuck = low && coast && !cheer ? 1 : 0
  return out
}

/** How far a rider leans into a bend of curvature `curv` (1/m) at `speed`: positive to the right. */
export const bendLean = (speed: number, curv: number) =>
  clamp((speed * speed * curv) / 9.81, -P.maxLean, P.maxLean)

/** The crank angle a coasting rider's pedals settle at: the nearest level position to `phase`. */
export const levelPhase = (phase: number) => Math.round(phase / Math.PI) * Math.PI

/** 0..1: how hard the camera shakes at `speed` on `grade` (a fraction; only descents shake). */
export const shakeAmount = (speed: number, grade: number) =>
  clamp((speed - C.shakeFrom) / (C.shakeFull - C.shakeFrom)) * clamp(-grade / C.shakeGrade)

/** Degrees the view widens at `speed`. */
export const fovKick = (speed: number) => clamp(speed / C.fovKickAt) * C.fovKick

/** The camera's roll for a rider leaning `lean`: a share of it, capped, and the same way. */
export const camRoll = (lean: number) => clamp(lean * C.lean, -C.leanMax, C.leanMax)
