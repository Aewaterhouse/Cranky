import { announce } from './announcer'
import '../hud.css'
import type { Live } from '../modes/rideController'
import type { RideRecorder } from '../core/ride'
import type { ShopItem, Tick } from '../net/protocol'
import type { Frame, Plan, SprintResult, Tier } from '../types'
import { TIERS } from '../types'
import { h } from './dom'
import { makeBusPanel } from './hudBus'
import { makeCockpit } from './hudCockpit'
import { makeHeader } from './hudHeader'
import { eventOf, FX_DEFAULT, madEvents } from './hudKit'
import { makeMadPanel } from './hudMad'
import { makeRoster } from './hudRoster'
import { makeShop } from './hudShop'
import { makeSplash } from './hudSplash'
import { makeStats } from './hudStats'

export interface HudOpts {
  plan?: Plan
  tier?: Tier
  rec?: RideRecorder
  meId?: string
  onBuy?: (item: ShopItem) => void
  /** VO2 Madness: the interval names in the deck. Swaps the bus panel for the effort board. */
  mad?: string[]
}
/** Events whose title card replaces a feed line. */
const CARD_FX = new Set(['surge', 'longhaul', 'rampup', 'roadblock', 'servo'])

/** Ride overlay: event header, cockpit, bus status, roster, stats, splashes, feed and shop. */
export function makeHud(onTier: (t: Tier) => void, onQuit: () => void, o: HudOpts = {}) {
  const sp = makeSplash()
  const cockpit = makeCockpit()
  madEvents(!!o.mad)
  const header = makeHeader(o.mad ? undefined : o.plan, o.tier ?? 'hard')
  const bus = makeBusPanel()
  const mad = o.mad ? makeMadPanel(o.mad) : null
  let mask: string | undefined
  const shop = makeShop((i) => o.onBuy?.(i))
  const stats = o.rec ? makeStats(o.rec) : null
  const tier = h(
    'select',
    {
      title: 'Your tier',
      onchange: (e: Event) => onTier((e.target as HTMLSelectElement).value as Tier),
    },
    ...TIERS.map((t) => h('option', { value: t }, t)),
  )
  const roster = makeRoster(
    h(
      'div',
      { class: 'rs-foot' },
      tier,
      h('button', { class: 'ghost', onclick: onQuit }, 'End ride'),
    ),
  )
  const root = h(
    'div',
    { class: 'hud' },
    header.root,
    h('div', { class: 'hud-left' }, mad?.root ?? bus.root),
    h('div', { class: 'hud-right' }, roster.root, sp.feed),
    shop.root,
    h('div', { class: 'hud-bl' }, ...(stats ? [stats.root] : [])),
    cockpit.root,
    sp.flash,
    sp.layer,
  )
  let lastI = -2
  let lastCount = 0
  let rbProg: number | null = null
  const bestSprint = (live: Live) => {
    const best = Math.max(0, ...(o.rec?.sprints.map((s) => s.avg) ?? []))
    return best || (o.rec?.ftp ?? Math.max(200, live.avg)) * 1.2
  }
  const api = {
    root,
    setTier(t: string) {
      tier.value = t
      header.setTier(t as Tier)
    },
    /** Per-frame update from the plan clock (server tick or local). */
    frame(f: Frame | null, live: Live, total: number, ev?: string) {
      if (!f) return
      const e = ev ?? (f.type === 'sprint' ? 'roadblock' : (f.event ?? 'longhaul'))
      root.classList.remove('pre')
      cockpit.update(f, live, bestSprint(live))
      header.update(f, e, f.el, total, rbProg, mask)
      stats?.update()
      if (f.i !== lastI) {
        lastI = f.i
        if (f.type === 'sprint')
          sp.splash('sp-go', 'SPRINT!', 'ERG off. Everything you have!', 1600, 2)
        else {
          const s = eventOf(e)
          sp.splash(
            'sp-title',
            `${s.icon} ${s.name}`,
            f.label.toLowerCase() === s.name.toLowerCase() ? '' : f.label,
            2200,
            1,
          )
          root.style.setProperty('--ev', s.col)
        }
      }
      const count = f.next?.type === 'sprint' ? Math.ceil(f.next.in) : 0
      if (count !== lastCount && count > 0 && count <= 3)
        sp.splash('sp-count', `${count}`, 'SPRINT INCOMING', 1000, 2)
      lastCount = count
    },
    /** Before the bus leaves: show live power and a big countdown. */
    countdown(n: number, live: Live) {
      root.classList.add('pre')
      cockpit.update(null, live, 0)
      sp.splash('sp-count sp-pre', `${n}`, mad ? 'MADNESS STARTS IN' : 'BUS LEAVES IN', 1100, 0)
    },
    /** Everything that comes from the server tick: bus, roster, shop, fx. */
    tick(m: Tick) {
      const meId = o.meId ?? ''
      rbProg = m.bus.rb
      bus.update(m.bus, m.riders)
      const ms = m.bus.mad
      if (ms) mad?.update(ms, m.riders, meId)
      mask = ms?.box ? (ms.next ?? '❓ MYSTERY BOX') : undefined
      roster.update(m.riders, meId, m.el)
      shop.update(m.bus.shop, m.bus.scrap)
      for (const fx of m.fx) {
        if (fx.id !== meId || fx.k === 'fell')
          announce(fx.k, (fx.id && m.riders[fx.id]?.name) || 'Someone')
        if (CARD_FX.has(fx.k)) continue
        const text = fx.text ?? FX_DEFAULT[fx.k] ?? ''
        const who = (fx.id && m.riders[fx.id]?.name) || 'Someone'
        if (fx.k === 'fell')
          sp.splash(
            'sp-fell',
            fx.id === meId ? 'YOU FELL OFF!' : `${who.toUpperCase()} FELL OFF!`,
            'HOLD IT! Keep the crew on target to haul them back',
            3200,
            2,
          )
        else if (fx.k === 'box') {
          mad?.spin(text.split('!')[0])
          sp.splash('sp-smash', '🎁 MYSTERY BOX', text, 4500, 2)
        } else if (fx.k === 'go')
          sp.splash('sp-go', text, 'Heart rate up. Who wants it most?', 1800, 2)
        else if (fx.k === 'crown')
          sp.splash('sp-smash', `👑 ${fx.id === meId ? 'YOU' : who.toUpperCase()}`, text, 2600, 1)
        else if (fx.k === 'challenge' && fx.id === meId)
          sp.splash('sp-smash', 'YOUR CHALLENGE!', text.replace(/^[^:]*: /, ''), 4000, 2)
        else if (fx.k === 'smash')
          sp.splash('sp-smash', 'ROADBLOCK SMASHED!', text.match(/\+\d+ scrap/)?.[0] ?? '', 2800, 2)
        if (fx.k === 'buy') shop.bought(text)
        if (text && !((fx.k === 'sprint' || fx.k === 'slowmo') && fx.id === meId))
          sp.line(
            fx.k,
            text,
            ['hit', 'grab', 'crash', 'fell', 'sandbag'].includes(fx.k) ? 'bad' : '',
          )
      }
    },
    /** Generic splash, kept for the solo mode. */
    banner: (text: string, cls = '', ms = 2500) => sp.splash(`sp-title ${cls}`, text, '', ms, 1),
    toast: (text: string) => sp.line('', text),
    sprint: (r: SprintResult) => (announce(r.grade), sp.grade(r)),
  }
  return api
}
export type Hud = ReturnType<typeof makeHud>
