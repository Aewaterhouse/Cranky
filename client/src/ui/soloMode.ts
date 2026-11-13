import { CFG } from '../config'
import { gearText } from '../core/gears'
import { h } from './dom'

export type RideMode = 'erg' | 'res' | 'slope'
export interface ModeState {
  kind: RideMode
  level: number
  grade: number
  /** Virtual gear, used in slope mode. */
  gear: number
}

const LABELS: [RideMode, string, string][] = [
  ['erg', 'ERG', 'E'],
  ['res', 'Resistance', 'R'],
  ['slope', 'Slope', 'G'],
]

const signed = (g: number) => `${g > 0 ? '+' : ''}${g}%`

export const modeText = (m: ModeState) =>
  m.kind === 'res'
    ? `Resistance ${m.level}%`
    : m.kind === 'slope'
      ? `Slope ${signed(m.grade)} · ${gearText(m.gear)}`
      : 'ERG'

/** Header control: ERG / Resistance / Slope switch with a stepper for the level or gradient. */
export function modeSwitch(on: { set: (k: RideMode) => void; nudge: (dir: number) => void }) {
  const btns = LABELS.map(([k, label, key]) =>
    h('button', { 'data-mode': k, onclick: () => on.set(k), title: `${label} (${key})` }, label),
  )
  const val = h('b', { class: 'pct' })
  const lab = h('span', {})
  const step = h(
    'div',
    { class: 'glass stepper' },
    lab,
    h('button', { onclick: () => on.nudge(-1), title: 'Lower (,)' }, '−'),
    val,
    h('button', { onclick: () => on.nudge(1), title: 'Higher (.)' }, '+'),
  )
  const root = h('label', { class: 'modesw' }, 'Mode', h('div', { class: 'seg' }, ...btns))
  return {
    /** The switch, for the menu. */
    root,
    /** The level or gradient stepper, for the dock; hidden in ERG. */
    step,
    set(m: ModeState) {
      btns.forEach((b) => b.classList.toggle('on', b.dataset.mode === m.kind))
      step.hidden = m.kind === 'erg'
      lab.textContent = m.kind === 'res' ? 'Resistance' : 'Slope'
      val.textContent =
        m.kind === 'res' ? `${m.level}%` : `${signed(m.grade)} · ${gearText(m.gear)}`
    },
  }
}

export const startMode = (): ModeState => ({
  kind: 'erg',
  level: CFG.ride.resStart,
  grade: CFG.ride.gradeStart,
  gear: CFG.gears.start,
})

/** The state after one step up (dir 1) or down (dir -1) of the level or gradient. */
export function stepMode(m: ModeState, dir: number): ModeState {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  if (m.kind === 'res') return { ...m, level: clamp(m.level + dir * CFG.ride.resStep, 0, 100) }
  const [lo, hi] = CFG.ride.grade
  return m.kind === 'slope' ? { ...m, grade: clamp(m.grade + dir * CFG.ride.gradeStep, lo, hi) } : m
}
