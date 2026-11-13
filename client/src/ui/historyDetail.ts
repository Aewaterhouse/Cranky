import { api } from '../core/api'
import { CFG } from '../config'
import { settings } from '../core/settings'
import { removeRide, type Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import type { RideSummary } from '../core/ride'
import { ZONE_NAMES } from '../core/riderMetrics'
import '../results.css'
import { fmt, h, kmStr, pctStr } from './dom'
import { routeTrace } from './routeTrace'
import { segmentSection } from './segResults'
import { ZONE_COLOURS } from './planGraph'
import { downloadFit, downloadJson } from './rideExport'
import { ridePostcard, savePng } from './ridePostcard'
import { segsFromSeries } from './soloSegs'
import { modal, toast } from './toast'
import { workoutChart } from './workoutChart'

export const dateStr = (iso: string, long = false) =>
  new Date(iso).toLocaleDateString('en-AU', {
    ...(long ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
  })

const tile = (label: string, value: string, sub = '', cls = '') =>
  h(
    'div',
    { class: `res-tile ${cls}` },
    h('span', {}, label),
    h('b', {}, value),
    sub ? h('small', {}, sub) : '',
  )

/** Rides recorded before later fields existed may lack any of the optional ones. */
function body(s: RideSummary) {
  const secs = s.record.secs
  const zones = s.zones ?? s.record.zones ?? []
  const blocks = s.blocks ?? []
  const sprints = s.sprints ?? []
  const power = s.power ?? []
  const hasHr = s.avgHr != null
  const chart = workoutChart(s.ftp ?? 200)
  if (power.length > 1) {
    const types = blocks.flatMap((b) => Array<string>(b.secs).fill(b.type))
    chart.set({
      segs: segsFromSeries(s.target ?? [], types, s.ftp ?? 200),
      total: power.length,
      power,
      cadence: [],
      hr: s.hr ?? [],
      showHr: hasHr,
    })
  }
  const zoneRow = (z: number, i: number) =>
    h(
      'div',
      { class: 'res-zrow' },
      h('span', {}, `Z${i + 1}`, h('small', {}, ZONE_NAMES[i])),
      h(
        'div',
        { class: 'res-zbar' },
        h('i', {
          style: `width:${(z / Math.max(1, ...zones)) * 100}%;background:${ZONE_COLOURS[i]}`,
        }),
      ),
      h('em', {}, fmt(z)),
      h('small', {}, `${Math.round((z / Math.max(1, secs)) * 100)}%`),
    )
  const card = (title: string, ...kids: (Node | string)[]) =>
    h('div', { class: 'card' }, h('h2', {}, title), ...kids)
  return [
    h(
      'div',
      { class: 'res-tiles' },
      tile('Duration', fmt(secs), '', 'wide'),
      tile('Avg power', s.avgPower == null ? '–' : `${s.avgPower} W`),
      tile('Normalised', s.np == null ? '–' : `${s.np} W`, 'weighted average'),
      tile('Intensity', s.if == null ? '–' : s.if.toFixed(2), 'IF'),
      tile('TSS', s.tss == null ? '–' : String(s.tss), 'training stress'),
      tile('Energy', `${s.record.kj} kJ`),
      ...(s.avgCadence ? [tile('Avg cadence', `${s.avgCadence} rpm`)] : []),
      ...(hasHr ? [tile('Avg HR', `${s.avgHr} bpm`), tile('Max HR', `${s.maxHr} bpm`)] : []),
      tile('Compliance', s.compliance ? pctStr(s.compliance) : '–', `FTP ${s.ftp ?? '–'} W`),
    ),
    s.route
      ? card(
          s.route.laps ? `${s.route.name} · ${s.route.laps} laps` : s.route.name,
          h(
            'div',
            { class: 'rd-route' },
            routeTrace(s.route.id, 300, 190, s.route.laps ? Infinity : (s.distance ?? Infinity)),
            h(
              'div',
              { class: 'res-tiles' },
              tile('Distance', `${kmStr(s.distance ?? 0)} km`),
              tile('Climbed', `${s.ascent ?? 0} m`),
              tile('Finished', s.route.done ? 'Yes' : 'No'),
            ),
          ),
        )
      : '',
    segmentSection(s.segments),
    power.length > 1 ? card('Power vs target', h('div', { class: 'res-chart' }, chart.el)) : '',
    h(
      'div',
      { class: 'res-two' },
      zones.length ? card('Time in zone', ...zones.map(zoneRow)) : '',
      sprints.length
        ? card(
            'Sprints',
            h(
              'div',
              { class: 'res-sprints' },
              ...sprints.map((x, i) =>
                h(
                  'div',
                  { class: `res-spr grade-${x.grade}` },
                  h('small', {}, `#${i + 1}`),
                  h('b', {}, x.grade),
                  h('span', {}, `${x.avg} W`),
                  h('small', {}, pctStr(x.pct)),
                ),
              ),
            ),
          )
        : '',
    ),
    blocks.length
      ? card(
          'Blocks',
          h(
            'table',
            {},
            h(
              'tr',
              {},
              ...['Block', 'Time', 'Target', 'Avg', 'Compliance', 'In zone'].map((x) =>
                h('th', {}, x),
              ),
            ),
            ...blocks.map((b) =>
              h(
                'tr',
                {},
                h('td', {}, b.label),
                h('td', {}, fmt(b.secs)),
                h('td', {}, b.avgTarget ? `${b.avgTarget} W` : '–'),
                h('td', {}, `${b.avgPower} W`),
                h('td', {}, b.type === 'sprint' || b.type === 'free' ? '–' : pctStr(b.compliance)),
                h('td', {}, fmt(b.inBandSecs)),
              ),
            ),
          ),
        )
      : '',
  ]
}

/** Full view of one stored ride. `back` returns to the list (also after a delete). */
/** Rebuilds the ride's postcard from what was saved (no still is kept, so it gets the skyline). */
async function savePostcard(p: Profile, s: RideSummary) {
  const c = await ridePostcard(s, p.weightKg || CFG.freeRide.defaultKg, undefined, settings.units)
  const day = new Date(s.record.date).toLocaleDateString('en-CA')
  return savePng(c, `cranky-${s.route?.id ?? 'ride'}-${day}`)
}

export function rideDetail(p: Profile, n: number, back: () => void) {
  const root = h('div', { class: 'ride-detail' })
  const head = (s?: RideSummary) =>
    h(
      'div',
      { class: 'rd-head' },
      h('button', { class: 'ghost', onclick: back }, '← All rides'),
      s
        ? h(
            'div',
            {},
            h('h2', {}, s.planName ?? 'Ride'),
            h('p', { class: 'dim' }, dateStr(s.record.date, true)),
          )
        : '',
    )
  root.append(head(), h('p', { class: 'dim' }, 'Loading…'))
  api<RideSummary>(`/api/rides/${n}`).then(
    (s) => {
      const del = () => {
        const close = modal(
          'Delete this ride?',
          h(
            'p',
            {},
            'It leaves your history and lifetime totals. Your power bests stay, and this cannot be undone.',
          ),
          h(
            'div',
            { class: 'row' },
            h('button', { onclick: () => close() }, 'Keep it'),
            h(
              'button',
              {
                class: 'primary',
                onclick: () =>
                  api(`/api/rides/${n}`, { method: 'DELETE' }).then(
                    () => {
                      Object.assign(p, removeRide(p, s.record.date))
                      saveProfile(p)
                      close()
                      toast('Ride deleted', 'good')
                      back()
                    },
                    () => toast("Couldn't delete that ride", 'bad'),
                  ),
              },
              'Delete ride',
            ),
          ),
        )
      }
      root.replaceChildren(
        head(s),
        ...body(s),
        h(
          'div',
          { class: 'row res-actions' },
          h(
            'button',
            { disabled: !s.power?.length, onclick: () => void downloadFit(s) },
            'Download .fit',
          ),
          h('button', { onclick: () => downloadJson(s) }, 'Export JSON'),
          h('button', { onclick: () => void savePostcard(p, s) }, 'Save postcard'),
          h('button', { class: 'ghost danger', onclick: del }, 'Delete'),
        ),
      )
    },
    () => root.replaceChildren(head(), h('p', { class: 'dim' }, "Couldn't load that ride.")),
  )
  return root
}
