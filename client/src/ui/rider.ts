import { CFG } from '../config'
import { TIER_NAME } from '../types'
import { liveStreak, type Profile } from '../core/curve'
import { stickBadges } from '../core/badges'
import { saveProfile } from '../core/profile'
import { wkgStr } from '../core/riderMetrics'
import '../rider.css'
import { bodyCreator } from './bodyCreator'
import { avatar, h } from './dom'
import { riderSettings } from './riderSettings'
import { historyTab } from './historyList'
import { passportTab } from './passport'
import { badgeGrid, prTimelinePanel } from './riderBadges'
import { powerTab } from './riderPower'
import { trendsTab } from './riderTrends'
import { history, zoneBar } from './riderStats'

const SUBS = {
  overview: 'Overview',
  power: 'Power',
  trends: 'Trends',
  history: 'History',
  passport: 'Passport',
  body: 'Body',
  settings: 'Settings',
}
type Sub = keyof typeof SUBS
let sub: Sub = 'overview'
/** The Rider tab opens on Settings next time (after Strava sends the rider back). */
export const openRiderSettings = () => (sub = 'settings')

const panel = (title: string, ...kids: (Node | string)[]) =>
  h('section', { class: 'panel' }, h('h2', { class: 'label' }, title), ...kids)

function overview(p: Profile) {
  if (stickBadges(p)) saveProfile(p)
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
      s.secs < 3600
        ? stat(Math.round(s.secs / 60), 'minutes')
        : stat(Math.round(s.secs / 360) / 10, 'hours'),
      stat(s.kj.toLocaleString('en-AU'), 'kJ'),
      stat(liveStreak(p), 'week streak'),
    ),
    // A kJ of work at the pedals is about a kilocalorie burned: in pies and Tim Tams.
    s.kj > 0
      ? h(
          'p',
          { class: 'dim fun-stats' },
          `That is about ${Math.round(s.kj / CFG.funStats.pieKj).toLocaleString('en-AU')} meat pies, or ${Math.round(s.kj / CFG.funStats.timTamKj).toLocaleString('en-AU')} Tim Tams, burned off.`,
        )
      : '',
    h(
      'div',
      { class: 'cols' },
      panel('Time in zone', zoneBar(s.zones)),
      panel('Recent rides', history(p)),
    ),
    badgeGrid(p),
  )
}

/** The Rider tab: header, then the sub-tabs. */
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
          `FTP ${p.ftp} W${p.weightKg ? ` · ${wkgStr(p.ftp, p.weightKg)}` : ''} · ${TIER_NAME[p.tier]} effort`,
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
    const views: Record<Sub, () => Node> = {
      overview: () => overview(p),
      power: () => h('div', {}, powerTab(p), prTimelinePanel(p)),
      trends: () => trendsTab(p),
      history: () => historyTab(p),
      passport: () => (stickBadges(p) && saveProfile(p), passportTab(p)),
      body: () => bodyCreator(p),
      settings: () => riderSettings(p, () => root.firstElementChild!.replaceWith(head())),
    }
    body.replaceChildren(views[sub]())
  }
  draw()
  return root
}
