import type { AmboState, Game, Tick } from '../../net/protocol'
import type { SceneState } from '../../scene/world'
import type { GamePanel } from '../../ui/hud'
import { AMBO_EVENTS, makeAmboPanel } from '../../ui/hudAmbo'
import type { EventStyle } from '../../ui/hudKit'

/** What the ride and TV screens need from a crew game newer than VO2 Madness: its panel, names and scene. */
export interface GameUi {
  events: Record<string, EventStyle>
  panel: () => GamePanel
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
}
