import { settings } from '../core/settings'
import { climbIn, climbLabel, distLabel, distText, speedText, unitNames } from '../core/units'

/** The display-unit helpers of core/units.ts with the rider's setting already applied. */
export const UNIT = {
  names: () => unitNames(settings.units),
  /** "12.3 km" / "7.6 mi" */
  dist: (m: number, dp = 1) => distLabel(m, settings.units, dp),
  /** "12.34" / "7.67": the HUD's distance, no unit. */
  distNum: (m: number) => distText(m, settings.units),
  /** "303 m" / "994 ft" */
  climb: (m: number) => climbLabel(m, settings.units),
  climbNum: (m: number) => String(Math.round(climbIn(m, settings.units))),
  /** "23.4": speed from m/s, no unit. */
  speed: (ms: number) => speedText(ms, settings.units),
}
