import type { AmboState, DateState, Game, Tick } from '../../net/protocol'
import { TownWorld } from '../../scene/town/townWorld'
import type { SceneState, World } from '../../scene/world'
import type { GamePanel } from '../../ui/hud'
import { AMBO_EVENTS, makeAmboPanel } from '../../ui/hudAmbo'
import { CLIMATE_EVENTS, makeClimatePanel } from '../../ui/hudClimate'
import { DATE_EVENTS, makeDatePanel } from '../../ui/hudDate'
import type { EventStyle } from '../../ui/hudKit'

/** What the ride and TV screens need from a crew game newer than VO2 Madness: its panel, names and scene. */
export interface GameUi {
  events: Record<string, EventStyle>
  /** Builds the panel; `act` sends the rider's input (an emoji, a card) to the game. */
  panel: (act: (k: string, v: string) => void) => GamePanel
  /** Scene state the game sets over the bus's own. */
  scene: (m: Tick) => Partial<SceneState>
  /** The game's own 3D scene in place of the road, when it has one. */
  world?: (stage: HTMLElement) => Stage
}
/** What the ride and TV screens ask of a scene. */
export type Stage = Pick<World, 'fx' | 'cycleView' | 'dispose' | 'snapshot'> & { state: SceneState }

export const GAME_UI: Partial<Record<Game, GameUi>> = {
  ambo: {
    events: AMBO_EVENTS,
    panel: makeAmboPanel,
    scene: (m) => {
      const g = m.game as AmboState | null | undefined
      const mood = g?.event ? 'surge' : g?.phase === 'run' ? 'longhaul' : 'drill'
      const dist = g?.phase === 'run' ? g.dist : g?.phase === 'ramp' ? 0 : null
      const ambo = { siren: !!g?.siren, dist, fell: g?.phase === 'reverse' }
      return { gap: null, armour: null, roadblock: null, mood, ambo }
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
  climate: {
    events: CLIMATE_EVENTS,
    panel: makeClimatePanel,
    scene: (m) => ({ game: m.game }),
    world: (stage) => new TownWorld(stage),
  },
}
