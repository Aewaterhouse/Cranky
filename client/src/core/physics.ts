import { CFG } from '../config'

const P = CFG.freeRide
const G = 9.81

/** Rider plus bike, kg. */
export const totalMass = (weightKg?: number) => (weightKg || P.defaultKg) + P.bikeKg

/** Force opposing motion at speed `v` (m/s) on `gradePct`, in newtons. Negative on a steep descent. */
export function resistance(v: number, gradePct: number, mass: number) {
  const th = Math.atan(gradePct / 100)
  return mass * G * (Math.sin(th) + P.crr * Math.cos(th)) + 0.5 * P.rho * P.cda * v * Math.abs(v)
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
 * Advances speed `v` (m/s) by `dt` seconds. Zero power coasts (and accelerates down a hill to a
 * terminal speed); speed never goes below 0 (no rolling backwards) or above the cap (braking).
 */
export function stepSpeed(v: number, power: number, gradePct: number, mass: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / 0.1))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    const drive = Math.min((power * P.drivetrain) / Math.max(v, 0.5), P.maxDriveN)
    v += ((drive - resistance(v, gradePct, mass)) / mass) * h
    v = Math.min(P.maxMs, Math.max(0, v))
  }
  return v
}

/** The gradient the trainer is told: the road's, scaled by the difficulty (0..1). Physics keeps the real one. */
export function trainerGrade(gradePct: number, difficulty: number) {
  const [lo, hi] = P.grade
  return Math.min(hi, Math.max(lo, +(gradePct * difficulty).toFixed(1)))
}
