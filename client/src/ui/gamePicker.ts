import { GAMES } from '../modes/crew/games'
import type { Game } from '../net/protocol'
import { h } from './dom'

/** Every crew game as a row of cards on the home screen; a tap opens a new room set to that game. */
export function gamePicker(start: (g: Game) => void) {
  const ids = (Object.keys(GAMES) as Game[]).filter((g) => !GAMES[g].soon)
  return h(
    'div',
    { class: 'home-games' },
    ...ids.map((g) =>
      h(
        'button',
        { class: 'home-game', onclick: () => start(g) },
        h('span', { class: 'gc-icon' }, GAMES[g].icon),
        h('b', {}, GAMES[g].name),
        h('small', {}, GAMES[g].tag),
      ),
    ),
  )
}
