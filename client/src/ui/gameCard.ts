import { GAMES } from '../modes/crew/games'
import type { Game } from '../net/protocol'
import { h } from './dom'

/** One game in the lobby's picker: icon, name and blurb. Only the host can pick, and only a finished game. */
export const gameCard = (g: Game, on: boolean, pick: boolean, choose: (g: Game) => void) =>
  h(
    'button',
    {
      class: `game-card${on ? ' on' : ''}`,
      disabled: !pick || !!GAMES[g].soon,
      onclick: () => choose(g),
    },
    h('span', { class: 'gc-icon' }, GAMES[g].icon),
    h('b', {}, GAMES[g].name),
    h('small', {}, GAMES[g].soon ? 'Coming soon' : GAMES[g].blurb),
  )
