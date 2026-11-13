import { CFG } from '../../config'
import { gearGrade } from '../../core/gears'
import { settings } from '../../core/settings'
import type { ErgController } from '../../trainer/ergController'
import type { ModeState } from '../../ui/soloMode'

/** Slope mode with virtual gears: sends the gear-adjusted gradient when it moves by more than the free-ride step. */
export function slopeSender(erg: ErgController, mass: number) {
  let sent = NaN
  return (m: ModeState, cadence: number, force = false) => {
    const g = gearGrade(m.grade, cadence, m.gear, mass, CFG.ride.grade, settings.chainring)
    if (force || Math.abs(g - sent) > CFG.freeRide.sendDeltaPct) erg.setGrade((sent = g))
  }
}
