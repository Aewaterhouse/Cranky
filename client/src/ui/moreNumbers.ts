import { CFG } from '../config'
import { extraMetrics } from '../core/rideMetrics'
import { h } from './dom'

const row = (label: string, value: string, what: string) =>
  h('div', { class: 'mn-row' }, h('span', {}, label), h('b', {}, value), h('small', {}, what))

/** The numbers beyond NP and TSS, for the results and history screens. Empty for a short ride. */
export function moreNumbers(
  power: number[],
  hr: (number | null)[],
  cadence: number[],
  ftp: number,
) {
  const m = extraMetrics(power, hr, cadence, ftp)
  if (m.vi == null) return ''
  const most = Math.max(1, ...m.cadence.map(([, s]) => s))
  return h(
    'div',
    { class: 'card more-num' },
    h('h2', {}, 'More numbers'),
    row(
      'Variability',
      m.vi.toFixed(2),
      'NP over average power. 1.00 is dead steady; intervals run higher.',
    ),
    m.ef != null
      ? row('Efficiency', m.ef.toFixed(2), 'NP per heartbeat. Climbs as you get fitter.')
      : '',
    m.drift != null
      ? row(
          'HR drift',
          `${m.drift.toFixed(1)}%`,
          'Power per beat, second half against first. Under 5% on a steady ride is a good aerobic base.',
        )
      : '',
    m.wbalPct != null
      ? row(
          'W′ low point',
          `${Math.round(m.wbalPct * 100)}%`,
          `Of your ${CFG.metrics.wPrimeJ / 1000} kJ above-threshold tank, the least you had left.`,
        )
      : '',
    m.cadence.length
      ? h(
          'div',
          { class: 'mn-cad' },
          h('span', {}, 'Cadence'),
          ...m.cadence.map(([label, secs]) =>
            h(
              'div',
              { class: 'mn-bar' },
              h('i', { style: `height:${(secs / most) * 100}%` }),
              h('small', {}, label.replace('under ', '<')),
            ),
          ),
        )
      : '',
  )
}
