import type { AmboState, DateState, Game, Tick } from '../../net/protocol'
import type { SceneState } from '../../scene/world'
import type { GamePanel } from '../../ui/hud'
import { AMBO_EVENTS, makeAmboPanel } from '../../ui/hudAmbo'
import { DATE_EVENTS, makeDatePanel } from '../../ui/hudDate'
import type { EventStyle } from '../../ui/hudKit'

/** What the ride and TV screens need from a crew game newer than VO2 Madness: its panel, names and scene. */
export interface GameUi {
  events: Record<string, EventStyle>
  /** Builds the panel; `act` sends the rider's input (an emoji, a card) to the game. */
  panel: (act: (k: string, v: string) => void) => GamePanel
  /** Scene state the game sets over the bus's own. */
  scene: (m: Tick) => Partial<SceneState>
}

export const GAME_UI: Partial<Record<Game, GameUi>> = {
  ambo: {
    events: AMBO_EVENTS,
    panel: makeAmboPanel,
    scene: (m) => {
      const g = m.game as AmboState | null | undefined
      const mood = g?.event ? 'surge' : g?.phase === 'run' ? 'longhaul' : 'drill'
      return { gap: null, armour: null, roadblock: null, mood, ambo: { siren: !!g?.siren } }
    },
  },
  date: {
    events: DATE_EVENTS,
    panel: makeDatePanel,
    scene: (m) => {
      const g = m.game as unknown as DateState | null | undefined
      const pairs = (g?.pairs ?? []).map((p) => [p[0], p[1], p[2]] as [string, string, number])
      const mad = { pts: {}, crown: null, lead: null, work: g?.phase === 'date', pairs }
      return { gap: null, armour: null, roadblock: null, mood: 'longhaul', mad }
    },
  },
}
