import { CFG } from '../config'
import { resistance } from './physics'

const G = CFG.gears

export const gearCount = G.ratios.length
export const gearText = (gear: number) => `Gear ${gear}/${gearCount}`

/** One gear up (d = 1) or down (d = -1), stopping at the first and last gear. */
export const shiftGear = (gear: number, d: number) => Math.min(gearCount, Math.max(1, gear + d))

/**
 * The gradient (%) to send the trainer so that pedalling at `cadence` in virtual `gear` costs the same
 * power as on the road's gradient `roadPct`. The trainer's wheel turns at the physical ratio
 * (chainring / Zwift Cog); the virtual bike's at the gear's ratio. Clamped to `range`.
 */
export function gearGrade(
  roadPct: number,
  cadence: number,
  gear: number,
  mass: number,
  range: readonly number[],
  chainring = G.chainring,
) {
  const [lo, hi] = range
  const clamp = (v: number) => Math.min(hi, Math.max(lo, +v.toFixed(1) || 0))
  if (cadence < G.minCadence) return clamp(roadPct)
  const rev = (cadence / 60) * G.wheelM
  const vVirt = rev * G.ratios[gear - 1]
  const vReal = (rev * chainring) / G.cogTeeth
  const want = resistance(vVirt, roadPct, mass) * vVirt
  // Power at a fixed speed rises with gradient, so bisect for the gradient that matches.
  let a = -50
  let b = 50
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2
    if (resistance(vReal, mid, mass) * vReal < want) a = mid
    else b = mid
  }
  return clamp((a + b) / 2)
}
