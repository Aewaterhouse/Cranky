import '../passport.css'
import { CFG } from '../config'
import {
  BORDERS,
  MAINLAND,
  MAP_SIZE,
  ROUTE_AT,
  STATES,
  TASMANIA,
  mapXY,
  spread,
} from '../core/ausMap'
import type { Profile } from '../core/curve'
import type { Stamp } from '../core/passport'
import { ROUTE_INDEX } from '../core/routeLibrary'
import { segClock } from '../core/segments'
import { h } from './dom'
import { openLeaderboards } from './leaderboards'
import { badgeGrid } from './riderBadges'
import { svgEl } from './svg'
import { UNIT } from './units'
import { weekCard } from './weekCard'

const line = (pts: [number, number][], close = false) =>
  pts
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${mapXY(p)
          .map((v) => v.toFixed(1))
          .join(' ')}`,
    )
    .join('') + (close ? 'Z' : '')
const metres = (m: number) => UNIT.climb(m)

/** The map: land, state lines and a numbered dot per bundled route, filled once the route has been finished. */
function ausMap(stamps: Record<string, Stamp>) {
  const svg = svgEl('svg', {
    viewBox: `-6 -6 ${MAP_SIZE[0] + 12} ${MAP_SIZE[1] + 12}`,
    class: 'aus',
    role: 'img',
  })
  svg.setAttribute('aria-label', 'Map of Australia with a dot for each route')
  svg.append(
    svgEl('path', { d: line(MAINLAND, true) + line(TASMANIA, true), class: 'land' }),
    ...BORDERS.map((b) => svgEl('path', { d: line(b), class: 'border' })),
    ...Object.entries(STATES).map(([s, at]) => {
      const [x, y] = mapXY(at)
      return svgEl('text', { x, y, class: 'state' }, s)
    }),
  )
  const routes = ROUTE_INDEX.filter((r) => ROUTE_AT[r.id])
  const home = routes.map((r) => mapXY(ROUTE_AT[r.id]))
  const at = spread(home, CFG.passport.dotGap)
  // Leader lines first, so every dot sits on top of every line.
  routes.forEach((_, i) =>
    svg.append(
      svgEl('line', { x1: home[i][0], y1: home[i][1], x2: at[i][0], y2: at[i][1], class: 'lead' }),
    ),
  )
  routes.forEach((r, i) => {
    const s = stamps[r.id]
    const g = svgEl('g', {
      class: `dot${s?.n ? ' got' : ''}`,
      transform: `translate(${at[i][0].toFixed(1)} ${at[i][1].toFixed(1)})`,
    })
    const tip = svgEl(
      'title',
      {},
      `${r.name}${s?.n ? `: ridden ${s.n} times` : ': not ridden yet'}`,
    )
    g.append(
      tip,
      svgEl('circle', { r: CFG.passport.dotGap / 2 - 1 }),
      svgEl('text', { y: 0.5 }, String(ROUTE_INDEX.indexOf(r) + 1)),
    )
    svg.append(g)
  })
  return svg
}

/** Route passport: where you have ridden, how often, how fast and how far up, with this week's goals and the badges. */
export function passportTab(p: Profile) {
  const stamps = p.passport ?? {}
  const done = ROUTE_INDEX.filter((r) => stamps[r.id]?.n)
  const sum = (pick: (s: Stamp) => number) =>
    ROUTE_INDEX.reduce((a, r) => a + (stamps[r.id] ? pick(stamps[r.id]) : 0), 0)
  return h(
    'div',
    { class: 'passport' },
    weekCard(p),
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'label' }, 'Route passport'),
      h(
        'p',
        { class: 'dim' },
        done.length
          ? `${done.length} of ${ROUTE_INDEX.length} routes stamped · ${sum((s) => s.n)} finishes · ${metres(sum((s) => s.vertM))} climbed`
          : 'Nothing stamped yet. Finish a free ride on any route and its dot fills in.',
      ),
      h(
        'button',
        { class: 'lb-open', onclick: () => openLeaderboards(p.id) },
        '🏆 Crew leaderboards',
      ),
      h(
        'div',
        { class: 'pp-cols' },
        ausMap(stamps),
        h(
          'table',
          { class: 'pp-list' },
          h('tr', {}, ...['', 'Route', 'Rides', 'Best', 'Climbed'].map((x) => h('th', {}, x))),
          ...ROUTE_INDEX.map((r, i) => {
            const s = stamps[r.id]
            return h(
              'tr',
              { class: s?.n ? 'got' : '' },
              h('td', {}, h('i', { class: 'pp-n' }, String(i + 1))),
              h('td', {}, r.name, h('small', {}, ` ${r.region}`)),
              h('td', {}, s?.n ? String(s.n) : '–'),
              h('td', {}, s?.bestS ? `${segClock(s.bestS)}${r.loop ? ' lap' : ''}` : '–'),
              h('td', {}, s?.vertM ? metres(s.vertM) : '–'),
            )
          }),
        ),
      ),
    ),
    badgeGrid(p, 'Passport badges', (b) => b.id.startsWith('pp')),
  )
}
