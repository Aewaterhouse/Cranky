import type { RideSummary } from '../core/ride'
import { fmt, h, pctStr } from './dom'

/** The per-block table of the results screen: time, target, average, compliance and time in zone. */
export function blocksCard(s: RideSummary) {
  return h(
    'div',
    { class: 'card' },
    h('h2', {}, 'Blocks'),
    h(
      'table',
      {},
      h(
        'tr',
        {},
        ...['Block', 'Time', 'Target', 'Avg', 'Compliance', 'In zone'].map((x) => h('th', {}, x)),
      ),
      ...s.blocks.map((b) => {
        const scored = b.type !== 'sprint' && b.type !== 'free'
        return h(
          'tr',
          {},
          h('td', {}, b.label),
          h('td', {}, fmt(b.secs)),
          h('td', {}, b.avgTarget ? `${b.avgTarget} W` : '–'),
          h('td', {}, `${b.avgPower} W`),
          h(
            'td',
            {},
            scored
              ? h(
                  'span',
                  { class: `res-comp ${b.compliance >= 0.85 ? 'good' : 'miss'}` },
                  h('i', { style: `width:${b.compliance * 100}%` }),
                  pctStr(b.compliance),
                )
              : '–',
          ),
          h('td', {}, fmt(b.inBandSecs)),
        )
      }),
    ),
  )
}
