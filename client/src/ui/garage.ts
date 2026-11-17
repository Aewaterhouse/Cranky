import { COSMETICS, equip, SLOT_NAMES, type Cosmetic, type Slot } from '../core/cosmetics'
import type { Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { h } from './dom'
import { portrait, shopPreview } from './shopPreview'
import { modal } from './toast'

const ICON: Partial<Record<Slot, string>> = { bullbar: '🦘', spikes: '🔱', bike: '🚲', horn: '📯' }
/** Each horn its own picture. */
const HORN_ICON: Record<string, string> = {
  'horn-cow': '🐄',
  'horn-didge': '🪃',
  'horn-cucaracha': '🎺',
  'horn-roadtrain': '🚛',
}
const WHERE: Record<Slot, string> = {
  paint: 'On the bus when you drive',
  bullbar: 'On the bus when you drive',
  spikes: 'On the bus when you drive',
  hat: 'On your rider',
  outfit: 'On your rider',
  bike: 'Your bike, on the bus and out on the road',
  horn: 'Your 📯 on the bus: everyone hears it',
}

/** Cosmetics grouped by slot, every one free to wear. `changed` re-renders the shell. */
export function garageTab(p: Profile, changed: () => void) {
  const item = (c: Cosmetic) => {
    const on = p.look[c.slot] === c.id
    const act = () => {
      Object.assign(p, equip(p, c.id))
      saveProfile(p)
      changed()
    }
    const sw = h(
      'div',
      { class: 'sw', style: c.colour ? `--sw:${c.colour}` : '' },
      c.colour ? '' : (HORN_ICON[c.id] ?? ICON[c.slot] ?? '★'),
    )
    // A horn has nothing to show on the rider: it keeps its 📯.
    if (c.slot !== 'horn')
      shopPreview(c, { id: p.id, body: p.look.body }, (src) =>
        sw.replaceChildren(h('img', { src, alt: '' })),
      )
    // Rider items: tap the picture to see it on you, with everything else you wear.
    if (c.slot === 'hat' || c.slot === 'outfit' || c.slot === 'bike') {
      sw.title = 'Try it on'
      sw.classList.add('try')
      sw.onclick = () =>
        portrait({ id: p.id, look: { ...p.look, [c.slot]: c.id } }, (src) =>
          modal(c.name, h('img', { class: 'try-on', src, alt: `You in the ${c.name}` })),
        )
    }
    return h(
      'div',
      { class: `item ${c.rarity}${on ? ' on' : ''}` },
      sw,
      h('b', {}, c.name),
      h('span', { class: `rarity ${c.rarity}` }, c.rarity),
      h('span', { class: 'meta' }, on ? 'Equipped' : ''),
      h('button', { class: on ? 'ghost' : 'primary', onclick: act }, on ? 'Take off' : 'Equip'),
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
        h('p', { class: 'lede' }, 'Paint and parts, free to wear. The crew sees what you wear.'),
      ),
    ),
    // Shelf chips: jump straight to a slot instead of scrolling the whole shop.
    h(
      'nav',
      { class: 'chips garage-shelves' },
      ...slots.map((s) =>
        h(
          'button',
          {
            class: 'chip-sel',
            onclick: () =>
              document.getElementById(`shelf-${s}`)?.scrollIntoView({ behavior: 'smooth' }),
          },
          SLOT_NAMES[s],
        ),
      ),
    ),
    ...slots.map((s) =>
      h(
        'section',
        { class: 'slot', id: `shelf-${s}` },
        h('h2', { class: 'label' }, SLOT_NAMES[s], h('small', {}, WHERE[s])),
        h('div', { class: 'shopgrid' }, ...COSMETICS.filter((c) => c.slot === s).map(item)),
      ),
    ),
  )
}
