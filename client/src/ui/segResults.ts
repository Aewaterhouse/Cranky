import { segClock, splitText } from '../core/segments'
import type { SegResult } from '../core/segmentTracker'
import { h } from './dom'

/** The segment results card for the end-of-ride summary and the ride history; nothing when there are none. */
export function segmentSection(results: SegResult[] | undefined) {
  if (!results?.length) return ''
  const note = (r: SegResult) =>
    r.crewBest
      ? h('b', { class: 'seg-pr' }, 'Crew best')
      : r.first
        ? h('b', { class: 'seg-pr' }, 'First go')
        : r.pr
          ? h('b', { class: 'seg-pr' }, `PR by ${segClock(r.prevS! - r.secs)}`)
          : `${splitText(r.secs - r.prevS!)} on your best`
  return h(
    'div',
    { class: 'card seg-res' },
    h('h2', {}, 'Segments'),
    h(
      'table',
      {},
      h('tr', {}, ...['Segment', 'Time', 'Avg', 'W/kg', ''].map((x) => h('th', {}, x))),
      ...results.map((r) =>
        h(
          'tr',
          {},
          h('td', {}, r.name, r.lap ? h('small', {}, ` lap ${r.lap}`) : ''),
          h('td', {}, segClock(r.secs)),
          h('td', {}, `${r.watts} W`),
          h('td', {}, r.wkg.toFixed(1)),
          h('td', {}, note(r)),
        ),
      ),
    ),
  )
}
