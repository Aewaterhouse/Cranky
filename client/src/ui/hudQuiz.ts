import type { Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'

/** Pub Quiz: the leaderboard and which question the night is up to. The question itself is the choice sheet. */
export function makeQuizPanel(): GamePanel {
  const n = h('b', {})
  const board = h('ol', { class: 'last-list' })
  const root = h(
    'section',
    { class: 'hud-glass am' },
    h('div', { class: 'bs-head' }, h('label', {}, '🍺 PUB QUIZ'), n),
    board,
  )
  return {
    root,
    update(m: Tick, me: string) {
      const g = m.game as { pts: Record<string, number>; n: number } | null
      if (!g?.pts) return
      n.textContent = g.n ? `Question ${g.n}` : 'First question soon'
      board.replaceChildren(
        ...Object.keys(m.riders)
          .sort((a, b) => (g.pts[b] ?? 0) - (g.pts[a] ?? 0))
          .map((id) =>
            h('li', {}, `${id === me ? 'You' : (m.riders[id]?.name ?? id)} · ${g.pts[id] ?? 0}`),
          ),
      )
    },
    fx(fx, sp) {
      if (fx.k === 'quiz') sp.splash('sp-smash', '🍺 QUESTION', fx.text ?? '', 3000, 2)
      else if (fx.k === 'answer') sp.splash('sp-smash', 'THE ANSWER', fx.text ?? '', 3500, 2)
    },
  }
}
