import { announce } from './announcer'
import '../hud.css'
import '../rideHud.css'
import '../rideHudDock.css'
import '../rideHudAim.css'
import '../busHud.css'
import { CFG } from '../config'
import { busAim } from '../core/aim'
import { busWarn, loadBanner } from '../core/hud'
import { SFX } from './audio'
import type { Live } from '../modes/rideController'
import type { RideRecorder } from '../core/ride'
import type { ShopItem, Tick } from '../net/protocol'
import type { Frame, Plan, SprintResult, Tier } from '../types'
import { TIERS } from '../types'
import { h } from './dom'
import { makeBusPanel } from './hudBus'
import { makeHeader } from './hudHeader'
import { eventOf, FX_DEFAULT, madEvents } from './hudKit'
import { makeMadPanel } from './hudMad'
import { hudMenu, hudToast, hudUnit } from './hudParts'
import { powerPanel } from './hudPower'
import { makeRoster } from './hudRoster'
import { makeShop } from './hudShop'
import { makeSplash } from './hudSplash'
import { makeStats } from './hudStats'

export interface HudOpts {
  plan?: Plan
  tier?: Tier
  rec?: RideRecorder
  meId?: string
  weightKg?: number
  /** What the End button says: the host ends the ride for everyone, anyone else leaves the bus. */
  quitLabel?: () => string
  onBuy?: (item: ShopItem) => void
  /** ERG switch: `erg` is the state to show; `slope(d)` steps the gradient when ERG is off and returns it. */
  erg?: { on: () => boolean; toggle: () => void; slope: (d: number) => number }
  /** VO2 Madness: the interval names in the deck. Swaps the bus panel for the effort board. */
  mad?: string[]
}
/** Events whose title card replaces a feed line. */
const CARD_FX = new Set(['surge', 'longhaul', 'rampup', 'roadblock', 'servo'])
const KEYS: Record<string, string> = { h: 'clean', s: 'stats', tab: 'stats', r: 'riders' }

/**
 * Bus ride overlay. The rider's own numbers sit where every mode has them (power top left, the block clock
 * top centre, the crew on the right edge, the plan along the bottom); the game's panels (bus status or the
 * Madness box, shop, feed, splashes) are grouped in the layer underneath.
 */
export function makeHud(onTier: (t: Tier) => void, onQuit: () => void, o: HudOpts = {}) {
  const sp = makeSplash()
  const power = powerPanel(true)
  madEvents(!!o.mad)
  const header = makeHeader(o.mad ? undefined : o.plan, o.tier ?? 'hard')
  header.root.classList.add('glass', 'speed')
  const bus = makeBusPanel()
  const mad = o.mad ? makeMadPanel(o.mad) : null
  let mask: string | undefined
  const shop = makeShop((i) => o.onBuy?.(i))
  const stats = o.rec ? makeStats(o.rec) : null
  const toast = hudToast()
  const sprint = h('div', { class: 'glass nchip sprint' }, 'SPRINT · all out · ERG off')
  sprint.hidden = true
  const tier = h(
    'select',
    {
      title: 'Your tier',
      onchange: (e: Event) => onTier((e.target as HTMLSelectElement).value as Tier),
    },
    ...TIERS.map((t) => h('option', { value: t }, t)),
  )
  const roster = makeRoster()
  const toggle = (part: string) => root.classList.toggle(`hud-${part}`)
  const m = hudMenu()
  const quit = m.item('End ride', '', onQuit, 'danger')
  const ergLabel = h('span', {})
  const ergItems = o.erg
    ? [
        m.item(ergLabel, 'E', () => (o.erg!.toggle(), paintErg())),
        m.item('Easier', '↓', () => toast.show(`Gradient ${o.erg!.slope(-1).toFixed(0)}%`)),
        m.item('Harder', '↑', () => toast.show(`Gradient ${o.erg!.slope(1).toFixed(0)}%`)),
      ]
    : []
  const paintErg = () => {
    const on = o.erg?.on() ?? true
    ergLabel.textContent = on ? 'ERG: on' : 'ERG: off'
    ergItems.slice(1).forEach((b) => (b.hidden = on))
  }
  paintErg()
  m.el.append(
    h('h2', {}, o.plan?.name ?? 'Zombie Bus'),
    h('label', {}, 'Your tier', tier),
    m.grid(
      m.item('Stats', 'S', () => toggle('stats')),
      m.item('Crew', 'R', () => toggle('riders')),
      m.item('Clean view', 'H', () => toggle('clean')),
      ...ergItems,
      quit,
    ),
    m.size(),
  )
  const nextChip = h('div', { class: 'glass nchip off' })
  const loadBar = h('div', { class: 'glass load-banner off' })
  const count = h('div', { class: 'count off' })
  const phone = matchMedia(`(max-height: ${CFG.hud.phoneMaxH}px)`).matches
  const root: HTMLElement = h(
    'div',
    { class: `bus-ride rh${phone ? '' : ' hud-riders'}` },
    h(
      'div',
      { class: 'rhud bhud' },
      h('div', { class: 'hud-tl' }, power.el, ...(stats ? [stats.root] : [])),
      h('div', { class: 'hud-tc' }, header.root, loadBar, sprint, nextChip, count),
      h('div', { class: 'hud-tr' }, roster.root),
      h(
        'div',
        { class: 'hud-bot' },
        h(
          'div',
          { class: 'dock' },
          h(
            'div',
            { class: 'dock-l' },
            m.el,
            m.button,
            ...(stats
              ? [h('button', { class: 'glass', onclick: () => toggle('stats') }, 'Stats')]
              : []),
          ),
        ),
        ...(mad ? [] : [h('div', { class: 'glass strip' }, header.tl)]),
      ),
    ),
    toast.el,
    h(
      'div',
      { class: 'hud' },
      h('div', { class: `hud-left${mad ? ' mad' : ''}` }, mad?.root ?? bus.root),
      h('div', { class: 'hud-right' }, sp.feed),
      shop.root,
      sp.flash,
      sp.layer,
    ),
  )
  // The game's panels are drawn at a 720 px design height and zoomed to the same unit as the shared HUD.
  let gz = 0
  const fit = () => {
    const z = hudUnit() / CFG.hud.designU
    if (z !== gz) root.style.setProperty('--gz', String((gz = z)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) return removeEventListener('keydown', onKey)
    const part = KEYS[e.key.toLowerCase()]
    const typing = e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.tagName === 'INPUT'
    if (o.erg && !typing) {
      // E switches ERG; with it off the arrows set the gradient.
      const step = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
      if (e.key.toLowerCase() === 'e') return (e.preventDefault(), o.erg.toggle(), paintErg())
      if (step && !o.erg.on())
        return (e.preventDefault(), toast.show(`Gradient ${o.erg.slope(step).toFixed(0)}%`))
    }
    if (!part || typing) return
    e.preventDefault()
    toggle(part)
  }
  // In clean view a tap anywhere brings the HUD back (there is no H key on a phone).
  const onTap = () =>
    root.isConnected
      ? root.classList.remove('hud-clean')
      : removeEventListener('pointerdown', onTap)
  addEventListener('pointerdown', onTap)
  addEventListener('keydown', onKey)
  fit()
  let lastI = -2
  let lastCount = 0
  let lastWarn = 0
  let rbProg: number | null = null
  const bestSprint = (live: Live) => {
    const best = Math.max(0, ...(o.rec?.sprints.map((s) => s.avg) ?? []))
    return best || (o.rec?.ftp ?? Math.max(200, live.avg)) * 1.2
  }
  const setPower = (f: Frame | null, live: Live) =>
    power.set({
      power: f?.type === 'sprint' ? live.power : live.avg,
      ftp: o.rec?.ftp ?? CFG.hud.fallbackFtp,
      weightKg: o.weightKg || CFG.freeRide.defaultKg,
      cadence: live.cadence,
      hr: live.hr,
      aim: busAim(f, live.power, bestSprint(live)),
    })
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
      fit()
      setPower(f, live)
      sprint.hidden = f.type !== 'sprint'
      header.update(f, e, f.el, total, rbProg, mask)
      stats?.update()
      quit.firstChild!.textContent = o.quitLabel?.() ?? 'End ride'
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
      const toSprint = f.next?.type === 'sprint' ? Math.ceil(f.next.in) : 0
      if (toSprint !== lastCount && toSprint > 0 && toSprint <= 3)
        sp.splash('sp-count', `${toSprint}`, 'SPRINT INCOMING', 1000, 2)
      lastCount = toSprint
      // 5-4-3-2-1 with the solo player's tone before the target changes
      const warn = busWarn(f)
      nextChip.classList.toggle('off', !warn)
      count.classList.toggle('off', !warn)
      if (warn && warn.s !== lastWarn) {
        nextChip.textContent = warn.text
        count.textContent = String(warn.s)
        SFX.countdown()
      }
      lastWarn = warn?.s ?? 0
    },
    /** Before the bus leaves: show live power and a big countdown. */
    countdown(n: number, live: Live) {
      root.classList.add('pre')
      fit()
      setPower(null, live)
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
      const fallen = Object.values(m.riders).filter((r) => r.st === 'fell')
      const banner = loadBanner(
        m.load,
        fallen.map((r) => r.name),
      )
      loadBar.classList.toggle('off', !banner)
      if (banner) loadBar.textContent = `⚠ ${banner}`
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
    /** A passing message, top centre like every mode's toasts (the trainer dropping out, a rider leaving). */
    banner: (text: string, ms = 2500) => toast.show(text, ms / 1000),
    toast: (text: string) => toast.show(text),
    sprint: (r: SprintResult) => (announce(r.grade), sp.grade(r)),
  }
  return api
}
export type Hud = ReturnType<typeof makeHud>
