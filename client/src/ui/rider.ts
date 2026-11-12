import { CFG } from '../config'
import { curves, type Point, type Profile } from '../core/curve'
import { wkg, wkgStr } from '../core/riderMetrics'
import '../rider.css'
import { avatar, h } from './dom'
import { riderSettings } from './riderSettings'
import { curveChart, dur, history, zoneBar } from './riderStats'

const SUBS = { overview: 'Overview', power: 'Power', settings: 'Settings' }
type Sub = keyof typeof SUBS
let sub: Sub = 'overview'

const cell = (p: Point, kg?: number) =>
  h(
    'td',
    { class: p.real ? 'real' : 'est', title: p.real ? 'From your rides' : 'Estimated from FTP' },
    `${p.w} W`,
    kg ? h('small', {}, ` ${wkg(p.w, kg)}`) : '',
  )
const panel = (title: string, ...kids: (Node | string)[]) =>
  h('section', { class: 'panel' }, h('h2', { class: 'label' }, title), ...kids)

function overview(p: Profile) {
  const s = p.stats
  const stat = (v: string | number, l: string) =>
    h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, l))
  return h(
    'div',
    {},
    h(
      'section',
      { class: 'panel stats' },
      stat(s.rides, 'rides'),
      stat(Math.round(s.secs / 360) / 10, 'hours'),
      stat(s.kj.toLocaleString('en-AU'), 'kJ'),
      stat(s.streak, s.streak === 1 ? 'week streak' : 'weeks streak'),
    ),
    h(
      'div',
      { class: 'cols' },
      panel('Time in zone', zoneBar(s.zones)),
      panel('Recent rides', history(p)),
    ),
  )
}

function power(p: Profile) {
  const c = curves(p)
  return panel(
    'Power curve',
    curveChart(c.allTime, c.d90),
    h(
      'p',
      { class: 'dim legend' },
      h('i', { class: 'key all' }),
      'All time ',
      h('i', { class: 'key d90' }),
      'Last 90 days',
    ),
    h(
      'table',
      { class: 'curve' },
      h(
        'thead',
        {},
        h('tr', {}, h('th', {}, 'Best'), h('th', {}, 'All time'), h('th', {}, 'Last 90 days')),
      ),
      h(
        'tbody',
        {},
        ...CFG.curveDurations.map((d) =>
          h(
            'tr',
            {},
            h('th', {}, dur(d)),
            cell(c.allTime[d], p.weightKg),
            cell(c.d90[d], p.weightKg),
          ),
        ),
      ),
    ),
  )
}

/** The Rider tab: header, then Overview, Power and Settings sub-tabs. */
export function riderTab(p: Profile) {
  const head = () =>
    h(
      'header',
      { class: 'rider-head' },
      avatar(p.name, 'xl'),
      h(
        'div',
        {},
        h('h1', {}, p.name),
        h(
          'p',
          { class: 'dim' },
          `FTP ${p.ftp} W${p.weightKg ? ` · ${wkgStr(p.ftp, p.weightKg)}` : ''} · ${p.tier} tier`,
        ),
      ),
    )
  const body = h('div', { class: 'rider-body' })
  const nav = h('nav', { class: 'subtabs', role: 'tablist' })
  const root = h('div', { class: 'rider' }, head(), nav, body)
  const draw = () => {
    nav.replaceChildren(
      ...Object.entries(SUBS).map(([k, v]) =>
        h(
          'button',
          { role: 'tab', class: k === sub ? 'on' : '', onclick: () => ((sub = k as Sub), draw()) },
          v,
        ),
      ),
    )
    body.replaceChildren(
      sub === 'power'
        ? power(p)
        : sub === 'settings'
          ? riderSettings(p, () => root.firstElementChild!.replaceWith(head()))
          : overview(p),
    )
  }
  draw()
  return root
}
