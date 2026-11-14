import '../hudDate.css'
import type { DateState, RiderTick, Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'
import { set, type EventStyle } from './hudKit'

export const DATE_EVENTS: Record<string, EventStyle> = {
  bar: { name: 'The Bar', icon: '🍸', col: '#5aa9e6' },
  date: { name: 'Date', icon: '💘', col: '#ff5a8a' },
  gap: { name: 'Next Table', icon: '🔔', col: '#44bba4' },
  proposal: { name: 'The Proposal', icon: '💍', col: '#ffd23f' },
  wedding: { name: 'The Wedding', icon: '💒', col: '#ffd23f' },
  divorce: { name: 'The Divorce', icon: '⚖️', col: '#e040fb' },
  cool: { name: 'The Group Chat', icon: '📱', col: '#44bba4' },
}
const SAID_S = 6

/** Where a rider sits against their own band: 0 at its bottom, 1 at its top (so two riders compare fairly). */
export function inBandPos(r: RiderTick | undefined): number | null {
  const b = r?.band
  if (!r || !Array.isArray(b) || b[1] <= b[0]) return null
  return (r.w - b[0]) / (b[1] - b[0])
}
const left = (p: number | null) => `${Math.min(100, Math.max(0, 25 + (p ?? 0.5) * 50))}%`

/** Speed Dating panel: your date, both of you against the band, the chemistry, emoji and the couples table. */
export function makeDatePanel(act: (k: string, v: string) => void): GamePanel {
  const head = h('span', { class: 'bs-sync-s' })
  const theme = h('div', { class: 'dt-theme' })
  const who = h('b', {})
  const prof = h('div', { class: 'am-line' })
  const said = h('span', { class: 'dt-said' })
  const me = h('i', { class: 'dt-me' }, '▼')
  const them = h('i', { class: 'dt-them' }, '▲')
  const track = h('div', { class: 'dt-track' }, h('i', { class: 'dt-band' }), me, them)
  const chemN = h('b', { class: 'bs-n' })
  const chem = h('i', {})
  const card = h('div', { class: 'am-event' })
  const tray = h('div', { class: 'dt-tray' })
  const table = h('div', { class: 'dt-table' })
  const chat = h('div', { class: 'dt-chat' })
  const dating = h(
    'div',
    {},
    h('div', { class: 'am-patient' }, said, h('div', {}, who, prof)),
    track,
    h('div', { class: 'bs-head' }, h('label', {}, 'CHEMISTRY'), chemN),
    h('div', { class: 'bs-bar dt-chem' }, chem),
  )
  const root = h(
    'section',
    { class: 'hud-glass am dt' },
    h('div', { class: 'bs-head' }, h('label', {}, 'SPEED DATING'), head),
    theme,
    dating,
    card,
    tray,
    table,
    chat,
  )
  let trayKey = ''
  return {
    root,
    update(m: Tick, meId: string) {
      const g = m.game as unknown as DateState | null | undefined
      if (g?.g !== 'date') return
      const name = (id: string) => m.riders[id]?.name ?? '?'
      root.dataset.phase = g.phase
      set(head, g.phase === 'date' || g.phase === 'gap' ? `DATE ${g.n} / ${g.of}` : '')
      set(theme, g.theme ? `${g.theme.icon} ${g.theme.name}: ${g.theme.text}` : '')
      const pair = g.pairs.find((p) => p[0] === meId || p[1] === meId)
      const other = pair ? (pair[0] === meId ? pair[1] : pair[0]) : null
      const chap = g.chap === meId
      dating.hidden = !other && !chap
      track.hidden = !other
      if (other && pair) {
        set(who, name(other))
        set(prof, g.profiles[other] ? `“${g.profiles[other]}”` : '')
        const s = g.said[other]
        set(said, s && m.el - s[1] < SAID_S ? s[0] : '🚴')
        me.style.left = left(inBandPos(m.riders[meId]))
        them.style.left = left(inBandPos(m.riders[other]))
        const c = Math.round(pair[2] * 100)
        set(chemN, `${c}% · ${Math.round(pair[3])} pts`)
        chem.style.width = `${c}%`
      } else if (chap) {
        set(who, 'You are the Chaperone')
        set(prof, 'Play your cards. You score what the couples lose.')
        set(said, '👀')
        set(chemN, '')
        chem.style.width = '0%'
      }
      const c = g.card
      card.hidden = !c
      if (c) {
        card.dataset.s = c.who.includes(meId) ? 'me' : 'on'
        card.replaceChildren(
          h('b', {}, `🃏 ${c.name}`, h('span', {}, `${Math.ceil(c.left)} s`)),
          h('span', {}, `${c.who.map(name).join(' and ')}: ${c.text}`),
        )
      }
      const n = g.emojiLeft[meId] ?? 0
      tray.hidden = !other || g.phase !== 'date'
      const key = `${g.emoji.join('')}|${n}`
      if (key !== trayKey) {
        trayKey = key
        tray.replaceChildren(
          ...g.emoji.map((e) =>
            h('button', { disabled: n <= 0, onclick: () => act('emoji', e) }, e),
          ),
          h('small', {}, `${n} left`),
        )
      }
      table.replaceChildren(
        ...g.table.slice(0, 3).map((r, i) => {
          const mine = r.a === meId || r.b === meId
          const tag =
            g.couple && g.couple.includes(r.a) && g.couple.includes(r.b)
              ? ' 💍'
              : g.exes && g.exes.includes(r.a) && g.exes.includes(r.b)
                ? ' 💔'
                : ''
          return h(
            'div',
            { class: `dt-row${mine ? ' me' : ''}` },
            h('span', {}, `${i + 1}. ${name(r.a)} + ${name(r.b)}${tag}`),
            h('b', {}, `${Math.round(r.pts)}`),
          )
        }),
      )
      if (g.tandem)
        set(
          theme,
          `💒 Tandem: ${Math.round(g.tandem.w)} W of ${Math.round(g.tandem.tgt)} W together`,
        )
      if (g.tug != null && g.exes) {
        const lead = g.tug < 0 ? g.exes[0] : g.exes[1]
        set(
          theme,
          `⚖️ Tug of war: ${name(lead)} is ${Math.round(Math.abs(g.tug) * 100)}% of the way to the house`,
        )
      }
      chat.hidden = !g.chat.length
      chat.replaceChildren(...g.chat.slice(-6).map((l) => h('p', {}, l)))
    },
    fx(fx, sp) {
      const t = fx.text ?? ''
      if (fx.k === 'match') sp.splash('sp-smash', '💘 IT’S A MATCH', t, 2600, 1)
      else if (fx.k === 'card') sp.splash('sp-fell', '🃏 CHAPERONE!', t, 2600, 2)
      else if (fx.k === 'engaged') sp.splash('sp-smash', '💍 ENGAGED', t, 4000, 3)
      else if (fx.k === 'married') sp.splash('sp-smash', '💒 JUST MARRIED', t, 4000, 3)
      else if (fx.k === 'divorced') sp.splash('sp-fell', '⚖️ DIVORCED', t, 4000, 3)
    },
  }
}
