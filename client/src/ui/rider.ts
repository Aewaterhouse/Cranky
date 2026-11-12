import type { Profile } from '../core/curve'
import { wkgStr } from '../core/riderMetrics'
import '../rider.css'
import { avatar, h } from './dom'
import { riderSettings } from './riderSettings'
import { historyTab } from './historyList'
import { powerTab } from './riderPower'
import { history, zoneBar } from './riderStats'

const SUBS = { overview: 'Overview', power: 'Power', history: 'History', settings: 'Settings' }
type Sub = keyof typeof SUBS
let sub: Sub = 'overview'

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
        ? powerTab(p)
        : sub === 'history'
          ? historyTab(p)
          : sub === 'settings'
            ? riderSettings(p, () => root.firstElementChild!.replaceWith(head()))
            : overview(p),
    )
  }
  draw()
  return root
}
