import { ZONE_NAMES } from '../core/riderMetrics'
import type { Profile } from '../core/curve'
import { h } from './dom'
import { ZONE_COLOURS } from './planGraph'

export function zoneBar(zones: number[]) {
  const total = zones.reduce((a, b) => a + b, 0)
  if (!total)
    return h('p', { class: 'dim' }, 'Ride a bit and your time in each zone shows up here.')
  return h(
    'div',
    { class: 'zones' },
    h(
      'div',
      { class: 'zbar' },
      ...zones.map((z, i) =>
        h('i', {
          style: `flex:${z};background:${ZONE_COLOURS[i]}`,
          title: `Z${i + 1} ${ZONE_NAMES[i]}`,
        }),
      ),
    ),
    h(
      'ul',
      { class: 'zlegend' },
      ...zones.map((z, i) =>
        h(
          'li',
          { class: z ? '' : 'none' },
          h('i', { style: `background:${ZONE_COLOURS[i]}` }),
          h('b', {}, `Z${i + 1}`),
          h('span', {}, ZONE_NAMES[i]),
          h('em', {}, `${Math.round((z / total) * 100)}%`),
        ),
      ),
    ),
  )
}

const best = (r: Profile['rides'][number], d: number) => (r.best[d] ? `${r.best[d]} W` : '–')

export function history(p: Profile) {
  const rides = p.rides.slice(-12).reverse()
  if (!rides.length) return h('p', { class: 'dim' }, 'No rides yet. Your first one lands here.')
  return h(
    'div',
    { class: 'hist' },
    h(
      'div',
      { class: 'hrow head' },
      h('span', {}, 'Date'),
      h('span', {}, 'Time'),
      h('span', {}, 'kJ'),
      h('span', {}, '5 s'),
      h('span', {}, '1 min'),
      h('span', {}, '20 min'),
    ),
    ...rides.map((r) =>
      h(
        'div',
        { class: 'hrow' },
        h(
          'span',
          { class: 'when' },
          new Date(r.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
        ),
        h('span', {}, `${Math.round(r.secs / 60)} min`),
        h('span', {}, String(Math.round(r.kj))),
        h('span', {}, best(r, 5)),
        h('span', {}, best(r, 60)),
        h('span', {}, best(r, 1200)),
      ),
    ),
  )
}
