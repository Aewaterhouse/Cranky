import '../rideHud.css'
import '../rideHudDock.css'
import '../rideHudAim.css'
import '../soloHud.css'
import { CFG } from '../config'
import { soloAim } from '../core/aim'
import { hrZone } from '../core/curve'
import { effortSummary, isRest, nextText } from '../core/hud'
import type { BlockStat } from '../core/ride'
import type { Live } from '../modes/rideController'
import type { Frame, Plan, Tier } from '../types'
import { clock, fmt, h } from './dom'
import { hudToast } from './hudParts'
import { powerPanel } from './hudPower'
import { ZONE_COLOURS } from './planGraph'
import { soloActions, type SoloAction } from './soloExtras'
import { mediaCorner } from './soloMedia'
import { soloMenu } from './soloMenu'
import { modeText, type ModeState, type RideMode } from './soloMode'
import { soloPanel, type LiveStats } from './soloPanel'
import { segsFromBlocks } from './soloSegs'
import { workoutChart } from './workoutChart'

export interface SoloHandlers {
  pause: () => void
  skip: () => void
  end: () => void
  intensity: (d: number) => void
  tier: (t: Tier) => void
  mode: (k: RideMode) => void
  nudge: (dir: number) => void
}
/** HUD parts that can be switched on and off (the interval list sits where the other modes list riders). */
export type SoloPart = 'clean' | 'stats' | 'riders'

export interface ViewState {
  fast: number
  f: Frame
  live: Live
  total: number
  intensity: number
  paused: string | null
  stats: LiveStats
  power: number[]
  xs: number[]
  cadence: number[]
  hr: (number | null)[]
  actions: SoloAction[]
  cadPct: (number | null)[]
  mode: ModeState
  weightKg: number
  /** 3, 2, 1 before the interval changes; 0 otherwise. */
  count: number
}

/**
 * Solo workout player, laid out like the other ride screens: power (the target, in a workout) top left, the
 * interval clock top centre, the interval list on the right edge, the whole workout as a strip along the
 * bottom, and the close-up chart where the other modes have the road.
 */
export function soloView(plan: Plan, ftp: number, tier: Tier, on: SoloHandlers, maxHr?: number) {
  const power = powerPanel(true)
  const blockName = h('div', { class: 'blockname' })
  const left = h('b', {}, '–')
  const elapsed = h('span', {})
  const togo = h('span', {})
  const cueEl = h('div', { class: 'cue-line' })
  const next = h('div', { class: 'glass nchip off' })
  const count = h('div', { class: 'count off' })
  const summary = h('div', { class: 'glass summary off' })
  const strip = workoutChart(ftp, 0, true)
  const zoom = workoutChart(ftp, 60)
  const toast = hudToast()
  const ov = h('div', { class: 'overlay' })
  const media = mediaCorner()
  const acts = soloActions()
  let ghost: number[] | null = null
  let cueTimer = 0
  let cueNew = false
  let cueI = -1
  let sumTimer = 0

  let dialog = false
  let key = ''
  const say = (html: Node[] | null, cls = '') => {
    dialog = cls === 'dialog'
    key = ''
    ov.className = `overlay${html ? ` open ${cls}` : ''}`
    if (html) ov.replaceChildren(...html)
  }
  const dlg = (title: string, lines: string[], ...buttons: Node[]) =>
    say(
      [
        h(
          'div',
          { class: 'dlg' },
          h('h2', {}, title),
          ...lines.map((l) => h('p', { class: 'dim' }, l)),
          h('div', { class: 'row' }, ...buttons),
        ),
      ],
      'dialog',
    )
  const confirmEnd = () =>
    dlg(
      'End ride?',
      ['Your ride so far will be saved.'],
      h('button', { onclick: () => say(null) }, 'Keep riding'),
      h('button', { class: 'primary', onclick: on.end }, 'End ride'),
    )
  const phone = matchMedia(`(max-height: ${CFG.hud.phoneMaxH}px)`).matches
  const toggle = (part: SoloPart) => root.classList.toggle(`hud-${part}`)
  const c = soloMenu(plan, tier, on, {
    toggle,
    confirmEnd,
    media: () => (media.panel.hidden = !media.panel.hidden),
  })
  const panel = soloPanel(plan, c.tier, ftp)
  const stage = h(
    'div',
    { class: 'solo-stage', onclick: () => root.classList.remove('hud-clean') },
    h('span', { class: 'ctag' }, 'Current interval ±60 s'),
    zoom.el,
  )
  const root: HTMLElement = h(
    'div',
    { class: `solo-ride rh${plan.test ? ' testing' : ''}${phone ? '' : ' hud-riders'}` },
    stage,
    h(
      'div',
      { class: 'rhud shud' },
      h('div', { class: 'hud-tl' }, power.el, panel.drawer),
      h(
        'div',
        { class: 'hud-tc' },
        h(
          'div',
          { class: 'glass speed' },
          blockName,
          h('span', { class: 'hv spd clock' }, left),
          h('div', { class: 'totals' }, elapsed, togo),
          cueEl,
        ),
        next,
        count,
      ),
      h('div', { class: 'hud-tr' }, summary, panel.list),
      h(
        'div',
        { class: 'hud-bot' },
        h(
          'div',
          { class: 'dock' },
          h(
            'div',
            { class: 'dock-l' },
            c.menu.el,
            c.menu.button,
            h('button', { class: 'glass', onclick: () => toggle('stats') }, 'Stats'),
            acts.root,
          ),
          h('div', { class: 'dock-r' }, c.modes.step, c.intens.el),
        ),
        h('div', { class: 'glass strip' }, strip.el),
      ),
    ),
    toast.el,
    ov,
    media.panel,
  )

  return {
    root,
    panel,
    toggle,
    toast: toast.show,
    /** Big centred message over the chart: countdown digit, sprint prompt, pause notice or grade splash. */
    overlay(big: string | null, sub = '', cls = '') {
      if (dialog || key === `${big}|${sub}|${cls}`) return
      const k = `${big}|${sub}|${cls}`
      say(
        big === null
          ? null
          : [h('div', { class: `ovbig ${cls}` }, big), h('div', { class: 'ovsub' }, sub)],
        cls,
      )
      key = k
    },
    confirmEnd,
    /** The coach's line under the clock: bright for CFG.cueS seconds, then quiet until the interval ends. */
    cue(text: string) {
      clearTimeout(cueTimer)
      cueEl.textContent = text
      cueEl.classList.add('show')
      cueNew = true
      cueTimer = window.setTimeout(() => cueEl.classList.remove('show'), CFG.cueS * 1000)
    },
    /** How the effort just finished went, top right for a few seconds. */
    summary(b: BlockStat, cadPct?: number | null) {
      const s = effortSummary(b)
      const row = (label: string, v: string) => h('div', {}, h('span', {}, label), h('b', {}, v))
      summary.replaceChildren(
        h('h3', {}, b.label),
        row('Average', `${s.avg} W`),
        row('Off target', `${s.off > 0 ? '+' : s.off < 0 ? '−' : ''}${Math.abs(s.off)} W`),
        row('In band', `${Math.round(s.inBand * 100)}%`),
        ...(cadPct == null ? [] : [row('Cadence in band', `${Math.round(cadPct * 100)}%`)]),
      )
      summary.classList.remove('off')
      clearTimeout(sumTimer)
      sumTimer = window.setTimeout(() => summary.classList.add('off'), CFG.hud.summaryS * 1000)
    },
    /** Modal question over the chart; resolves with the index of the button pressed. */
    prompt(title: string, lines: string[], buttons: string[]) {
      return new Promise<number>((res) =>
        dlg(
          title,
          lines,
          ...buttons.map((b, n) =>
            h('button', { class: n === 0 ? 'primary' : '', onclick: () => res(n) }, b),
          ),
        ),
      )
    },
    /** Shows an earlier attempt behind the live trace. */
    setGhost(g: number[] | null) {
      ghost = g
      if (g) panel.note('Dashed blue on the charts: your last attempt')
    },
    frame(s: ViewState) {
      const { f, live } = s
      acts.set(s.actions)
      c.modes.set(s.mode)
      root.classList.toggle('noerg', s.mode.kind !== 'erg')
      root.classList.toggle('paused', !!s.paused)
      power.set({
        power: f.type === 'sprint' ? live.power : live.avg,
        ftp,
        weightKg: s.weightKg,
        cadence: live.cadence,
        hr: live.hr,
        hrColour: live.hr && maxHr ? ZONE_COLOURS[hrZone(live.hr, maxHr)] : undefined,
        aim: soloAim(f, s.mode.kind === 'erg' ? null : modeText(s.mode)),
      })
      panel.cadence(s.cadPct)
      blockName.textContent = `${f.label} · ${f.i + 1} of ${plan.blocks.length}`
      left.textContent = fmt(f.dur - f.bel)
      elapsed.textContent = `${clock(s.stats.elapsed)} gone`
      togo.textContent = `${clock(s.stats.remaining)} to go`
      // The coach's line belongs to the interval it was said in.
      if (cueNew) cueI = f.i
      else if (f.i !== cueI) cueEl.textContent = ''
      cueNew = false
      const soon = f.next && f.next.in / s.fast <= CFG.hud.nextS
      next.classList.toggle('off', !f.next || !(soon || isRest(f.type, f.tgt, ftp)))
      if (f.next) next.textContent = nextText(f.next, plan.blocks[f.i + 1]?.dur ?? 0)
      count.classList.toggle('off', !s.count)
      if (s.count) count.textContent = String(s.count)
      c.intens.val.textContent = `${Math.round(s.intensity * 100)}%`
      c.paused(!!s.paused)
      const data = {
        gap: s.fast * 3 + 3,
        segs: segsFromBlocks(plan.blocks, c.tier(), ftp, s.intensity),
        total: s.total,
        power: s.power,
        xs: s.xs,
        cadence: s.cadence,
        hr: s.hr,
        now: f.el,
        showCadence: c.lines.cadence,
        showHr: c.lines.hr,
        ghost,
      }
      strip.set(data)
      zoom.set(data)
      panel.frame(f.i, s.intensity)
      panel.stats(s.stats)
    },
  }
}
