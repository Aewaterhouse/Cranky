import '../leaderboards.css'
import { api } from '../core/api'
import type { CrewRow } from '../core/efforts'
import { boardRows, leaderLine, rankText, type BoardBy } from '../core/leaderboard'
import { ROUTE_INDEX, loadRoute } from '../core/routeLibrary'
import { routeSegments, segClock, type Segment } from '../core/segments'
import { h, seg } from './dom'
import { modal } from './toast'

const day = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '–'

/** One segment's board: the leader's line, my rank and the table with my row marked. */
function board(rows: CrewRow[], me: string, by: BoardBy) {
  const ranked = boardRows(rows, me, by)
  if (!ranked.length)
    return h('p', { class: 'dim' }, 'Nobody has a time here yet. It is yours for the taking.')
  return h(
    'div',
    {},
    h('p', { class: 'lb-line' }, leaderLine(ranked[0], ranked.length === 1)),
    h('p', { class: 'lb-rank' }, rankText(ranked)),
    h(
      'table',
      { class: 'lb-table' },
      h('tr', {}, ...['', 'Rider', 'Time', 'Avg', 'W/kg', 'Date'].map((x) => h('th', {}, x))),
      ...ranked.map((r) =>
        h(
          'tr',
          { class: r.me ? 'me' : '' },
          h('td', {}, String(r.rank)),
          h('td', {}, r.name, r.me ? h('small', {}, ' you') : ''),
          h('td', {}, segClock(r.secs)),
          h('td', {}, r.watts ? `${Math.round(r.watts)} W` : '–'),
          h('td', {}, r.wkg ? r.wkg.toFixed(2) : '–'),
          h('td', {}, day(r.date)),
        ),
      ),
    ),
  )
}

/** The crew leaderboards as a dialog: pick a route, a segment and time or W/kg. Opens on `routeId` when given. */
export function openLeaderboards(me: string, routeId?: string) {
  let route = ROUTE_INDEX.find((r) => r.id === routeId)?.id ?? ROUTE_INDEX[0]?.id
  let by: BoardBy = 'time'
  let segs: Segment[] = []
  let segment: Segment | undefined
  let turn = 0
  const chips = h('div', { class: 'lb-segs' })
  const body = h('div', { class: 'lb-body' })

  const paint = async () => {
    const mine = ++turn
    chips.replaceChildren(
      ...segs.map((s) =>
        h(
          'button',
          { class: s === segment ? 'on' : '', onclick: () => ((segment = s), void paint()) },
          s.name,
          h('small', {}, s.kind === 'route' ? 'whole route' : s.kind),
        ),
      ),
    )
    if (!segment) return
    body.replaceChildren(h('p', { class: 'dim' }, 'Fetching the board…'))
    try {
      const rows = await api<CrewRow[]>(
        `/api/segments/${encodeURIComponent(segment.id)}/leaderboard?by=${by}`,
      )
      if (mine === turn) body.replaceChildren(board(rows, me, by))
    } catch {
      if (mine === turn)
        body.replaceChildren(
          h('p', { class: 'dim' }, 'The boards live on the server and it is not answering.'),
        )
    }
  }
  const pick = async (id: string) => {
    route = id
    segs = []
    segment = undefined
    body.replaceChildren(h('p', { class: 'dim' }, 'Loading the route…'))
    try {
      segs = routeSegments(await loadRoute(id))
      // The whole route (or lap) is the headline board, so it goes first and is picked first.
      segs = [segs[segs.length - 1], ...segs.slice(0, -1)]
      segment = segs[0]
    } catch {
      body.replaceChildren(h('p', { class: 'dim' }, 'Could not load that route.'))
    }
    if (route === id) void paint()
  }
  const sel = h(
    'select',
    { 'aria-label': 'Route', onchange: () => void pick(sel.value) },
    ...ROUTE_INDEX.map((r) => h('option', { value: r.id }, `${r.name} · ${r.region}`)),
  )
  if (route) sel.value = route
  modal(
    'Leaderboards',
    h(
      'div',
      { class: 'lb' },
      h(
        'div',
        { class: 'lb-top' },
        sel,
        seg<BoardBy>(
          [
            ['time', 'By time'],
            ['wkg', 'By W/kg'],
          ],
          by,
          (v) => ((by = v), void paint()),
        ),
      ),
      chips,
      body,
    ),
  )
  if (route) void pick(route)
}
