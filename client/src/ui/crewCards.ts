import { CFG } from '../config'
import { h } from './dom'
import { compColour, hrColour, set } from './hudKit'
import '../crewCards.css'

/** One rider as a card shows them. Any mode can fill it in; what a mode does not know stays unset. */
export interface CardRider {
  id: string
  name: string
  /** Tier letter shown beside the name, if the mode has tiers. */
  tier?: string
  /** 3 s watts. */
  w: number
  st: 'riding' | 'fell' | 'spectator' | 'away'
  /** Compliance 0..1, or null in a block with no target; unset hides the bar. */
  s?: number | null
  /** What the bar shows instead of compliance (a fall countdown, "watching", a gap). */
  note?: string
  hr?: number | null
  hrp?: number | null
  /** ERG on (true) or gears (false); unset shows no marker. */
  erg?: boolean
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
  const root = h('div', { class: `glass ccol ${cls}` }, list)
  const cards = new Map<string, Card>()
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
    )
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
      }
      const ids = new Set(riders.map((r) => r.id))
      for (const [id, c] of cards)
        if (!ids.has(id)) {
          c.root.remove()
          cards.delete(id)
        }
    },
  }
}
