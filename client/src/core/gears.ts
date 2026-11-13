import { CFG } from '../config'
import { resistance } from './physics'

const G = CFG.gears

export const gearCount = G.ratios.length
export const gearText = (gear: number) => `Gear ${gear}/${gearCount}`

/** One gear up (d = 1) or down (d = -1), stopping at the first and last gear. */
export const shiftGear = (gear: number, d: number) => Math.min(gearCount, Math.max(1, gear + d))

/**
 * How far the virtual gear moves the gradient (% points) at `cadence` on a real road of `roadPct`: the
 * gradient at which the trainer's wheel (chainring / Zwift Cog) costs the same power as the virtual bike
 * in `gear`, minus the road. Zero when the rider is barely pedalling.
 */
export function gearOffset(
  roadPct: number,
  cadence: number,
  gear: number,
  mass: number,
  chainring = G.chainring,
) {
  if (cadence < G.minCadence) return 0
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
  return (a + b) / 2 - roadPct
}

/**
 * The gradient (%) sent to the trainer: road × `difficulty` plus the gear offset × `strength`, clamped
 * to `range`. The offset always uses the real road, so difficulty does not change how a gear feels.
 */
export function gearGrade(
  roadPct: number,
  cadence: number,
  gear: number,
  mass: number,
  range: readonly number[],
  chainring = G.chainring,
  difficulty = 1,
  strength = 1,
) {
  const [lo, hi] = range
  const g = roadPct * difficulty + gearOffset(roadPct, cadence, gear, mass, chainring) * strength
  return Math.min(hi, Math.max(lo, +g.toFixed(1) || 0))
}

/** Shift strength `d` steps on from `cur`, on the step grid and inside the setting's range. */
export function nextStrength(cur: number, d: number) {
  const S = CFG.gears.strength
  const v = Math.round((cur + d * S.step) / S.step) * S.step
  return +Math.min(S.max, Math.max(S.min, v)).toFixed(2)
}
