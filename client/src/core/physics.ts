import { CFG } from '../config'

const P = CFG.freeRide
const K = P.corner
const G = 9.81

/** Rider plus bike, kg. */
export const totalMass = (weightKg?: number) => (weightKg || P.defaultKg) + P.bikeKg

/**
 * Force opposing motion at speed `v` (m/s) on `gradePct`, in newtons. Negative on a steep descent. `wind` is the
 * headwind in m/s (a tailwind is negative): the air drags on the speed through the air, not over the ground.
 * `draft` scales the drag (1 is clean air, see `draftFactor`).
 */
export function resistance(v: number, gradePct: number, mass: number, wind = 0, draft = 1) {
  const th = Math.atan(gradePct / 100)
  const air = v + wind
  return (
    mass * G * (Math.sin(th) + P.crr * Math.cos(th)) +
    0.5 * P.rho * P.cda * draft * air * Math.abs(air)
  )
}

/** Steady speed (m/s) at which `power` W balances the resistance. Bisection; 0 when the rider cannot move. */
export function steadySpeed(power: number, gradePct: number, mass: number) {
  const w = power * P.drivetrain
  let lo = 0
  let hi = P.maxMs
  if (w - resistance(hi, gradePct, mass) * hi >= 0) return hi
  if (resistance(0, gradePct, mass) >= 0 && w <= 0) return 0
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (w - resistance(mid, gradePct, mass) * mid > 0) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Advances speed `v` (m/s) by `dt` seconds. Zero power coasts (and accelerates down a hill to a terminal
 * speed); the bike keeps its momentum, so speed gained in a dip carries up the other side. Speed never goes
 * below 0 (no rolling backwards) or above the cap. Above `limit` (a bend coming, see `speedLimit`) the brakes
 * go on, no harder than `maxBrakeMs2`.
 */
export function stepSpeed(
  v: number,
  power: number,
  gradePct: number,
  mass: number,
  dt: number,
  wind = 0,
  limit: number = P.maxMs,
  draft = 1,
) {
  const n = Math.max(1, Math.ceil(dt / 0.1))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    const drive = Math.min((power * P.drivetrain) / Math.max(v, 0.5), P.maxDriveN)
    const next = v + ((drive - resistance(v, gradePct, mass, wind, draft)) / mass) * h
    v = next > limit ? Math.max(limit, Math.min(next, v - K.maxBrakeMs2 * h)) : next
    v = Math.min(P.maxMs, Math.max(0, v))
  }
  return v
}

/** The fastest a bend of curvature `curv` (1/m) can be taken: grip sets it, with a floor so a hairpin never stops you. */
export const cornerSpeed = (curv: number) =>
  Math.min(P.maxMs, Math.max(K.minMs, Math.sqrt(K.latMs2 / Math.max(1e-6, Math.abs(curv)))))

/**
 * The speed allowed right now at speed `v`, given the bends ahead: `curvAt(s)` is the curvature `s` metres up
 * the road. Braking gently at `brakeMs2` from this speed gets the rider down to every bend's speed in time.
 */
export function speedLimit(v: number, curvAt: (s: number) => number) {
  let lim: number = P.maxMs
  const reach = (v * v) / (2 * K.brakeMs2)
  // A bend found at one sample may begin anywhere after the sample before it.
  for (let s = 0; s <= reach + K.stepM; s += K.stepM)
    lim = Math.min(
      lim,
      Math.sqrt(cornerSpeed(curvAt(s)) ** 2 + 2 * K.brakeMs2 * Math.max(0, s - K.stepM)),
    )
  return lim
}

/**
 * Group rides: the drag multiplier (1 is clean air) for a rider, given the metres to each moving rider ahead.
 * Full on a wheel, nothing by `reachM`, a bit more for every extra rider close ahead. The server's
 * `draft_factor` is the one that counts; this is the same sum for the client's guess between ticks.
 */
export function draftFactor(gaps: number[]) {
  const D = CFG.road.draft
  const near = gaps.filter((g) => g > 0 && g <= D.bunchM)
  const first = Math.min(...near)
  if (!near.length || first >= D.reachM) return 1
  const fade = Math.min(1, (D.reachM - first) / (D.reachM - D.fullM))
  return 1 - Math.min(D.cap, D.wheel * fade * (1 + D.bunchX * (near.length - 1)))
}

/** Watts drafting is saving at physics speed `v` (m/s) with drag multiplier `draft`. */
export const draftSaving = (v: number, draft: number) => 0.5 * P.rho * P.cda * (1 - draft) * v ** 3

/** Keep-together: the scale on distance covered for a rider `gap` metres ahead of the middle of the group. */
export function bandFactor(gap: number) {
  const B = CFG.road.band
  const over = Math.min(1, Math.max(0, Math.abs(gap) - B.deadM) / (B.fullM - B.deadM))
  return 1 - Math.sign(gap) * over * B.max
}

/** Metres ahead at which the trainer's gradient is read at speed `v`, so the resistance arrives with the road. */
export const leadM = (v: number) => Math.min(P.lead.maxM, Math.max(0, v) * P.lead.s)

/**
 * Headwind (m/s, a tailwind is negative) for a rider heading along the unit vector (`fx`, `fz`) in a wind of
 * `ms` blowing from `from` radians (0 is from -z, north on a real route; a quarter turn is from +x, east).
 */
export const headwind = (ms: number, from: number, fx: number, fz: number) =>
  ms * (fx * Math.sin(from) - fz * Math.cos(from))

/** Seconds to ride `points` (each with a gradient, `space` metres apart) at a steady `power`. */
export function rideSeconds(grades: number[], space: number, power: number, mass: number) {
  return grades.reduce((t, g) => t + space / Math.max(0.5, steadySpeed(power, g, mass)), 0)
}
