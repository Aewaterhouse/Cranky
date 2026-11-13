import { CFG } from '../config'
import type { Profile } from '../core/curve'
import { ROUTE_INDEX, type RouteSummary } from '../core/routeLibrary'
import { featuredRoute, weekState } from '../core/weekly'
import { h } from './dom'
import { scrapIcon } from './garage'
import { UNIT } from './units'

const W = CFG.weekly

/**
 * This week's two goals: the featured route (the same for every rider) and the rider's own climbing target
 * with a progress bar. `pick` makes the featured route a button (the free-ride setup uses it to select it).
 */
export function weekCard(p: Profile, pick?: (r: RouteSummary) => void) {
  const feat = featuredRoute(ROUTE_INDEX)
  const s = weekState(p)
  const frac = Math.min(1, s.vertM / s.targetM)
  const reward = (scrap: number, done: boolean) =>
    h(
      'span',
      { class: `wk-pay${done ? ' done' : ''}` },
      done ? 'Banked ' : '',
      scrapIcon(),
      ` ${scrap}`,
    )
  return h(
    'section',
    { class: 'panel week' },
    h('h2', { class: 'label' }, 'This week'),
    h(
      'div',
      { class: 'wk-cols' },
      feat
        ? h(
            'div',
            { class: 'wk-item' },
            h('span', { class: 'dim' }, 'Route of the week'),
            h(
              'b',
              {},
              feat.name,
              h(
                'small',
                {},
                ` ${feat.region} · ${UNIT.dist(feat.km * 1000, feat.km < 10 ? 1 : 0)}${feat.loop ? ' lap' : ''} · ${UNIT.climb(feat.gainM)} up`,
              ),
            ),
            h(
              'span',
              { class: 'wk-foot' },
              s.featuredDone
                ? 'Done. It will still be there next time.'
                : feat.loop
                  ? 'Finish a lap of it for a bonus.'
                  : 'Finish it for a bonus.',
              reward(W.featuredScrap, s.featuredDone),
              pick ? h('button', { class: 'ghost', onclick: () => pick(feat) }, 'Pick it') : '',
            ),
          )
        : '',
      h(
        'div',
        { class: 'wk-item' },
        h('span', { class: 'dim' }, 'Weekly climb'),
        h('b', {}, `${UNIT.climbNum(s.vertM)} of ${UNIT.climb(s.targetM)}`),
        h(
          'div',
          { class: 'wk-bar', role: 'progressbar', 'aria-valuenow': Math.round(frac * 100) },
          h('i', { style: `width:${(frac * 100).toFixed(1)}%` }),
        ),
        h(
          'span',
          { class: 'wk-foot' },
          s.vertDone
            ? 'Target climbed. The stairs at work can wait.'
            : 'Free-ride climbing this week, Monday to Sunday.',
          reward(W.vert.scrap, s.vertDone),
        ),
      ),
    ),
  )
}
