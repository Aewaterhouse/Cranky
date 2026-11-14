import { buy, COSMETICS, equip, SLOT_NAMES, type Cosmetic, type Slot } from '../core/cosmetics'
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
export function garageTab(p: Profile, changed: () => void) {
  const item = (c: Cosmetic) => {
    const owned = p.owned.includes(c.id)
    const on = p.look[c.slot] === c.id
    const short = c.price - p.scrap
    const act = () => {
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
        on ? 'Equipped' : owned ? 'Owned' : h('span', {}, scrapIcon(), ` ${c.price}`),
      ),
      h(
        'button',
        { class: owned ? 'ghost' : 'primary', disabled: !owned && short > 0, onclick: act },
        owned ? (on ? 'Take off' : 'Equip') : short > 0 ? `Need ${short} more` : 'Buy',
      ),
    )
  }
  const slots = Object.keys(SLOT_NAMES) as Slot[]
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
        h('small', {}, 'Earned on crew rides, plus a bonus per award'),
      ),
    ),
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
