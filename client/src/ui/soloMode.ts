import { CFG } from '../config'
import { h } from './dom'

export type RideMode = 'erg' | 'res' | 'slope'
export interface ModeState {
  kind: RideMode
  level: number
  grade: number
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
      ? `Slope ${signed(m.grade)}`
      : 'ERG'

/** Header control: ERG / Resistance / Slope switch with a stepper for the level or gradient. */
export function modeSwitch(on: { set: (k: RideMode) => void; nudge: (dir: number) => void }) {
  const btns = LABELS.map(([k, label, key]) =>
    h('button', { 'data-mode': k, onclick: () => on.set(k), title: `${label} (${key})` }, label),
  )
  const val = h('b', { class: 'pct' })
  const step = h(
    'div',
    { class: 'stepper' },
    h('button', { onclick: () => on.nudge(-1), title: 'Lower (,)' }, '−'),
    val,
    h('button', { onclick: () => on.nudge(1), title: 'Higher (.)' }, '+'),
  )
  const root = h(
    'div',
    { class: 'field modesw' },
    'Mode',
    h('div', { class: 'ctl' }, ...btns, step),
  )
  return {
    root,
    set(m: ModeState) {
      btns.forEach((b) => b.classList.toggle('on', b.dataset.mode === m.kind))
      step.style.display = m.kind === 'erg' ? 'none' : ''
      val.textContent = m.kind === 'res' ? `${m.level}%` : signed(m.grade)
    },
  }
}

/** The state after one step up (dir 1) or down (dir -1) of the level or gradient. */
export function stepMode(m: ModeState, dir: number): ModeState {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  if (m.kind === 'res') return { ...m, level: clamp(m.level + dir * CFG.ride.resStep, 0, 100) }
  const [lo, hi] = CFG.ride.grade
  return m.kind === 'slope' ? { ...m, grade: clamp(m.grade + dir * CFG.ride.gradeStep, lo, hi) } : m
}
