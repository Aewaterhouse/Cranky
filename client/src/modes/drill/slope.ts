import { CFG } from '../../config'
import { gearGrade } from '../../core/gears'
import { settings } from '../../core/settings'
import type { ErgController } from '../../trainer/ergController'
import { gearTile, strengthSlider } from '../../ui/gearTile'
import type { ModeState } from '../../ui/soloMode'

/**
 * Slope mode with virtual gears. Adds the gear tile and shift strength slider to the solo player (shown
 * only in slope mode) and sends the gear-adjusted gradient when it moves by more than the free-ride step.
 */
export function slopeGears(erg: ErgController, mass: number, root: HTMLElement) {
  let sent = NaN
  const tile = gearTile()
  const slider = strengthSlider()
  // The shared ride HUD has no tile row, so both sit with the mode switch there.
  const sw = root.querySelector('.modesw')
  sw?.after(slider)
  ;(root.querySelector('.bigrow')?.children[2] ?? sw)?.after(tile.el)
  const send = (m: ModeState, cadence: number, force = false) => {
    const { chainring, shiftStrength } = settings
    const g = gearGrade(m.grade, cadence, m.gear, mass, CFG.ride.grade, chainring, 1, shiftStrength)
    if (force || Math.abs(g - sent) > CFG.freeRide.sendDeltaPct) erg.setGrade((sent = g))
  }
  return {
    send,
    /** Every tick: resend if needed and refresh the tile. */
    frame(m: ModeState, cadence: number) {
      const on = m.kind === 'slope'
      root.classList.toggle('slope', on)
      tile.el.hidden = slider.hidden = !on
      if (!on) return
      send(m, cadence)
      tile.set(m.gear, sent)
    },
  }
}
