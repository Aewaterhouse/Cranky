import type { RideRecorder } from '../core/ride'
import type { Plan, Tier } from '../types'

export interface HudOpts {
  plan?: Plan
  tier?: Tier
  rec?: RideRecorder
  meId?: string
  weightKg?: number
  /** What the End button says: the host ends the ride for everyone, anyone else leaves the bus. */
  quitLabel?: () => string
  /** A rider's input to a crew game: an answer to its question, an emoji, a card. */
  onAct?: (k: string, v: string) => void
  /** ERG switch: `erg` is the state to show; `slope(d)` steps the gradient when ERG is off and returns it. */
  /** ERG on or off; off, the rider shifts virtual gears (`tile` and `slider` are the gear tile and strength). */
  erg?: {
    on: () => boolean
    toggle: () => void
    shift: (d: number) => number
    strength: (d: number) => void
    tile: HTMLElement
    slider: HTMLElement
  }
}
