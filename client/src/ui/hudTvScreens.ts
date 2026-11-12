import type { Lobby } from '../net/protocol'
import { avatar, fmt, h, pctStr } from './dom'
import { GRADE_COLOUR } from './hudKit'
import type { GroupSummary } from './results'

const SEATS = 6

/** Lobby overlay for the TV: the code, the plan and the six bus seats. */
export function tvLobby(l: Lobby) {
  const host = l.riders.find((r) => r.id === l.host)
  const seats = Array.from({ length: SEATS }, (_, i) => {
    const r = l.riders[i]
    return r
      ? h(
          'div',
          { class: `tvl-seat${r.connected ? '' : ' away'}` },
          avatar(r.name, 'xl'),
          h('b', {}, r.name),
          h('small', {}, r.bot ? '🤖 bot' : r.id === l.host ? '🚌 driver' : r.tier),
        )
      : h(
          'div',
          { class: 'tvl-seat empty' },
          h('span', { class: 'ava xl' }, '?'),
          h('b', {}, 'Empty'),
        )
  })
  return h(
    'div',
    { class: 'tv-screen tvl' },
    h('h2', {}, 'Zombie Bus'),
    h('div', { class: 'tvl-code' }, 'Bus ', h('b', {}, l.code)),
    h(
      'p',
      { class: 'tvl-wait' },
      `Waiting for ${host ? `${host.name}, the driver,` : 'the driver'} to start`,
    ),
    h('p', { class: 'dim' }, l.plan.name),
    h('div', { class: 'tvl-seats' }, ...seats),
  )
}

const stat = (label: string, v: string) =>
  h('div', { class: 'tve-stat' }, h('small', {}, label), h('b', {}, v))

/** Full-screen group summary for the TV. Nothing personal and nothing saved. */
export function tvEnd(g: GroupSummary & { score: number }, onLeave: () => void) {
  return h(
    'div',
    { class: 'tv-screen tve' },
    h('h2', {}, 'Ride complete'),
    h(
      'div',
      { class: 'tve-score' },
      h('small', {}, 'BUS SCORE'),
      h('b', {}, g.score.toLocaleString()),
    ),
    h(
      'div',
      { class: 'tve-stats' },
      stat('DISTANCE', `${(g.distance / 1000).toFixed(1)} km`),
      stat('ARMOUR', String(Math.round(g.armour))),
      stat('SYNC', `${Math.round(g.syncPct)}%`),
      stat('SCRAP', String(g.scrap)),
    ),
    h(
      'div',
      { class: 'tve-cols' },
      h(
        'div',
        { class: 'tve-awards' },
        ...g.awards.map((a) =>
          h(
            'div',
            {},
            h('span', {}, '🏆'),
            h('b', {}, a.award),
            h('em', {}, a.name),
            h('small', {}, a.why),
          ),
        ),
      ),
      h(
        'table',
        {},
        h(
          'tr',
          {},
          ...['Rider', 'Compliance', 'In zone', 'Falls', 'Sprints'].map((x) => h('th', {}, x)),
        ),
        ...g.riders.map((r) =>
          h(
            'tr',
            {},
            h('td', {}, avatar(r.name, 'sm'), r.name),
            h('td', {}, pctStr(r.compliance)),
            h('td', {}, fmt(r.inBandSecs)),
            h('td', {}, String(r.falls)),
            h(
              'td',
              {},
              ...r.sprints.map((s) =>
                h(
                  'i',
                  { class: 'tvb-g', style: `--g:${GRADE_COLOUR[s as keyof typeof GRADE_COLOUR]}` },
                  s,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    h('button', { class: 'primary', onclick: onLeave }, 'Leave'),
  )
}
