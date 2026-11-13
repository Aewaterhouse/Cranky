import type { Profile } from '../core/curve'
import { CFG } from '../config'
import {
  ROUTE_INDEX,
  difficulty,
  estimateSeconds,
  lengthClass,
  type RouteSummary,
} from '../core/routeLibrary'
import { h, seg } from './dom'
import { svgEl } from './svg'

const LENGTHS = { all: 'Any length', short: 'Short', medium: 'Medium', long: 'Long' }

const hm = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.round((s % 3600) / 60) % 60).padStart(2, '0')}`

function miniProfile(pts: number[]) {
  const lo = Math.min(...pts)
  const span = Math.max(1, Math.max(...pts) - lo)
  const xy = pts.map(
    (e, i) =>
      `${((i / Math.max(1, pts.length - 1)) * 100).toFixed(1)},${(28 - ((e - lo) / span) * 26).toFixed(1)}`,
  )
  const svg = svgEl('svg', {
    viewBox: '0 0 100 30',
    preserveAspectRatio: 'none',
    class: 'mini-prof',
  })
  svg.append(
    svgEl('polygon', { points: `0,30 ${xy.join(' ')} 100,30`, class: 'fill' }),
    svgEl('polyline', { points: xy.join(' '), class: 'line' }),
  )
  return svg
}

function card(p: Profile, r: RouteSummary, on: boolean, pick: () => void) {
  const power = p.ftp * CFG.freeRide.ftpFrac
  const d = difficulty(r.gainM, r.avgGrade)
  return h(
    'div',
    { class: `route-card${on ? ' on' : ''}`, onclick: pick },
    h('b', {}, r.name),
    h('span', { class: 'dim' }, r.region),
    miniProfile(r.profile),
    h(
      'span',
      { class: 'dim' },
      `${r.km.toFixed(r.km < 10 ? 1 : 0)} km${r.loop ? ' lap' : ''} · ${Math.round(r.gainM)} m up${r.loop ? '' : ` · avg ${r.avgGrade}%`}`,
    ),
    h(
      'span',
      { class: 'dim', title: 'Difficulty from climb and steepness' },
      `${'●'.repeat(d)}${'○'.repeat(5 - d)}`,
    ),
    h(
      'span',
      { class: 'dim' },
      `About ${hm(estimateSeconds(r.km, r.gainM, power, p.weightKg))} h at ${Math.round(CFG.freeRide.ftpFrac * 100)}% FTP`,
    ),
  )
}

/** Bundled route cards with state and length filters. `pick` lazy-loads the chosen pack. */
export function routePicker(
  p: Profile,
  selected: () => string | undefined,
  pick: (r: RouteSummary) => void,
) {
  let state = 'all'
  let len = 'all'
  const list = h('div', { class: 'route-grid' })
  const paint = () => {
    const shown = ROUTE_INDEX.filter(
      (r) =>
        (state === 'all' || r.region === state) && (len === 'all' || lengthClass(r.km) === len),
    )
    list.replaceChildren(
      ...(shown.length
        ? shown.map((r) => card(p, r, r.id === selected(), () => pick(r)))
        : [
            h(
              'p',
              { class: 'dim' },
              ROUTE_INDEX.length ? 'No routes match those filters.' : 'No bundled routes yet.',
            ),
          ]),
    )
  }
  const states = [...new Set(ROUTE_INDEX.map((r) => r.region))].sort()
  paint()
  const filters = ROUTE_INDEX.length
    ? [
        seg<string>(
          [['all', 'All states'], ...states.map((s): [string, string] => [s, s])],
          state,
          (v) => ((state = v), paint()),
        ),
        seg<string>(Object.entries(LENGTHS), len, (v) => ((len = v), paint())),
      ]
    : []
  return { el: h('div', {}, ...filters, list), paint }
}
