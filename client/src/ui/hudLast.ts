import type { Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'
import type { EventStyle } from './hudKit'

/** Last Rider Standing's events: a rider out, and the winner. */
export const LAST_EVENTS: Record<string, EventStyle> = {}

/** Who is still standing, who is out (in the order they went), and the step everyone is on. */
export function makeLastPanel(): GamePanel {
  const step = h('b', {})
  const list = h('ol', { class: 'last-list' })
  const root = h(
    'section',
    { class: 'hud-glass am' },
    h('div', { class: 'bs-head' }, h('label', {}, '🏁 LAST RIDER STANDING'), step),
    list,
  )
  return {
    root,
    update(m: Tick, me: string) {
      const g = m.game as {
        standing: string[]
        out: string[]
        winner: string | null
        step?: number
      } | null
      if (!g) return
      step.textContent = g.winner ? 'Victory lap' : g.step ? `${g.step}% FTP` : ''
      const name = (id: string) => (id === me ? 'You' : (m.riders[id]?.name ?? id))
      list.replaceChildren(
        ...g.standing.map((id) =>
          h(
            'li',
            { class: id === g.winner ? 'win' : '' },
            `${id === g.winner ? '🏆' : '🚴'} ${name(id)}`,
          ),
        ),
        ...[...g.out].reverse().map((id) => h('li', { class: 'out' }, `❌ ${name(id)}`)),
      )
    },
    fx(fx, sp) {
      if (fx.k === 'winner') sp.splash('sp-smash', '🏆 LAST RIDER STANDING', fx.text ?? '', 4000, 3)
      else if (fx.k === 'out') sp.splash('sp-fell', 'OUT', fx.text ?? '', 2200, 2)
    },
  }
}
