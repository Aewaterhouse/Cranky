import { GAMES } from '../modes/crew/games'
import type { Game } from '../net/protocol'
import { api } from '../core/api'
import { avatar, h, pctStr } from './dom'

interface Ladder {
  season: string
  runs: {
    date: string
    plan: string
    score: number
    difficulty: string
    distance: number
    crew: string[]
  }[]
  riders: { name: string; rides: number; best: number; compliance: number; awards: number }[]
  titles: { title: string; award: string; name: string; count: number }[]
  /** Every crew game: each rider's rides (by game) and awards this season. */
  games?: { name: string; rides: number; awards: number; by: Record<string, number> }[]
}

const prev = (s: string) => {
  const [y, q] = [+s.slice(0, 4), +s.slice(-1)]
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`
}
const label = (s: string) =>
  `${['Summer', 'Autumn', 'Winter', 'Spring'][+s.slice(-1) - 1]} ${s.slice(0, 4)}`

/** Season ladder: the crew's best Zombie Bus runs, per-rider standings and titles. */
export function ladderTab() {
  const body = h('div', {})
  const picker = h('div', { class: 'chips' })
  let current = ''
  const load = async (season?: string) => {
    const l = await api<Ladder>(`/api/ladder${season ? `?season=${season}` : ''}`).catch(() => null)
    if (!l) return body.replaceChildren(h('p', { class: 'dim' }, 'No game server, no ladder.'))
    current ||= l.season
    picker.replaceChildren(
      ...[current, prev(current), prev(prev(current))].map((s) =>
        h(
          'button',
          { class: `chip-sel${s === l.season ? ' on' : ''}`, onclick: () => load(s) },
          label(s),
        ),
      ),
    )
    if (!l.runs.length && !l.games?.length)
      return body.replaceChildren(
        h(
          'div',
          { class: 'card empty' },
          h('b', {}, 'Nothing on the ladder this season yet'),
          h('p', { class: 'dim' }, 'Finish any crew game and it lands here.'),
        ),
      )
    const table = (head: string[], rows: (string | number | Node)[][]) =>
      h(
        'table',
        {},
        h('tr', {}, ...head.map((x) => h('th', {}, x))),
        ...rows.map((r) =>
          h('tr', {}, ...r.map((x) => h('td', {}, x instanceof Node ? x : String(x)))),
        ),
      )
    body.replaceChildren(
      l.titles.length
        ? h(
            'div',
            { class: 'ladder-titles' },
            ...l.titles.map((t) =>
              h(
                'div',
                { class: 'card' },
                avatar(t.name),
                h(
                  'div',
                  {},
                  h('b', {}, t.title),
                  h('p', { class: 'dim' }, `${t.name} · ${t.award} ×${t.count}`),
                ),
              ),
            ),
          )
        : '',
      l.games?.length
        ? h(
            'section',
            { class: 'card' },
            h('h2', { class: 'label' }, 'Every game'),
            table(
              ['#', 'Rider', 'Rides', 'Awards', 'Games'],
              l.games.map((r, i) => [
                i + 1,
                h('span', { class: 'ladder-who' }, avatar(r.name, 'sm'), ` ${r.name}`),
                r.rides,
                r.awards,
                Object.entries(r.by)
                  .map(([g, n]) => `${GAMES[g as Game]?.icon ?? '🎲'} ${n}`)
                  .join('  '),
              ]),
            ),
          )
        : '',
      h(
        'section',
        { class: 'card', hidden: !l.runs.length },
        h('h2', { class: 'label' }, 'Zombie Bus standings'),
        table(
          ['#', 'Rider', 'Best score', 'Rides', 'Avg compliance', 'Awards'],
          l.riders.map((r, i) => [
            i + 1,
            h('span', { class: 'ladder-who' }, avatar(r.name, 'sm'), ` ${r.name}`),
            r.best.toLocaleString(),
            r.rides,
            pctStr(r.compliance),
            r.awards,
          ]),
        ),
      ),
      h(
        'section',
        { class: 'card', hidden: !l.runs.length },
        h('h2', { class: 'label' }, 'Top bus runs'),
        table(
          ['#', 'Score', 'Run', 'Horde', 'Distance', 'Crew', 'Date'],
          l.runs.map((r, i) => [
            i + 1,
            h('b', {}, r.score.toLocaleString()),
            r.plan,
            r.difficulty,
            `${(r.distance / 1000).toFixed(1)} km`,
            r.crew.join(', '),
            r.date,
          ]),
        ),
      ),
    )
  }
  void load()
  return h(
    'div',
    { class: 'ladder' },
    h('h1', {}, 'Season ladder'),
    h(
      'p',
      { class: 'lede' },
      'Every crew game this season, and the best Zombie Bus runs. It resets every quarter.',
    ),
    picker,
    body,
  )
}
