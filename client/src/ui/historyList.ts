import { api } from '../core/api'
import type { Profile } from '../core/curve'
import { fmt, h, pctStr } from './dom'
import { dateStr, rideDetail } from './historyDetail'

/** One row of GET /api/rides. Rides from before a field existed have it as null. */
export interface RideRow {
  id: number
  date: string
  plan: string | null
  secs: number | null
  avgPower: number | null
  np: number | null
  tss: number | null
  kj: number | null
  compliance: number | null
  crew: boolean
}

const num = (v: number | null, unit = '') => (v == null ? '–' : `${Math.round(v)}${unit}`)
function list(rows: RideRow[], open: (n: number) => void) {
  if (!rows.length) return h('p', { class: 'dim' }, 'No rides yet. Your first one lands here.')
  const cols = ['Date', 'Ride', 'Time', 'Avg W', 'NP', 'TSS', 'kJ', 'Compl.']
  return h(
    'div',
    { class: 'hlist', role: 'table' },
    h('div', { class: 'hl-row head', role: 'row' }, ...cols.map((c) => h('span', {}, c))),
    ...rows.map((r) =>
      h(
        'button',
        { class: 'hl-row', role: 'row', onclick: () => open(r.id) },
        h('span', { class: 'when' }, dateStr(r.date)),
        h(
          'span',
          { class: 'plan' },
          r.plan ?? 'Ride',
          r.crew ? h('em', { class: 'crew-tag' }, 'Crew') : '',
        ),
        h('span', {}, r.secs == null ? '–' : fmt(r.secs)),
        h('span', {}, num(r.avgPower)),
        h('span', {}, num(r.np)),
        h('span', {}, num(r.tss)),
        h('span', {}, num(r.kj)),
        h('span', {}, r.compliance ? pctStr(r.compliance) : '–'),
      ),
    ),
  )
}

/** History tab: every ride, newest first; a click opens the full ride. */
export function historyTab(p: Profile) {
  const box = h('section', { class: 'panel' })
  const showList = () => {
    box.replaceChildren(h('h2', { class: 'label' }, 'Rides'), h('p', { class: 'dim' }, 'Loading…'))
    api<RideRow[]>('/api/rides').then(
      (rows) =>
        box.replaceChildren(
          h('h2', { class: 'label' }, `Rides (${rows.length})`),
          list(rows, (n) => box.replaceChildren(rideDetail(p, n, showList))),
        ),
      () =>
        box.replaceChildren(
          h('h2', { class: 'label' }, 'Rides'),
          h('p', { class: 'dim' }, "Couldn't reach the server. Try again when you're back online."),
        ),
    )
  }
  showList()
  return box
}
