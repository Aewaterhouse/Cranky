import { ordinal } from '../modes/freeRide/roadLink'
import type { RoadLobby, RoadSummary } from '../net/protocol'
import { avatar, clock, h } from './dom'

const km = (m: number) => `${(m / 1000).toFixed(1)} km`
const lapsText = (n: number) => (n > 1 ? ` · ${n} laps` : '')

/** The crew table for a road ride: place, time (or how far they got), average power, W/kg and watts saved drafting. */
export function roadTable(g: RoadSummary, myId = '', faces = false) {
  const head = ['', 'Rider', 'Time', 'Avg power', 'W/kg', 'Draft saved']
  return h(
    'table',
    { class: 'road-table' },
    h('tr', {}, ...head.map((x) => h('th', {}, x))),
    ...g.riders.map((r) =>
      h(
        'tr',
        { class: r.id === myId ? 'me' : '' },
        h('td', {}, r.time == null ? '–' : ordinal(r.place)),
        h('td', {}, faces ? avatar(r.name, 'sm') : '', r.name, r.bot ? ' 🤖' : ''),
        h(
          'td',
          {},
          r.time == null ? `${km(r.dist)} ridden` : clock(r.time),
          r.late ? h('small', {}, ' joined late') : '',
        ),
        h('td', {}, `${r.avgPower} W`),
        h('td', {}, r.wkg.toFixed(2)),
        h('td', {}, r.saved ? `${r.saved} W` : '–'),
      ),
    ),
  )
}

/** Group-ride extras for the results screen. */
export function roadSection(g: RoadSummary, myId: string) {
  const mine = g.riders.find((r) => r.id === myId)
  const placed = mine?.time != null && !mine.late
  return h(
    'div',
    { class: 'res-group' },
    h(
      'div',
      { class: 'card' },
      h('h2', {}, placed ? `You finished ${ordinal(mine.place)}` : 'The group'),
      h(
        'p',
        { class: 'dim' },
        `${g.name}${lapsText(g.laps)} · ${km(g.distance)} · ${g.style === 'race' ? 'race' : 'social ride'}${g.together ? ' · kept together' : ''}`,
      ),
      roadTable(g, myId),
    ),
  )
}

/** TV lobby overlay for a road room. */
export function roadTvLobby(l: RoadLobby, routeName: string) {
  const host = l.riders.find((r) => r.id === l.host)
  return h(
    'div',
    { class: 'tv-screen tvl' },
    h('h2', {}, 'Group ride'),
    h('div', { class: 'tvl-code' }, 'Code ', h('b', {}, l.code)),
    h('p', { class: 'tvl-wait' }, `Waiting for ${host?.name ?? 'the host'} to start`),
    h('p', { class: 'dim' }, `${routeName}${lapsText(l.laps)} · ${km(l.distance)}`),
    h(
      'div',
      { class: 'tvl-seats' },
      ...l.riders.map((r) =>
        h(
          'div',
          { class: `tvl-seat${r.connected ? '' : ' away'}` },
          avatar(r.name, 'xl'),
          h('b', {}, r.name),
          h('small', {}, r.bot ? '🤖 bot' : r.id === l.host ? 'host' : `${r.ftp} W`),
        ),
      ),
    ),
  )
}

/** TV results for a road ride. */
export function roadTvEnd(g: RoadSummary, onLeave: () => void) {
  return h(
    'div',
    { class: 'tv-screen tve' },
    h('h2', {}, 'Ride complete'),
    h('p', { class: 'dim' }, `${g.name}${lapsText(g.laps)} · ${km(g.distance)} · ${clock(g.secs)}`),
    roadTable(g, '', true),
    h('button', { class: 'primary', onclick: onLeave }, 'Leave'),
  )
}
