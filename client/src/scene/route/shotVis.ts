/**
 * Tunables for the camera's set pieces, in metres. Shown in the debug panel as `VIS.route.fly` (the pre-ride
 * flyover) and `VIS.route.orbit` (the turn round the rider at a summit or the finish).
 */
export const FLY = {
  /** Height above the road at the start and the end of the sweep. */
  highM: 42,
  lowM: 7,
  /** Metres right of the road at the start and the end (negative is left). */
  sideM: 34,
  sideEndM: 5,
  /** The camera trails the point it is about by this much and looks this far past it. */
  backM: 30,
  lookM: 70,
  /** Never closer to the ground than this. */
  clearM: 4,
  /** A slow frame moves a set piece on by at most this many seconds. */
  maxStepS: 0.5,
}
export const ORBIT = {
  radiusM: 9,
  /** Extra radius half-way round, in front of the rider. */
  swellM: 2,
  heightM: 3.4,
  aimUpM: 1.1,
}
