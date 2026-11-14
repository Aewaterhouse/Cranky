import { GAMES } from './games'
import type { Game } from '../../net/protocol'
import { h } from '../../ui/dom'

/** The game's three rules on a card during the countdown; it goes when the ride starts. */
export function howTo(game: Game) {
  const g = GAMES[game]
  const el = h(
    'div',
    { class: 'howto hud-glass' },
    h('b', {}, `${g.icon} How ${g.name} works`),
    h('ol', {}, ...g.how.map((l) => h('li', {}, l))),
  )
  return { el, show: (on: boolean) => (el.hidden = !on) }
}
