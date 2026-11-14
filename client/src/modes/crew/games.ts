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
  ambo: {
    icon: '🚑',
    name: 'Kidney Stone Express',
    blurb:
      'Crew an ambulance across South East Queensland. Five patients, each one a different interval. Team power is your speed; smooth power keeps them comfortable. No ERG. 40 min.',
    start: 'Start the shift',
    countdown: 'SHIFT STARTS IN',
    score: 'Shift score',
    plan: false,
  },
  date: {
    icon: '💘',
    name: 'Speed Dating',
    blurb:
      'Six dates in rotating pairs. Match your date’s effort as closely as you can, with only emoji to talk. Odd one out is the Chaperone. Ends in a wedding and a divorce. No ERG. 40 min.',
    start: 'Open the bar',
    countdown: 'THE BAR OPENS IN',
    score: 'Chemistry',
    plan: false,
  },
}
