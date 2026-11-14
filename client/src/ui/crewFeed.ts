import { api } from '../core/api'
import { GAMES } from '../modes/crew/games'
import type { Game } from '../net/protocol'
import { avatar, h } from './dom'

interface FeedRow {
  n: number
  rider: string
  name: string
  date: string
  plan: string | null
  secs: number | null
  game: Game | null
  score: number | null
  kudos: number
  prs: number | null
  mine: boolean
}

const ago = (date: string) => {
  const m = Math.round((Date.now() - Date.parse(date)) / 60000)
  return m < 60
    ? `${Math.max(1, m)} min ago`
    : m < 1440
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} d ago`
}

/** Home's crew feed: the latest rides by everyone, each with a 👏 for kudos (once, and not on your own). */
export function crewFeed(me: string) {
  const list = h('div', { class: 'feed' })
  const root = h(
    'section',
    { class: 'panel', hidden: true },
    h('h2', { class: 'label' }, 'Crew feed'),
    list,
  )
  const row = (r: FeedRow) => {
    const btn = h(
      'button',
      {
        class: `ghost kudos${r.mine ? ' on' : ''}`,
        disabled: r.mine || r.rider === me,
        title: r.rider === me ? 'Your ride' : 'Give kudos',
        onclick: () =>
          api<{ given: boolean }>(`/api/kudos/${r.n}`, { method: 'POST' }).then((x) => {
            if (!x.given) return
            r.kudos++
            r.mine = true
            btn.replaceWith(row(r).lastElementChild!)
          }),
      },
      `👏 ${r.kudos || ''}`,
    )
    const what =
      r.game && GAMES[r.game] ? `${GAMES[r.game].icon} ${GAMES[r.game].name}` : (r.plan ?? 'a ride')
    return h(
      'div',
      { class: 'feed-row' },
      avatar(r.name, 'sm'),
      h(
        'span',
        {},
        h('b', {}, r.rider === me ? 'You' : r.name),
        ` rode ${what}`,
        r.prs ? h('span', { class: 'feed-pr' }, ` 🏅 ${r.prs} new PR${r.prs > 1 ? 's' : ''}`) : '',
        h(
          'small',
          { class: 'dim' },
          ` · ${r.secs ? `${Math.round(r.secs / 60)} min · ` : ''}${ago(r.date)}`,
        ),
      ),
      btn,
    )
  }
  api<FeedRow[]>('/api/feed')
    .then((rows) => {
      list.replaceChildren(...rows.slice(0, 8).map(row))
      root.hidden = !rows.length
    })
    .catch(() => {})
  return root
}
