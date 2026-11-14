import type { Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'

/** The Hunt: who the fox is, how far ahead, the round clock and the points. */
export function makeHuntPanel(): GamePanel {
  const role = h('b', {})
  const gap = h('b', {})
  const left = h('b', {})
  const board = h('ol', { class: 'last-list' })
  const root = h(
    'section',
    { class: 'hud-glass am' },
    h('div', { class: 'bs-head' }, h('label', {}, '🦊 THE HUNT'), role),
    h('div', { class: 'bs-head' }, h('label', {}, 'FOX AHEAD'), gap),
    h('div', { class: 'bs-head' }, h('label', {}, 'ROUND ENDS IN'), left),
    board,
  )
  return {
    root,
    update(m: Tick, me: string) {
      const g = m.game as {
        fox: string | null
        gap: number
        pts: Record<string, number>
        left: number
        caught: boolean
      } | null
      if (!g) return
      const fox = g.fox ? (g.fox === me ? 'You' : (m.riders[g.fox]?.name ?? '?')) : '–'
      role.textContent = g.fox === me ? 'You are the fox: ride clean!' : `Fox: ${fox}`
      gap.textContent = g.caught ? 'Caught' : `${Math.round(g.gap)} m`
      left.textContent = `${Math.floor(g.left / 60)}:${String(g.left % 60).padStart(2, '0')}`
      board.replaceChildren(
        ...Object.keys(m.riders)
          .sort((a, b) => (g.pts[b] ?? 0) - (g.pts[a] ?? 0))
          .map((id) =>
            h(
              'li',
              {},
              `${id === g.fox ? '🦊' : '🐕'} ${id === me ? 'You' : (m.riders[id]?.name ?? id)} · ${g.pts[id] ?? 0}`,
            ),
          ),
      )
    },
    fx(fx, sp) {
      if (fx.k === 'fox') sp.splash('sp-smash', '🦊 NEW FOX', fx.text ?? '', 3000, 2)
      else if (fx.k === 'caught') sp.splash('sp-fell', '🐕 CAUGHT', fx.text ?? '', 3000, 3)
      else if (fx.k === 'escaped') sp.splash('sp-smash', '🦊 ESCAPED', fx.text ?? '', 3000, 3)
    },
  }
}
