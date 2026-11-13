import { CFG } from '../config'

export type Units = 'metric' | 'imperial'
const U = CFG.units

/**
 * Display units. Everything is stored and worked out in metric (metres, m/s, kilograms); these turn a number
 * into what the rider reads, at the edge of the screen and nowhere else. `u` is the rider's setting.
 */
export const unitNames = (u: Units) =>
  u === 'imperial'
    ? { speed: 'mph', dist: 'mi', climb: 'ft', weight: 'lb' }
    : { speed: 'km/h', dist: 'km', climb: 'm', weight: 'kg' }

/** m/s as km/h or mph. */
export const speedIn = (ms: number, u: Units) => ms * (u === 'imperial' ? U.mphPerMs : 3.6)
/** Metres as kilometres or miles. */
export const distIn = (m: number, u: Units) => m / (u === 'imperial' ? U.mPerMile : 1000)
/** Metres of height as metres or feet. */
export const climbIn = (m: number, u: Units) => m * (u === 'imperial' ? U.ftPerM : 1)
/** Kilograms as kilograms or pounds, and back for an input box. */
export const weightIn = (kg: number, u: Units) => kg * (u === 'imperial' ? U.lbPerKg : 1)
export const weightToKg = (v: number, u: Units) => v / (u === 'imperial' ? U.lbPerKg : 1)

/** "12.3": a distance with two decimals under ten units, then one (the HUD's rule). */
export const distText = (m: number, u: Units) => {
  const v = distIn(m, u)
  return v.toFixed(v < 10 ? 2 : 1)
}
/** "12.3 km" or "7.6 mi", one decimal. */
export const distLabel = (m: number, u: Units, dp = 1) =>
  `${distIn(m, u).toFixed(dp)} ${unitNames(u).dist}`
/** "303 m" or "994 ft". */
export const climbLabel = (m: number, u: Units) =>
  `${Math.round(climbIn(m, u)).toLocaleString('en-AU')} ${unitNames(u).climb}`
/** "23.4": a speed with one decimal. */
export const speedText = (ms: number, u: Units) => speedIn(ms, u).toFixed(1)
