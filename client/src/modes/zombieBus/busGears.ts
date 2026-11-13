import { CFG } from '../../config'
import { gearGrade, shiftGear } from '../../core/gears'
import { settings } from '../../core/settings'
import type { ErgController } from '../../trainer/ergController'
import { gearTile, stepStrength, strengthSlider } from '../../ui/gearTile'

/**
 * The bus with ERG off: virtual gears on a flat bus road (`CFG.ride.gradeStart`), the gear tile and the shift
 * strength slider. The rider shifts to hold the target; the trainer only ever gets a gradient, via `erg`.
 */
export function busGears(erg: ErgController, mass: number) {
  let gear: number = CFG.gears.start
  let sent = NaN
  const tile = gearTile()
  const slider = strengthSlider()
  /** Sends the gear-adjusted gradient when it has moved enough (always when `force`). */
  const send = (cadence: number, force = false) => {
    if (settings.busErg) return
    const { chainring, shiftStrength } = settings
    const g = gearGrade(
      CFG.ride.gradeStart,
      cadence,
      gear,
      mass,
      CFG.ride.grade,
      chainring,
      1,
      shiftStrength,
    )
    if (force || !(Math.abs(g - sent) <= CFG.freeRide.sendDeltaPct)) erg.setGrade((sent = g))
    tile.set(gear, sent)
  }
  return {
    tile: tile.el,
    slider,
    send,
    shift(d: number, cadence: number) {
      gear = shiftGear(gear, d)
      send(cadence, true)
      return gear
    },
    strength(d: number, cadence: number) {
      stepStrength(d)
      send(cadence, true)
    },
  }
}
