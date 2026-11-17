import type { ShopItem } from '../net/protocol'
import { h } from './dom'
import { pulse } from './hudKit'

const ITEMS: { id: ShopItem; icon: string; name: string; desc: string }[] = [
  { id: 'plating', icon: '🛡️', name: 'Armour plating', desc: '+25 armour, bolted on now' },
  { id: 'repellent', icon: '🧴', name: 'Horde repellent', desc: 'Cancels the next hit' },
  { id: 'sync', icon: '🔧', name: 'Wider sync window', desc: '+3 rpm engine tolerance' },
  { id: 'nitro', icon: '🧨', name: 'Can of nitro', desc: 'Fires the nitro straight away' },
  { id: 'ram', icon: '🐏', name: 'Bull-bar ram', desc: 'Next roadblock takes half as much again' },
]

/** Servo Stop shop: the stop's three upgrade cards (of five), one free pick, plus a "who took what" feed. Closes to a small bar until the next stop. */
export function makeShop(buy: (item: ShopItem) => void) {
  let shut = false
  const exit = h('button', { class: 'sh-x', 'aria-label': 'Close the shop' }, '✕ Close')
  const fold = () => {
    root.classList.toggle('mini', shut)
    exit.textContent = shut ? 'Open shop' : '✕ Close'
  }
  exit.onclick = () => ((shut = !shut), fold())
  const log = h('div', { class: 'sh-log' })
  const cards = ITEMS.map((it) => {
    const btn = h(
      'button',
      {
        class: 'sh-card',
        onclick: () => {
          buy(it.id)
          pulse(btn, 'bought')
        },
      },
      h('span', { class: 'sh-ico' }, it.icon),
      h('b', {}, it.name),
      h('span', { class: 'sh-desc' }, it.desc),
    )
    return { it, btn }
  })
  const root = h(
    'section',
    { class: 'hud-glass sh' },
    h(
      'div',
      { class: 'sh-head' },
      h('span', {}, '⛽ SERVO SHOP'),
      h('span', {}, 'ONE FREE PICK'),
      exit,
    ),
    h('div', { class: 'sh-cards' }, ...cards.map((c) => c.btn)),
    log,
  )
  root.hidden = true
  return {
    root,
    update(open: boolean, wares?: ShopItem[]) {
      root.hidden = !open
      if (!open) {
        shut = false // the next servo stop opens it again
        return fold()
      }
      for (const { it, btn } of cards) btn.hidden = !!wares && !wares.includes(it.id)
    },
    bought(text: string) {
      log.prepend(h('div', {}, text))
      while (log.children.length > 3) log.lastElementChild!.remove()
    },
  }
}
