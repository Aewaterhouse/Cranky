import { CFG } from '../config'
import { cardLines, type CardNumbers } from '../core/crewStats'
import { saveSettings, settings } from '../core/settings'
import { h } from './dom'
import { compColour, hrColour, set } from './hudKit'
import '../crewCards.css'

/** One rider as a card shows them. Any mode can fill it in; what a mode does not know stays unset. */
export interface CardRider extends CardNumbers {
  id: string
  name: string
  /** Tier letter shown beside the name, if the mode has tiers. */
  tier?: string
  st: 'riding' | 'fell' | 'spectator' | 'away'
  /** Compliance 0..1, or null in a block with no target; unset hides the bar. */
  s?: number | null
  /** What the bar shows instead of compliance (a fall countdown, "watching", a gap). */
  note?: string
  /** Share of the crew's watts right now, and whether this rider is carrying the crew. */
  share?: number
  carrier?: boolean
}

interface Card {
  root: HTMLElement
  tier: HTMLElement
  mode: HTMLElement
  w: HTMLElement
  share: HTMLElement
  hr: HTMLElement
  bar: HTMLElement
  fill: HTMLElement
  note: HTMLElement
  more: HTMLElement
}

/** An open card's numbers: right now, then this ride, and on my card a nudge to set a weight. */
function fill(el: HTMLElement, r: CardRider, me: boolean) {
  const { now, ride, hint } = cardLines(r, me)
  const block = (title: string, rows: [string, string][]) => [
    h('h4', {}, title),
    ...rows.map(([k, v]) => h('div', { class: 'cc-row' }, h('span', {}, k), h('b', {}, v))),
  ]
  el.replaceChildren(
    ...block('Now', now),
    ...block('This ride', ride),
    ...(hint ? [h('p', { class: 'cc-hint' }, 'Add your weight in Rider → Settings')] : []),
  )
}

const short = (n: string) =>
  n.length > CFG.hud.cards.nameChars ? `${n.slice(0, CFG.hud.cards.nameChars - 1)}…` : n

/**
 * The crew as a narrow column of cards down the right edge: name and tier, 3 s watts and share, heart rate,
 * a compliance bar and an ERG or gear marker. Mine is first and highlighted; the rest keep the order they
 * arrived in. Cards are kept and patched in place.
 */
export function crewCards(cls = '') {
  const list = h('div', { class: 'cc-list' })
  const all = h('button', {
    class: 'cc-all',
    title: 'Open or close every card (D)',
    onclick: () => toggleAll(),
  })
  const root = h('div', { class: `glass ccol ${cls}` }, all, list)
  const cards = new Map<string, Card>()
  // Which cards are open, kept on this device by rider id.
  const open = new Set(settings.cardsOpen)
  const keep = () => saveSettings({ cardsOpen: [...open] })
  const paint = () => {
    for (const [id, c] of cards) c.root.classList.toggle('open', open.has(id))
    const every = cards.size > 0 && [...cards.keys()].every((id) => open.has(id))
    set(all, every ? '▴ Close all' : '▾ Open all')
  }
  const flip = (id: string) => {
    if (!open.delete(id)) open.add(id)
    keep()
    paint()
  }
  const toggleAll = () => {
    const every = [...cards.keys()].every((id) => open.has(id))
    for (const id of cards.keys()) {
      if (every) open.delete(id)
      else open.add(id)
    }
    keep()
    paint()
  }
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) return removeEventListener('keydown', onKey)
    const typing = e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.tagName === 'INPUT'
    if (!typing && !e.repeat && e.key.toLowerCase() === 'd') toggleAll()
  }
  addEventListener('keydown', onKey)
  const build = (r: CardRider, me: boolean): Card => {
    const c = {
      tier: h('small', { class: 'cc-tier' }),
      mode: h('span', { class: 'cc-mode' }),
      w: h('b', { class: 'cc-w' }),
      share: h('small', { class: 'cc-share' }),
      hr: h('span', { class: 'cc-hr' }),
      fill: h('i', {}),
      note: h('span', { class: 'cc-note' }),
    } as Card
    c.bar = h('div', { class: 'cc-bar' }, c.fill, c.note)
    c.root = h(
      'div',
      { class: `ccard${me ? ' me' : ''}` },
      h(
        'div',
        { class: 'cc-top' },
        h('span', { class: 'cc-name', title: r.name }, short(r.name)),
        c.tier,
        c.mode,
      ),
      h('div', { class: 'cc-mid' }, c.w, c.share, c.hr),
      c.bar,
      (c.more = h('div', { class: 'cc-more' })),
    )
    c.root.onclick = () => flip(r.id)
    return c
  }
  return {
    root,
    list,
    cards,
    update(riders: CardRider[], meId: string) {
      for (const r of riders) {
        let c = cards.get(r.id)
        if (!c) {
          c = build(r, r.id === meId)
          cards.set(r.id, c)
          if (r.id === meId) list.prepend(c.root)
          else list.append(c.root)
        }
        c.root.dataset.st = r.st
        set(c.tier, r.tier ?? '')
        c.tier.hidden = !r.tier
        set(c.mode, r.erg == null ? '' : r.erg ? 'ERG' : '⚙')
        c.mode.title = r.erg == null ? '' : r.erg ? 'On ERG' : 'Riding on gears'
        const on = r.st === 'riding'
        set(c.w, on ? `${r.carrier ? '💪' : ''}${Math.round(r.w)} W` : '–')
        c.w.title = r.carrier ? 'Carrying the crew' : '3 s watts'
        set(c.share, on && r.share != null ? `${Math.round(r.share * 100)}%` : '')
        c.share.title = "Share of the crew's watts"
        set(c.hr, r.hr && r.st !== 'spectator' ? `♥${r.hr}` : '')
        c.hr.style.color = hrColour(r.hrp)
        c.bar.hidden = r.s === undefined && !r.note
        c.fill.style.width = `${Math.round(Math.min(1, r.s ?? 0) * 100)}%`
        c.fill.style.background = compColour(r.s)
        set(c.note, r.note ?? (r.s == null ? 'free' : `${Math.round(r.s * 100)}%`))
        c.note.style.color = r.st === 'fell' ? 'var(--bad)' : ''
        if (open.has(r.id)) fill(c.more, r, r.id === meId)
      }
      const ids = new Set(riders.map((r) => r.id))
      for (const [id, c] of cards)
        if (!ids.has(id)) {
          c.root.remove()
          cards.delete(id)
        }
      paint()
    },
    toggleAll,
  }
}
