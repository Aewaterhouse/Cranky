import { GAMES } from './games'
import { h } from '../../ui/dom'

/** The bus's three rules on a card during the countdown; it goes when the ride starts. */
export function howTo() {
  const g = GAMES.bus
  const el = h(
    'div',
    { class: 'howto hud-glass' },
    h('b', {}, `${g.icon} How ${g.name} works`),
    h('ol', {}, ...g.how.map((l) => h('li', {}, l))),
  )
  return { el, show: (on: boolean) => (el.hidden = !on) }
}
