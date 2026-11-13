import '../hudMad.css'
import type { MadState, RiderTick } from '../net/protocol'
import { avatar, h } from './dom'
import { hrColour, set } from './hudKit'

/** Twist names and blurbs; mirrors MAD_TWISTS in the server config. */
export const TWISTS: Record<string, [string, string]> = {
  double: ['Double Points', 'Everything scores twice.'],
  redline: ['Redline Bonus', 'Extra points every second over 90% of max.'],
  sync: ['Hive Mind', 'Match cadence as a pack for half as much again.'],
  underdog: ['Underdog', 'Last place scores triple.'],
  tax: ['Leader Tax', 'First place scores half.'],
}
const SPIN_MS = 2600

interface Row {
  root: HTMLElement
  rank: HTMLElement
  pts: HTMLElement
  hr: HTMLElement
  fill: HTMLElement
  red: HTMLElement
}

/** VO2 Madness panel: mystery box, twist and the effort leaderboard (heart rate front and centre). */
export function makeMadPanel(deck: string[]) {
  const round = h('span', { class: 'bs-sync-s' })
  const boxName = h('b', {}, '❓')
  const twist = h('div', { class: 'md-twist' })
  const box = h('div', { class: 'md-box' }, h('span', {}, '🎁'), boxName)
  const list = h('div', { class: 'md-list' })
  const root = h(
    'section',
    { class: 'hud-glass md' },
    h('div', { class: 'bs-head' }, h('label', {}, 'MYSTERY BOX'), round),
    box,
    twist,
    h('div', { class: 'bs-head' }, h('label', {}, "WHO'S TRYING HARDEST")),
    list,
  )
  const rows = new Map<string, Row>()
  let spinning = 0
  let timer = 0
  return {
    root,
    /** Spins the box through the deck, then lands on `name`. */
    spin(name: string) {
      clearInterval(timer)
      spinning = performance.now() + SPIN_MS
      box.dataset.s = 'spin'
      timer = window.setInterval(() => {
        if (performance.now() < spinning)
          return set(boxName, deck[Math.floor(Math.random() * deck.length)] ?? '❓')
        clearInterval(timer)
        spinning = 0
        box.dataset.s = 'landed'
        set(boxName, name)
      }, 90)
    },
    update(m: MadState, riders: Record<string, RiderTick>, meId: string) {
      set(round, m.rounds ? `ROUND ${Math.max(1, m.round)} / ${m.rounds}` : '')
      if (m.work && spinning) {
        clearInterval(timer)
        spinning = 0
      }
      if (!spinning) {
        const name = m.work ? 'GO GO GO' : (m.next ?? (m.box ? '❓ ❓ ❓' : '—'))
        box.dataset.s = m.work ? 'go' : m.next ? 'landed' : ''
        set(boxName, name)
      }
      const tw = m.twist ? TWISTS[m.twist] : null
      twist.hidden = !tw
      if (tw) twist.replaceChildren(h('b', {}, `🌀 ${tw[0]}`), h('span', {}, tw[1]))
      const order = Object.keys(riders).sort((a, b) => (m.pts[b] ?? 0) - (m.pts[a] ?? 0))
      order.forEach((id, i) => {
        const r = riders[id]
        let row = rows.get(id)
        if (!row) {
          const rank = h('span', { class: 'md-rank' })
          const pts = h('b', { class: 'md-pts' })
          const hr = h('span', { class: 'md-hr' })
          const fill = h('i', {})
          const red = h('small', {})
          row = {
            root: h(
              'div',
              { class: `md-row${id === meId ? ' me' : ''}` },
              rank,
              avatar(r.name),
              h(
                'div',
                { class: 'md-mid' },
                h('div', { class: 'md-name' }, h('span', {}, r.name), hr),
                h('div', { class: 'md-bar' }, fill),
                red,
              ),
              pts,
            ),
            rank,
            pts,
            hr,
            fill,
            red,
          }
          rows.set(id, row)
        }
        if (list.children[i] !== row.root) list.insertBefore(row.root, list.children[i] ?? null)
        const on = r.st === 'riding'
        row.root.dataset.crown = id === m.crown ? '1' : ''
        row.root.dataset.st = r.st
        set(row.rank, id === m.crown ? '👑' : `${i + 1}`)
        set(row.pts, `${m.pts[id] ?? 0}`)
        set(row.hr, on && r.hr ? `♥ ${r.hr}${r.hrp ? ` · ${Math.round(r.hrp * 100)}%` : ''}` : '')
        row.hr.style.color = hrColour(r.hrp)
        row.fill.style.width = `${on ? Math.min(100, Math.round((r.hrp ?? 0) * 100)) : 0}%`
        row.fill.style.background = hrColour(r.hrp) || 'var(--dim)'
        set(row.red, m.red[id] ? `${m.red[id]} s in the red` : on && !r.hrp ? 'no heart rate' : '')
      })
      for (const [id, row] of rows)
        if (!riders[id]) {
          row.root.remove()
          rows.delete(id)
        }
    },
  }
}
