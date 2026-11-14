import { ordinal } from '../modes/freeRide/roadLink'
import type { RoadLobby, RoadSummary } from '../net/protocol'
import '../moment.css'
import { avatar, clock, h } from './dom'
import { UNIT } from './units'

const km = (m: number) => UNIT.dist(m)
const lapsText = (n: number) => (n > 1 ? ` · ${n} laps` : '')
const GAME_NAME = { ride: 'social ride', race: 'race', points: 'points race', crit: 'crit' }

/** The crew table for a road ride: place, time (or how far they got), average power, W/kg and watts saved drafting. */
export function roadTable(g: RoadSummary, myId = '', faces = false) {
  const pts = g.game === 'points'
  const head = ['', 'Rider', ...(pts ? ['Points'] : []), 'Time', 'Avg power', 'W/kg', 'Draft saved']
  return h(
    'table',
    { class: 'road-table' },
    h('tr', {}, ...head.map((x) => h('th', {}, x))),
    ...g.riders.map((r) =>
      h(
        'tr',
        { class: r.id === myId ? 'me' : '' },
        h('td', {}, r.time == null ? '–' : ordinal(r.place)),
        h(
          'td',
          {},
          faces ? avatar(r.name, 'sm') : '',
          r.name,
          r.bot ? ' 🤖' : '',
          r.prime ? ' ★' : '',
        ),
        pts ? h('td', {}, h('b', {}, String(r.pts ?? 0))) : '',
        h(
          'td',
          {},
          r.time == null ? `${km(r.dist)} ridden` : clock(r.time),
          r.gap ? h('small', {}, ` +${clock(r.gap)}`) : '',
          r.late ? h('small', {}, ' joined late') : '',
        ),
        h('td', {}, `${r.avgPower} W`),
        h('td', {}, r.wkg.toFixed(2)),
        h('td', {}, r.saved ? `${r.saved} W` : '–'),
      ),
    ),
  )
}

/** The first three home on a podium (second, first, third); nothing when nobody finished. */
export function podium(g: RoadSummary, myId = '') {
  const top = g.riders
    .filter((r) => r.time != null && r.place <= 3)
    .sort((a, b) => a.place - b.place)
  if (!top.length) return ''
  const step = (r: (typeof top)[number]) =>
    h(
      'div',
      { class: `step p${r.place}${r.id === myId ? ' me' : ''}` },
      avatar(r.name),
      h('b', {}, r.name),
      h('small', {}, clock(r.time!)),
      h('div', { class: 'block' }, String(r.place)),
    )
  return h('div', { class: 'podium' }, ...[top[1], top[0], top[2]].filter(Boolean).map(step))
}

/** The points or prime winner's own line, the hero of a crit whatever the finish. */
function award(g: RoadSummary, myId: string) {
  const r = g.award && g.riders.find((x) => x.id === g.award!.id)
  if (!r) return ''
  const who = r.id === myId ? 'You' : r.name
  const what =
    g.award!.kind === 'prime' ? `★ ${who} won the prime` : `🏅 ${who} won on points (${r.pts})`
  return h('p', { class: 'race-award' }, what)
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
        `${g.name}${lapsText(g.laps)} · ${km(g.distance)} · ${g.game && g.game !== 'ride' ? GAME_NAME[g.game] : g.style === 'race' ? 'race' : 'social ride'}${g.together ? ' · kept together' : ''}`,
      ),
      podium(g, myId),
      award(g, myId),
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
