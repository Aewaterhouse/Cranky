import { CFG } from '../config'
import { leaderboard, type CrewRider } from '../core/crewCurve'
import { fmtDur } from '../core/powerCurve'
import { h, seg } from './dom'

/** Leaderboard of crew all-time bests: pick a duration and W or W/kg. */
export function crewBoard(riders: CrewRider[], me: string) {
  let d: number = CFG.crewDurations[0]
  let perKg = false
  const body = h('div', {})
  const draw = () => {
    const rows = leaderboard(riders, d, perKg)
    body.replaceChildren(
      rows.length
        ? h(
            'table',
            { class: 'curve board' },
            h(
              'tbody',
              {},
              ...rows.map((r, i) =>
                h(
                  'tr',
                  { class: r.id === me ? 'me' : '' },
                  h('th', {}, String(i + 1)),
                  h('td', {}, r.name),
                  h('td', {}, perKg ? `${r.wkg!.toFixed(2)} W/kg` : `${r.w} W`),
                  h(
                    'td',
                    { class: 'dim' },
                    perKg ? `${r.w} W` : r.wkg ? `${r.wkg.toFixed(2)} W/kg` : '',
                  ),
                ),
              ),
            ),
          )
        : h('p', { class: 'dim' }, perKg ? 'No weights and efforts yet.' : 'No efforts yet.'),
    )
  }
  draw()
  return h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'label' }, 'Crew leaderboard'),
    h(
      'div',
      { class: 'row chead' },
      seg(
        CFG.crewDurations.map((x) => [String(x), fmtDur(x)] as [string, string]),
        String(d),
        (v) => ((d = Number(v)), draw()),
      ),
      seg<'w' | 'kg'>(
        [
          ['w', 'W'],
          ['kg', 'W/kg'],
        ],
        'w',
        (v) => ((perKg = v === 'kg'), draw()),
        'unit',
      ),
    ),
    body,
    h('p', { class: 'dim' }, 'All-time bests. Riders without a weight are left out of W/kg.'),
  )
}
