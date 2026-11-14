import type { RideRecorder } from '../core/ride'
import type { Fx, Game, ShopItem, Tick } from '../net/protocol'
import type { Plan, Tier } from '../types'
import type { EventStyle } from './hudKit'
import type { makeSplash } from './hudSplash'

export interface HudOpts {
  plan?: Plan
  tier?: Tier
  rec?: RideRecorder
  meId?: string
  weightKg?: number
  /** What the End button says: the host ends the ride for everyone, anyone else leaves the bus. */
  quitLabel?: () => string
  onBuy?: (item: ShopItem) => void
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
  /** VO2 Madness: the interval names in the deck. Swaps the bus panel for the effort board. */
  mad?: string[]
  /** A newer crew game: its id, its panel in place of the bus's and its names for the block events. */
  game?: Game
  panel?: GamePanel
  events?: Record<string, EventStyle>
}
/** A crew game's own HUD panel, fed the whole tick (its state is `tick.game`) and each fx. */
export interface GamePanel {
  root: HTMLElement
  update(m: Tick, meId: string): void
  fx?(fx: Fx, sp: ReturnType<typeof makeSplash>): void
}
