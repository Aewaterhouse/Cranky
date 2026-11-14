import type { Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'

/** Team Time Trial: both teams' on-target score so far, and which team you ride for. */
export function makeTttPanel(): GamePanel {
  const mine = h('b', {})
  const bars = h('div', { class: 'ttt-bars' })
  const root = h(
    'section',
    { class: 'hud-glass am' },
    h('div', { class: 'bs-head' }, h('label', {}, '⏱ TEAM TIME TRIAL'), mine),
    bars,
  )
  return {
    root,
    update(m: Tick, me: string) {
      const g = m.game as { teams: string[]; team: Record<string, number>; scores: number[] } | null
      if (!g?.teams) return
      mine.textContent = me in g.team ? `You: ${g.teams[g.team[me]]}` : ''
      bars.replaceChildren(
        ...g.teams.map((t, k) =>
          h(
            'div',
            { class: `ttt-row t${k}` },
            h('span', {}, t),
            h(
              'div',
              { class: 'bs-bar' },
              h('i', { style: `width:${Math.round(g.scores[k] * 100)}%` }),
            ),
            h('b', {}, `${Math.round(g.scores[k] * 100)}%`),
          ),
        ),
      )
    },
  }
}
