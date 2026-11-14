import { api } from '../core/api'
import type { Profile } from '../core/curve'
import type { RideSummary } from '../core/ride'
import { flushRides, queuedList } from '../core/rideQueue'
import { downloadFit, downloadJson } from './rideExport'
import { stravaRides, stravaTag, type StravaJob } from './strava'
import { fmt, h, kmStr, pctStr } from './dom'
import { routeTrace } from './routeTrace'
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
  /** Free and group rides: the route's id and metres ridden. */
  route: string | null
  distance: number | null
}

const num = (v: number | null, unit = '') => (v == null ? '–' : `${Math.round(v)}${unit}`)
function list(rows: RideRow[], open: (n: number) => void, strava?: Record<string, StravaJob>) {
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
          r.route ? routeTrace(r.route, 44, 28) : '',
          r.plan ?? 'Ride',
          r.route
            ? h(
                'small',
                {},
                ` ${r.distance == null ? '' : `${kmStr(r.distance)} km `}${r.crew ? 'group ride' : 'free ride'}`,
              )
            : '',
          r.crew ? h('em', { class: 'crew-tag' }, 'Crew') : '',
          stravaTag(strava?.[r.id]),
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

/** Rides still on this device waiting for the server: listed with their downloads so none is ever out of reach. */
function waiting(rider: string) {
  const q = queuedList<RideSummary>(rider).reverse()
  if (!q.length) return ''
  return h(
    'div',
    { class: 'hl-wait' },
    h('h3', { class: 'label' }, `Waiting to upload (${q.length})`),
    ...q.map((s) =>
      h(
        'div',
        { class: 'row' },
        h('span', {}, `${dateStr(s.record.date)} · ${s.planName ?? 'Ride'}`),
        h('button', { onclick: () => void downloadFit(s) }, 'Download .fit'),
        h('button', { onclick: () => void downloadJson(s) }, 'Export JSON'),
      ),
    ),
  )
}

/** History tab: every ride, newest first; a click opens the full ride. */
export function historyTab(p: Profile) {
  const box = h('section', { class: 'panel' })
  const showList = () => {
    box.replaceChildren(h('h2', { class: 'label' }, 'Rides'), h('p', { class: 'dim' }, 'Loading…'))
    flushRides(p.id)
      .catch(() => {})
      .then(() => Promise.all([api<RideRow[]>('/api/rides'), stravaRides().catch(() => undefined)]))
      .then(
        ([rows, strava]) =>
          box.replaceChildren(
            h('h2', { class: 'label' }, `Rides (${rows.length})`),
            waiting(p.id),
            list(rows, (n) => box.replaceChildren(rideDetail(p, n, showList)), strava?.rides),
          ),
        () =>
          box.replaceChildren(
            h('h2', { class: 'label' }, 'Rides'),
            h(
              'p',
              { class: 'dim' },
              "Couldn't reach the server. Try again when you're back online.",
            ),
            waiting(p.id),
          ),
      )
  }
  showList()
  return box
}
