import { CFG } from '../config'
import { settings } from '../core/settings'
import { h } from './dom'
import { hudSizeRow } from './hudSize'

/** One HUD unit in px right now: the `--u` of rideHud.css (1% of the height, 6 to 18 px, times the display size). */
export const hudUnit = () => Math.max(6, Math.min(18, innerHeight / 100)) * (settings.hudScale || 1)

/** A number with its unit small after it. */
export const hudVal = (cls: string, unit: string, lead = '') => {
  const v = h('b', {}, '–')
  return { v, el: h('span', { class: `hv ${cls}` }, lead, v, h('small', {}, unit)) }
}

/** One row of the stats drawer. */
export const hudStat = (label: string) => {
  const v = h('b', {}, '–')
  return { v, el: h('div', {}, h('span', {}, label), v) }
}

/** The ☰ menu every ride HUD has, bottom left: a glass sheet of rarely-used controls that shuts when one is picked. */
export function hudMenu() {
  const el = h('div', { class: 'glass hmenu' })
  el.hidden = true
  const close = () => (el.hidden = true)
  return {
    el,
    close,
    button: h(
      'button',
      { class: 'glass', 'aria-label': 'Menu', onclick: () => (el.hidden = !el.hidden) },
      '☰',
    ),
    /** A menu button showing its key; picking it shuts the menu. */
    item: (label: string | Node, key: string, act: () => void, cls = '') =>
      h(
        'button',
        { class: cls, onclick: () => (close(), act()) },
        label,
        key ? h('kbd', {}, key) : '',
      ),
    grid: (...items: Node[]) => h('div', { class: 'menu-grid' }, ...items),
    size: hudSizeRow,
  }
}

/** A short message, top centre, one at a time. A long one (a fanfare) is not talked over by a passing remark. */
export function hudToast() {
  const el = h('div', { class: 'fr-toast', role: 'status' })
  let timer = 0
  let fanfareUntil = 0
  return {
    el,
    show(text: string, secs = CFG.hud.toastS) {
      const big = secs > CFG.hud.toastS
      if (!big && performance.now() < fanfareUntil) return
      fanfareUntil = big ? performance.now() + secs * 1000 : 0
      el.textContent = text
      el.classList.add('on')
      el.classList.toggle('big', big)
      clearTimeout(timer)
      timer = window.setTimeout(() => el.classList.remove('on'), secs * 1000)
    },
  }
}
