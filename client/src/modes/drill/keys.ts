import { type ActionId, actionOf } from '../../core/keys'
import { onClickShift } from '../../trainer/zwiftClick'
import type { RideMode } from '../../ui/soloMode'
import type { SoloPart } from '../../ui/soloView'

export interface KeyActions {
  pause: () => void
  skip: () => void
  end: () => void
  /** Intensity step: +0.01 or -0.01. */
  bump: (d: number) => void
  mode: (k: RideMode) => void
  /** Level or gradient step: +1 or -1. */
  step: (d: number) => void
  /** Virtual gear: +1 (harder) or -1 (easier). */
  gear: (d: number) => void
  /** Shift strength step: +1 or -1. */
  strength: (d: number) => void
  /** Clean view, stats or the interval list. */
  toggle: (part: SoloPart) => void
}

/** Keyboard handler for the solo player, from the rider's keys (Settings → Controls). */
export function soloKeys(on: KeyActions) {
  const acts: Partial<Record<ActionId, () => void>> = {
    pause: on.pause,
    skip: on.skip,
    end: on.end,
    intensityUp: () => on.bump(0.01),
    intensityDown: () => on.bump(-0.01),
    levelUp: () => on.step(1),
    levelDown: () => on.step(-1),
    gearUp: () => on.gear(1),
    gearDown: () => on.gear(-1),
    strengthUp: () => on.strength(1),
    strengthDown: () => on.strength(-1),
    erg: () => on.mode('erg'),
    modeRes: () => on.mode('res'),
    modeSlope: () => on.mode('slope'),
    clean: () => on.toggle('clean'),
    stats: () => on.toggle('stats'),
    intervals: () => on.toggle('riders'),
  }
  return (e: KeyboardEvent) => {
    const id = actionOf(e, 'solo')
    const act = id && acts[id]
    if (!act) return
    act()
    e.preventDefault()
  }
}

/** Zwift Click in the solo player: gears in slope mode, intensity in ERG, level in resistance. Returns the unsubscribe. */
export const soloClick = (on: KeyActions, kind: () => RideMode) =>
  onClickShift((d) =>
    kind() === 'slope' ? on.gear(d) : kind() === 'erg' ? on.bump(d / 100) : on.step(d),
  )
