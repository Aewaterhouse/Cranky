import '../gear.css'
import { CFG } from '../config'
import { gearCount } from '../core/gears'
import { saveSettings, settings } from '../core/settings'
import { h } from './dom'

/** Big "GEAR 12/24" tile with the gradient sent to the trainer underneath; flashes on each shift. */
export function gearTile() {
  const v = h('b', {}, '–')
  const sub = h('i', {})
  const el = h('div', { class: 'sbig geartile' }, h('span', {}, 'Gear'), v, sub)
  let last = 0
  return {
    el,
    set(gear: number, sent: number) {
      if (last && gear !== last) {
        el.classList.remove('shift-up', 'shift-down')
        void el.offsetWidth // restart the animation
        el.classList.add(gear > last ? 'shift-up' : 'shift-down')
      }
      last = gear
      v.textContent = `${gear}/${gearCount}`
      sub.textContent = `trainer ${sent.toFixed(1)}%`
    },
  }
}

/** Shift strength slider (50 to 300%), saved to settings; rides read it on every trainer update. */
export function strengthSlider() {
  const S = CFG.gears.strength
  const val = h('b', { class: 'pct' })
  const show = () => (val.textContent = `${Math.round(settings.shiftStrength * 100)}%`)
  const input = h('input', {
    type: 'range',
    min: S.min * 100,
    max: S.max * 100,
    step: S.step * 100,
    value: Math.round(settings.shiftStrength * 100),
    'aria-label': 'Shift strength',
    oninput: () => (saveSettings({ shiftStrength: +input.value / 100 }), show()),
  })
  show()
  return h(
    'label',
    { class: 'field', title: 'How much each virtual gear changes the trainer gradient.' },
    'Shift strength',
    h('div', { class: 'diff gsl' }, input, val),
  )
}
