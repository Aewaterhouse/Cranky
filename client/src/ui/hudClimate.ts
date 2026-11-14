import '../hudClimate.css'
import type { ClimateState, Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'
import { set, type EventStyle } from './hudKit'

export const CLIMATE_EVENTS: Record<string, EventStyle> = {
  eighties: { name: 'The 1980s', icon: '📼', col: '#5aa9e6' },
  decade: { name: 'New Decade', icon: '📈', col: '#f2b705' },
  trial: { name: 'The Trial', icon: '⚖️', col: '#e040fb' },
  cool: { name: 'Sentencing', icon: '🔨', col: '#44bba4' },
}
export const FUELS: Record<string, [string, string, string]> = {
  coal: ['🏭', 'Coal', 'Any power earns'],
  gas: ['🔥', 'Gas', 'Surges pay a bonus'],
  solar: ['☀️', 'Solar', 'Earns only in the band'],
  wind: ['🌬️', 'Wind', 'Earns only on gusts'],
}
const IDLE: Record<string, string> = {
  solar: 'Clouds came over. Get back in the band.',
  wind: 'Becalmed. Wait for a gust.',
}
const STAGES = ['Beach', 'Surf club', 'Main Street', 'Everything']

/** Climate Lawsuit panel: the sea level, your company, everyone's coins, demand events and the Trial. */
export function makeClimatePanel(act: (k: string, v: string) => void): GamePanel {
  const head = h('span', { class: 'bs-sync-s' })
  const sea = h('i', {})
  const stage = h('b', { class: 'bs-n' })
  const marks = h('div', { class: 'cl-marks' }, ...STAGES.map((s) => h('span', {}, s)))
  const mine = h('div', { class: 'cl-mine' })
  const event = h('div', { class: 'am-event' })
  const wall = h('button', { class: 'cl-wall', onclick: () => act('wall', '1') })
  const list = h('div', { class: 'dt-table' })
  const trial = h('div', { class: 'dt-chat' })
  const root = h(
    'section',
    { class: 'hud-glass am cl' },
    h('div', { class: 'bs-head' }, h('label', {}, 'CLIMATE LAWSUIT'), head),
    h('div', { class: 'bs-head' }, h('label', {}, 'SEA LEVEL'), stage),
    h('div', { class: 'bs-bar cl-sea' }, sea),
    marks,
    mine,
    event,
    wall,
    list,
    trial,
  )
  return {
    root,
    update(m: Tick, meId: string) {
      const g = m.game as unknown as ClimateState | null | undefined
      if (g?.g !== 'climate') return
      const name = (id: string) => m.riders[id]?.name ?? '?'
      set(head, g.decade ?? '')
      sea.style.width = `${Math.round(g.level * 100)}%`
      set(stage, g.flooded ? 'FLOODED' : g.stage ? `${g.stageName} under` : 'Dry, for now')
      marks.dataset.stage = String(g.stage)
      const me = g.cos[meId]
      mine.hidden = !me
      if (me) {
        const [icon, label, how] = FUELS[me.fuel]
        const cue = g.cue[meId]
        mine.dataset.on = String(me.on)
        mine.replaceChildren(
          h('span', { class: 'dt-said' }, icon),
          h(
            'div',
            {},
            h('b', {}, `${me.name} · ${Math.round(me.coins)} 🪙`),
            h(
              'div',
              { class: 'am-line' },
              cue
                ? `${cue.k === 'gust' ? '💨 GUST' : '⚡ SURGE'}! ${Math.ceil(cue.left)} s`
                : me.on
                  ? `${label}: earning. ${how}.`
                  : (IDLE[me.fuel] ?? `${label}: not earning.`),
            ),
          ),
        )
      }
      const e = g.event
      event.hidden = !e
      if (e) {
        event.dataset.s = 'on'
        event.replaceChildren(
          h('b', {}, e.name, h('span', {}, `${Math.ceil(e.left)} s`)),
          h('span', {}, e.text),
        )
      }
      wall.hidden = g.phase !== 'decade' || !me
      wall.disabled = !me || me.coins < g.wallCost
      set(wall, `🧱 Build a seawall · ${g.wallCost} 🪙${g.walls ? ` (${g.walls} built)` : ''}`)
      const led = g.ledger
      const order = Object.keys(g.cos).sort((a, b) =>
        led ? led[b].emit - led[a].emit : g.cos[b].coins - g.cos[a].coins,
      )
      list.replaceChildren(
        ...order.map((id) => {
          const c = g.cos[id]
          const l = led?.[id]
          return h(
            'div',
            { class: `dt-row${id === meId ? ' me' : ''}` },
            h('span', {}, `${FUELS[c.fuel][0]} ${c.name} (${name(id)})${l?.bribed ? ' 💰' : ''}`),
            h(
              'b',
              {},
              l
                ? `${Math.round(l.emit)} t · ${Math.round(c.coins)} 🪙`
                : `${Math.round(c.coins)} 🪙`,
            ),
          )
        }),
      )
      const t = g.trial
      trial.hidden = !t
      if (t)
        trial.replaceChildren(
          ...t.defendants.map((id) => {
            const v = t.verdicts[id]
            return h(
              'p',
              {},
              v
                ? `${name(id)}: ${v === 'guilty' ? '🔨 GUILTY' : '🎉 acquitted on a technicality'}`
                : `⚖️ ${name(id)} is in the dock${t.target ? `: hold ${t.target}%, ${Math.round(t.held * 100)}% held against the jury's ${Math.round((t.bar ?? 0.8) * 100)}%` : '. The jury is voting.'}`,
            )
          }),
        )
    },
    fx(fx, sp) {
      const t = fx.text ?? ''
      if (fx.k === 'stage') sp.splash('sp-fell', '🌊 THE SEA IS RISING', t, 3600, 2)
      else if (fx.k === 'flood') sp.splash('sp-fell', '🌊 THE TOWN HAS FLOODED', t, 5000, 3)
      else if (fx.k === 'blackout') sp.splash('sp-fell', '🔌 BLACKOUT', t, 3200, 2)
      else if (fx.k === 'wall') sp.splash('sp-smash', '🧱 SEAWALL', t, 2600, 1)
      else if (fx.k === 'verdict') sp.splash('sp-smash', '⚖️ VERDICT', t, 4200, 3)
    },
  }
}
