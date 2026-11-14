import '../hudAmbo.css'
import type { AmboState, Fx, Tick } from '../net/protocol'
import type { GamePanel } from './hud'
import { h, stars } from './dom'
import { set, type EventStyle } from './hudKit'
import type { makeSplash } from './hudSplash'

export const AMBO_EVENTS: Record<string, EventStyle> = {
  base: { name: 'Base Station', icon: '🥧', col: '#5aa9e6' },
  run: { name: 'Patient On Board', icon: '🚑', col: '#ff5a4e' },
  ramp: { name: 'Hospital Ramping', icon: '🏥', col: '#44bba4' },
  reverse: { name: 'Reversing', icon: '🔙', col: '#e040fb' },
  cool: { name: 'Drive Home', icon: '🌇', col: '#44bba4' },
}
const EVENT_ICON: Record<string, string> = { green: '🟢', roadworks: '🚧', hump: '〰️', siren: '🚨' }
const PERKS: Record<string, string> = {
  spike: '🎁 One free spike',
  green: '🎁 Green wave next run',
}
const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`

/** Kidney Stone Express panel: the patient, their Comfort, the road to the hospital and whatever is in the way. */
export function makeAmboPanel(): GamePanel {
  const run = h('span', { class: 'bs-sync-s' })
  const face = h('span', { class: 'am-face' })
  const name = h('b', {})
  const line = h('div', { class: 'am-line' })
  const comfortN = h('b', { class: 'bs-n' })
  const comfort = h('i', {})
  const van = h('i', { class: 'am-van' }, '🚑')
  const road = h('div', { class: 'am-road' }, van, h('i', { class: 'am-hosp' }, '🏥'))
  const km = h('span', {})
  const eta = h('span', {})
  const event = h('div', { class: 'am-event' })
  const perk = h('div', { class: 'am-perk' })
  const last = h('div', { class: 'am-review' })
  const patient = h('div', { class: 'am-patient' }, face, h('div', {}, name, line))
  const root = h(
    'section',
    { class: 'hud-glass am' },
    h('div', { class: 'bs-head' }, h('label', {}, 'KIDNEY STONE EXPRESS'), run),
    patient,
    h('div', { class: 'bs-head' }, h('label', {}, 'COMFORT'), comfortN),
    h('div', { class: 'bs-bar am-comfort' }, comfort),
    road,
    h('div', { class: 'bs-head am-nums' }, km, eta),
    event,
    perk,
    last,
  )
  return {
    root,
    update(m: Tick, meId: string) {
      const g = m.game as AmboState | null | undefined
      if (g?.g !== 'ambo') return
      set(run, g.phase === 'base' || g.phase === 'cool' ? '' : `RUN ${g.run} / ${g.runs}`)
      root.dataset.phase = g.phase
      const p = g.patient
      patient.hidden = !p
      if (p) {
        set(face, p.icon)
        set(name, p.name)
        set(line, p.line ? `“${p.line}”` : '')
      }
      const c = Math.round(g.comfort)
      set(comfortN, `${c}`)
      comfort.style.width = `${c}%`
      comfort.style.background = c > 60 ? 'var(--ok)' : c > 30 ? 'var(--warn)' : 'var(--bad)'
      const onRoad = g.phase === 'run' || g.phase === 'reverse'
      road.hidden = !onRoad
      van.style.left = `${g.total ? Math.min(1, Math.max(0, 1 - g.dist / g.total)) * 88 : 0}%`
      set(km, onRoad ? `${(g.dist / 1000).toFixed(1)} km · ${Math.round(g.speed)} km/h` : '')
      const ahead = Math.round(g.par - (g.eta ?? g.par))
      set(
        eta,
        onRoad && g.eta != null && g.eta < 3600
          ? `ETA ${clock(g.eta)}${Math.abs(ahead) >= 5 ? ` · ${Math.abs(ahead)} s ${ahead > 0 ? 'ahead of' : 'behind'} schedule` : ' · on schedule'}`
          : '',
      )
      const e = g.event
      const mine = !!e?.who && e.who === meId
      const who = e?.who ? (m.riders[e.who]?.name ?? 'Someone') : ''
      event.hidden = !e && !g.brake && g.phase !== 'ramp'
      event.dataset.s = e ? (mine ? 'me' : 'on') : g.brake ? 'brake' : 'ramp'
      if (e)
        event.replaceChildren(
          h('b', {}, `${EVENT_ICON[e.k] ?? '⚠️'} ${e.name}`, h('span', {}, clock(e.left))),
          h(
            'span',
            {},
            e.who
              ? mine
                ? `YOU are the siren. ${e.text}`
                : `${who} is the siren. ${e.text}`
              : e.text,
          ),
        )
      else if (g.brake)
        event.replaceChildren(
          h('b', {}, '🛑 Hospital ahead'),
          h('span', {}, 'Ease off or the patient goes out the back doors.'),
        )
      else if (g.phase === 'ramp') {
        const bar = h('i', {})
        bar.style.width = `${Math.round(g.sweet * 100)}%`
        event.replaceChildren(
          h(
            'b',
            {},
            '☎️ Sweet-talk triage',
            h('span', {}, g.queue ? `queue ${clock(g.queue)}` : ''),
          ),
          h('span', {}, 'Spin easy and fast together for a favour on the next run.'),
          h('div', { class: 'bs-bar' }, bar),
        )
      }
      set(perk, g.perk ? (PERKS[g.perk] ?? '') : '')
      perk.hidden = !g.perk
      const r = g.reviews[g.reviews.length - 1]
      last.hidden = !r
      if (r) set(last, `${r.icon} ${stars(r.stars)} ${r.text}`)
    },
    /** Big moments get a splash; the feed line is left to the HUD. */
    fx(fx: Fx, sp: ReturnType<typeof makeSplash>) {
      const t = fx.text ?? ''
      if (fx.k === 'delivered') sp.splash('sp-smash', '🏥 DELIVERED', t, 3000, 2)
      else if (fx.k === 'fellout') sp.splash('sp-fell', 'OUT THE BACK DOORS!', t, 3600, 3)
      else if (fx.k === 'walked') sp.splash('sp-fell', 'THE PATIENT IS WALKING', t, 3600, 3)
      else if (fx.k === 'review') sp.splash('sp-title', '⭐ NEW REVIEW', t, 4200, 1)
    },
  }
}
