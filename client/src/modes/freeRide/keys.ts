import { type ActionId, actionOf } from '../../core/keys'
import type { FreePart } from '../../ui/freeRideView'

export interface FreeKeyActions {
  pause(): void
  end(): void
  /** Trainer difficulty up or down by this much. */
  nudge(d: number): void
  /** Virtual gear up (1) or down (-1). */
  shift(d: number): void
  /** Shift strength down (-1) or up (1) a step. */
  strength(d: number): void
  toggle(part: FreePart): void
  /** The next camera view. */
  camera(): void
}

/** The free-ride key handler, from the rider's keys (Settings → Controls). */
export const freeKeys = (on: FreeKeyActions) => {
  const acts: Partial<Record<ActionId, () => void>> = {
    pause: on.pause,
    end: on.end,
    intensityUp: () => on.nudge(0.05),
    intensityDown: () => on.nudge(-0.05),
    gearUp: () => on.shift(1),
    gearDown: () => on.shift(-1),
    strengthUp: () => on.strength(1),
    strengthDown: () => on.strength(-1),
    camera: on.camera,
    clean: () => on.toggle('clean'),
    stats: () => on.toggle('stats'),
    map: () => on.toggle('map'),
    riders: () => on.toggle('riders'),
  }
  return (e: KeyboardEvent) => {
    const id = actionOf(e, 'free')
    const act = id && acts[id]
    if (!act) return
    act()
    e.preventDefault()
  }
}
