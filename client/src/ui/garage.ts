import { CFG } from '../config'
import {
  buy,
  COSMETICS,
  cosmetic,
  equip,
  priceOf,
  SLOT_NAMES,
  weeklyDeal,
  type Cosmetic,
  type Slot,
} from '../core/cosmetics'
import type { Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { h } from './dom'
import { shopPreview } from './shopPreview'
import { toast } from './toast'

const ICON: Partial<Record<Slot, string>> = { bullbar: '🦘', spikes: '🔱', bike: '🚲' }
const WHERE: Record<Slot, string> = {
  paint: 'On the bus when you drive',
  bullbar: 'On the bus when you drive',
  spikes: 'On the bus when you drive',
  hat: 'On your rider',
  outfit: 'On your rider',
  bike: 'Your bike, on the bus and out on the road',
}

export const scrapIcon = () => h('span', { class: 'scrap-ico', 'aria-hidden': 'true' }, '⚙')

/** Cosmetics shop grouped by slot. `changed` re-renders the shell so the balance updates. */
let armed = ''
let lockUntil = 0

export function garageTab(p: Profile, changed: () => void) {
  const item = (c: Cosmetic) => {
    const owned = p.owned.includes(c.id)
    const on = p.look[c.slot] === c.id
    const price = priceOf(c)
    const short = price - p.scrap
    const act = (e: Event) => {
      // Buying takes two taps (Buy, then Confirm), and a fresh purchase ignores taps for a moment, so a double
      // tap can never buy something and take it off again.
      if (performance.now() < lockUntil) return
      if (!owned && armed !== c.id) {
        armed = c.id
        ;(e.target as HTMLElement).textContent = `Confirm ⚙ ${price}`
        setTimeout(() => armed === c.id && ((armed = ''), changed()), CFG.garage.confirmMs)
        return
      }
      armed = ''
      if (!owned) lockUntil = performance.now() + CFG.garage.lockMs
      const r = owned ? equip(p, c.id) : buy(p, c.id)
      if (typeof r === 'string') return toast(r, 'bad')
      if (!owned) toast(`Bought ${c.name}`, 'good')
      Object.assign(p, r)
      saveProfile(p)
      changed()
    }
    const sw = h(
      'div',
      { class: 'sw', style: c.colour ? `--sw:${c.colour}` : '' },
      c.colour ? '' : (ICON[c.slot] ?? '★'),
    )
    shopPreview(c, { id: p.id, body: p.look.body }, (src) =>
      sw.replaceChildren(h('img', { src, alt: '' })),
    )
    return h(
      'div',
      { class: `item ${c.rarity}${on ? ' on' : owned ? ' owned' : ''}` },
      sw,
      h('b', {}, c.name),
      h('span', { class: `rarity ${c.rarity}` }, c.rarity),
      h(
        'span',
        { class: 'meta' },
        on
          ? 'Equipped'
          : owned
            ? 'Owned'
            : h(
                'span',
                {},
                scrapIcon(),
                ` ${price}`,
                price < c.price ? h('s', { class: 'dim' }, ` ${c.price}`) : '',
              ),
      ),
      !owned && short > 0
        ? h(
            'div',
            { class: 'need-bar', title: `${p.scrap} of ${price} scrap` },
            h('i', { style: `width:${Math.round((p.scrap / price) * 100)}%` }),
            h('span', {}, `${short} to go`),
          )
        : h(
            'button',
            { class: owned ? 'ghost' : 'primary', onclick: act },
            owned ? (on ? 'Take off' : 'Equip') : 'Buy',
          ),
    )
  }
  const slots = Object.keys(SLOT_NAMES) as Slot[]
  // The dearest things you can buy right now, one per slot.
  const treats = slots
    .map(
      (s) =>
        COSMETICS.filter(
          (c) => c.slot === s && priceOf(c) <= p.scrap && !p.owned.includes(c.id),
        ).sort((a, b) => b.price - a.price)[0],
    )
    .filter((c) => c)
    .slice(0, 4)
  return h(
    'div',
    { class: 'garage' },
    h(
      'section',
      { class: 'bank' },
      h(
        'div',
        {},
        h('h1', {}, 'Garage'),
        h('p', { class: 'lede' }, 'Spend scrap on paint and parts. The crew sees what you wear.'),
      ),
      h(
        'div',
        { class: 'balance' },
        scrapIcon(),
        h('b', {}, String(p.scrap)),
        h('span', {}, 'scrap'),
        h('small', {}, 'Earned on every ride of 10 minutes or more, plus a bonus per award'),
      ),
    ),
    h(
      'section',
      { class: 'slot' },
      h(
        'h2',
        { class: 'label' },
        'Deal of the week',
        h('small', {}, `${Math.round(CFG.garage.dealOff * 100)}% off until Monday`),
      ),
      h('div', { class: 'shopgrid' }, item(cosmetic(weeklyDeal())!)),
    ),
    treats.length
      ? h(
          'section',
          { class: 'slot' },
          h('h2', { class: 'label' }, 'Treat yourself', h('small', {}, 'You can afford these now')),
          h('div', { class: 'shopgrid' }, ...treats.map(item)),
        )
      : '',
    ...slots.map((s) =>
      h(
        'section',
        { class: 'slot' },
        h('h2', { class: 'label' }, SLOT_NAMES[s], h('small', {}, WHERE[s])),
        h('div', { class: 'shopgrid' }, ...COSMETICS.filter((c) => c.slot === s).map(item)),
      ),
    ),
  )
}
