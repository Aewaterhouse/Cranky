import { CFG } from '../config'
import { powerZone, tolerance, tolText } from '../core/hud'
import { inCadBand } from '../modes/drill/cadence'
import { h } from './dom'
import { hudVal } from './hudParts'
import { ZONE_COLOURS } from './planGraph'

/** What a workout block asks of the rider, for the power panel. */
export interface Aim {
  /** The small caption over the big number: "Target", "Power · 3 s", "Sprint". */
  cap: string
  /** A chip beside it: "🔒 ERG", "ERG off". */
  chip?: string
  /** Target watts. Never set in a sprint. */
  target?: number | null
  /** The target is the big number and power sits beneath it; otherwise the other way round. */
  targetLeads?: boolean
  /** The second line in place of the other number: "All out", "Resistance 40%". */
  note?: string
  /** Sprint: how full the bar is against the rider's best, 0..1. */
  fill?: number
  /** Cadence band of the block, when the plan sets one. */
  cad?: [number, number]
}
export interface PowerState {
  /** The rider's power as shown: 3 s average, or live in a sprint. */
  power: number
  ftp: number
  weightKg: number
  cadence: number
  hr?: number | null
  /** Colour of the heart-rate number (its zone), when known. */
  hrColour?: string
  aim?: Aim
}

/**
 * The power panel, top left in every mode: the big number, zone and W/kg beside it, a bar, cadence and heart
 * rate beneath. With `workout` it grows a caption, a tolerance bar in place of the zone bar and a second line
 * (power under a target, or the target under power). Every slot keeps its place whatever is showing.
 */
export function powerPanel(workout = false) {
  const pw = hudVal('hpw', 'W')
  const wkg = hudVal('wkg', 'W/kg')
  const zone = h('span', { class: 'zone' })
  const bar = h('i', { class: 'pw-bar' })
  const cad = hudVal('sub off', 'rpm')
  const cadUnit = cad.el.lastElementChild!
  const hr = hudVal('sub off', 'bpm', '♥ ')
  const cap = h('span', {})
  const chip = h('span', { class: 'pw-chip' })
  const needle = h('i', { class: 'tol-needle' })
  const tol = h('div', { class: 'tol' }, h('i', { class: 'tol-band' }), needle)
  // Half-widths of the green and amber stretches, as a share of the bar.
  tol.style.setProperty('--b', `${(CFG.compliance.band / CFG.hud.tol.span) * 50}%`)
  tol.style.setProperty('--w', `${(CFG.hud.tol.warn / CFG.hud.tol.span) * 50}%`)
  const label2 = h('span', { class: 'pw-2l' })
  const second = hudVal('', 'W')
  const delta = h('span', { class: 'pw-delta' })
  const el = h(
    'div',
    { class: `glass power${workout ? ' aimed' : ''}` },
    ...(workout ? [h('div', { class: 'pw-cap' }, cap, chip)] : []),
    h('div', { class: 'pw-row' }, pw.el, h('div', { class: 'pw-side' }, zone, wkg.el)),
    workout ? tol : bar,
    ...(workout ? [h('div', { class: 'pw-2' }, label2, second.el, delta)] : []),
    h('div', { class: 'pw-sub' }, cad.el, hr.el),
  )
  let hadCadence = false
  return {
    el,
    set(s: PowerState) {
      const watts = Math.round(s.power)
      const colour = ZONE_COLOURS[powerZone(s.power / s.ftp) - 1]
      const a = s.aim
      const t = a?.target || null
      const lead = !!t && !!a?.targetLeads
      pw.v.textContent = String(lead ? t : watts)
      wkg.v.textContent = (s.power / s.weightKg).toFixed(1)
      zone.textContent = `Z${powerZone(s.power / s.ftp)}`
      bar.style.background = colour
      // Each sensor keeps its slot, so nothing shuffles when one drops out.
      hadCadence ||= s.cadence > 0
      cad.v.textContent = String(Math.round(s.cadence))
      cad.el.classList.toggle('off', !hadCadence)
      cadUnit.textContent = a?.cad ? `${a.cad[0]}–${a.cad[1]} rpm` : 'rpm'
      cad.v.style.color = a?.cad ? `var(--${inCadBand(a.cad, s.cadence) ? 'ok' : 'warn'})` : ''
      hr.v.textContent = String(s.hr ?? '')
      hr.v.style.color = s.hrColour ?? ''
      hr.el.classList.toggle('off', s.hr == null)
      if (!a) return
      cap.textContent = a.cap
      chip.textContent = a.chip ?? ''
      const state = t ? tolerance(s.power, t) : null
      tol.dataset.s = state?.state ?? (a.fill == null ? 'zone' : 'fill')
      tol.style.setProperty('--zc', colour)
      tol.style.setProperty('--fill', `${Math.min(1, a.fill ?? 1) * 100}%`)
      needle.style.left = `${(state?.pos ?? 0.5) * 100}%`
      label2.textContent = a.note ?? (t ? (lead ? 'Power' : 'Target') : '')
      second.el.hidden = !t || !!a.note
      second.v.textContent = String(lead ? watts : (t ?? ''))
      second.v.style.color = lead ? colour : ''
      delta.textContent = t ? tolText(s.power, t) : ''
      delta.dataset.s = state?.state ?? ''
    },
  }
}
