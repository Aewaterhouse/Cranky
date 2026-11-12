import type { ShopItem } from '../net/protocol'
import { h } from './dom'
import { pulse, set } from './hudKit'

const ITEMS: { id: ShopItem; icon: string; name: string; desc: string; cost: number }[] = [
  {
    id: 'plating',
    icon: '🛡️',
    name: 'Armour plating',
    desc: '+25 armour, bolted on now',
    cost: 40,
  },
  { id: 'repellent', icon: '🧴', name: 'Horde repellent', desc: 'Cancels the next hit', cost: 60 },
  { id: 'sync', icon: '🔧', name: 'Wider sync window', desc: '+3 rpm engine tolerance', cost: 50 },
]

/** Servo Stop shop: three upgrade cards plus a "who bought what" feed. */
export function makeShop(buy: (item: ShopItem) => void) {
  const scrapN = h('b', {}, '0')
  const log = h('div', { class: 'sh-log' })
  const cards = ITEMS.map((it) => {
    const need = h('span', { class: 'sh-need' })
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
      h('span', { class: 'sh-cost' }, `⚙ ${it.cost}`),
      need,
    )
    return { it, btn, need }
  })
  const root = h(
    'section',
    { class: 'hud-glass sh' },
    h(
      'div',
      { class: 'sh-head' },
      h('span', {}, '⛽ SERVO SHOP'),
      h('span', {}, 'BUS SCRAP ', scrapN),
    ),
    h('div', { class: 'sh-cards' }, ...cards.map((c) => c.btn)),
    log,
  )
  root.hidden = true
  return {
    root,
    update(open: boolean, scrap: number) {
      root.hidden = !open
      if (!open) return
      set(scrapN, `${scrap}`)
      for (const { it, btn, need } of cards) {
        btn.disabled = scrap < it.cost
        set(need, scrap < it.cost ? `need ${it.cost - scrap} more` : 'tap to buy')
      }
    },
    bought(text: string) {
      log.prepend(h('div', {}, text))
      while (log.children.length > 3) log.lastElementChild!.remove()
    },
  }
}
