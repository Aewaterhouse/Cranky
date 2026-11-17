import type { Game } from '../../net/protocol'

/** What the crew screens (lobby, HUD, results) say about the game. */
export interface GameInfo {
  icon: string
  name: string
  /** A few words for the home screen's card. */
  tag: string
  blurb: string
  start: string
  /** Three short lines on how to play, shown during the countdown. */
  how: [string, string, string]
  countdown: string
  score: string
}

export const GAMES: Record<Game, GameInfo> = {
  bus: {
    icon: '🧟',
    name: 'Zombie Bus',
    how: [
      "Hold your target: the crew's power drives the bus.",
      'Fall short for too long and you fall off. Ride hard to haul mates back.',
      'Roadblocks are all-out sprints. Smash them together.',
    ],
    tag: 'Outrun the horde',
    blurb: 'Hold your targets to keep the bus ahead of the horde.',
    start: 'Start the bus',
    countdown: 'BUS LEAVES IN',
    score: 'Bus score',
  },
}

/** Crew games that have gone (icon, name), so old rides and scheduled rides still show what they were. */
const GONE: Record<string, [string, string]> = {
  madness: ['🤯', 'VO2 Madness'],
  ambo: ['🚑', 'Kidney Stone Express'],
  date: ['💘', 'Speed Dating'],
  climate: ['🌊', 'Climate Lawsuit'],
  watch: ['📺', 'Watch Party'],
  last: ['🏁', 'Last Rider Standing'],
  ttt: ['⏱', 'Team Time Trial'],
  quiz: ['🍺', 'Pub Quiz'],
  galley: ['🛶', 'Galley Ship'],
  hunt: ['🦊', 'The Hunt'],
}

/** A crew game's icon, name and score label by id, the bus or one that has gone; undefined for anything else. */
export function gameOf(id?: string | null): Pick<GameInfo, 'icon' | 'name' | 'score'> | undefined {
  if (id === 'bus') return GAMES.bus
  const gone = id ? GONE[id] : undefined
  return gone && { icon: gone[0], name: gone[1], score: 'Score' }
}

/** " 🧟 Zombie Bus · Bus score 1,234" for a list row; empty when the ride was not a crew game. */
export function gameLabel(id?: string | null, score?: number | null) {
  const g = gameOf(id)
  if (!g) return ''
  return ` ${g.icon} ${g.name}${score != null ? ` · ${g.score} ${Math.round(score).toLocaleString()}` : ''}`
}
