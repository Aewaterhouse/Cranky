import { GAMES } from '../modes/crew/games'
import type { Game } from '../net/protocol'
import { h } from './dom'

/** The crew games in three shelves, so eleven cards read as a menu, not a wall. */
export const SHELVES: [string, Game[]][] = [
  ['Chase games', ['bus', 'ambo', 'galley', 'hunt']],
  ['Party games', ['date', 'climate', 'quiz', 'watch']],
  ['Hard efforts', ['madness', 'last', 'ttt']],
]

/** Every crew game as cards on the home screen, by shelf; a tap opens a new room set to that game. */
export function gamePicker(start: (g: Game) => void) {
  const card = (g: Game) =>
    h(
      'button',
      { class: 'home-game', onclick: () => start(g) },
      h('span', { class: 'gc-icon' }, GAMES[g].icon),
      h('b', {}, GAMES[g].name),
      h('small', {}, GAMES[g].tag),
    )
  return h(
    'div',
    { class: 'game-shelves' },
    ...SHELVES.map(([name, ids]) =>
      h(
        'div',
        {},
        h('h3', { class: 'label shelf-name' }, name),
        h('div', { class: 'home-games' }, ...ids.filter((g) => !GAMES[g].soon).map(card)),
      ),
    ),
  )
}
