import type { Profile } from '../core/curve'
import { avatar, h, show } from './dom'
import { garageTab, scrapIcon } from './garage'
import { rideTab, type HomeActions } from './home'
import { logo } from './login'
import { riderTab } from './rider'
import { listen, setSimFtp, trainerPill } from './trainer'

const TABS = { ride: 'Ride', garage: 'Garage', rider: 'Rider' }
type Tab = keyof typeof TABS
const current = (): Tab => {
  const t = location.hash.slice(1)
  return t in TABS ? (t as Tab) : 'ride'
}

function riderChip(p: Profile, act: HomeActions) {
  const menu = h(
    'div',
    { class: 'menu', hidden: true },
    h('a', { href: '#rider' }, 'Rider profile'),
    h('button', { onclick: act.logout }, 'Log out'),
  )
  const close = (e: Event) => {
    if (!chip.isConnected) document.removeEventListener('click', close)
    else if (!chip.contains(e.target as Node)) menu.hidden = true
  }
  const chip = h(
    'div',
    { class: 'chip' },
    h(
      'button',
      { class: 'chip-btn', 'aria-haspopup': 'menu', onclick: () => (menu.hidden = !menu.hidden) },
      avatar(p.name),
      h(
        'span',
        { class: 'who' },
        h('b', {}, p.name),
        h('small', {}, scrapIcon(), ` ${p.scrap} scrap`),
      ),
      h('span', { class: 'caret' }, '▾'),
    ),
    menu,
  )
  document.addEventListener('click', close)
  return chip
}

/** Every non-ride screen: top bar plus the current tab. */
export function showHome(p: Profile, act: HomeActions) {
  setSimFtp(p.ftp)
  listen()
  let bar: HTMLElement | undefined
  const render = () => {
    if (bar && !bar.isConnected) return
    const tab = current()
    const body =
      tab === 'garage' ? garageTab(p, render) : tab === 'rider' ? riderTab(p) : rideTab(act)
    bar = h(
      'header',
      { class: 'top' },
      h('a', { href: '#ride', class: 'home-link' }, logo()),
      h(
        'nav',
        { class: 'tabs' },
        ...Object.entries(TABS).map(([k, v]) =>
          h('a', { href: `#${k}`, class: k === tab ? 'on' : '' }, v),
        ),
      ),
      h('div', { class: 'right' }, trainerPill(), riderChip(p, act)),
    )
    show(bar, h('main', { class: 'page' }, body))
  }
  render()
  onhashchange = render
}
