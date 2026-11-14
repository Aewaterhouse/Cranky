import type { Game } from '../../net/protocol'

/** What the shared crew screens (lobby, HUD, results) need to know about each game. */
export interface GameInfo {
  icon: string
  name: string
  blurb: string
  start: string
  countdown: string
  score: string
  /** The host picks a workout and a difficulty; false when the game deals its own session. */
  plan: boolean
}

export const GAMES: Record<Game, GameInfo> = {
  bus: {
    icon: '🧟',
    name: 'Zombie Bus',
    blurb: 'Hold your targets to keep the bus ahead of the horde.',
    start: 'Start the bus',
    countdown: 'BUS LEAVES IN',
    score: 'Bus score',
    plan: true,
  },
  madness: {
    icon: '🤯',
    name: 'VO2 Madness',
    blurb:
      'Warm-up, then mystery rounds: recover, the box opens, and the whole pack gets the same VO2 interval. Points for heart-rate effort. Set your max heart rate first.',
    start: 'Start the madness',
    countdown: 'MADNESS STARTS IN',
    score: 'Pack effort points',
    plan: false,
  },
}
