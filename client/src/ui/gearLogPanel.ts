import { CFG } from '../config'
import { GearLog } from '../core/gearLog'
import { cadenceSmoother, gearGrade, gearText, shiftGear } from '../core/gears'
import { isKey, keyHint } from '../core/keys'
import { totalMass } from '../core/physics'
import { settings } from '../core/settings'
import type { ErgController } from '../trainer/ergController'
import { h } from './dom'

/**
 * Trainer check page: shift virtual gears on the bus's flat road, exactly as a ride sends them, and log each press,
 * the gradient sent, when the trainer accepted it and when power moved, so shift lag is measured, not guessed.
 */
export function gearLogPanel(erg: () => ErgController | null) {
  const log = new GearLog()
  const smooth = cadenceSmoother()
  const mass = totalMass()
  let gear: number = CFG.gears.start
  let power = 0
  let cadence = 0
  let sent = NaN
  const grade = () =>
    gearGrade(
      CFG.ride.gradeStart,
      smooth(cadence),
      gear,
      mass,
      CFG.ride.grade,
      settings.chainring,
      1,
      settings.shiftStrength,
    )
  const now = () => performance.now()
  const state = h('p', { class: 'big' }, gearText(gear))
  const summary = h('p', { class: 'dim' }, 'Shift to start the log.')
  const body = h('tbody')
  const render = () => {
    const t = now()
    state.textContent = `${gearText(gear)} · ${Number.isNaN(sent) ? '–' : `${sent}%`} · ${power} W`
    const s = log.stats()
    if (log.rows.length)
      summary.textContent = `${log.rows.length} shifts · median ack ${s.ackMs ?? '–'} ms · median until power moves ${CFG.gearLog.movedW} W: ${s.moveMs ?? '–'} ms`
    body.replaceChildren(
      ...log.rows.map((r) =>
        h(
          'tr',
          {},
          h('td', {}, String(r.n)),
          h('td', {}, `${(r.at / 1000).toFixed(2)} s`),
          h('td', {}, String(r.gear)),
          h('td', {}, `${r.grade}%`),
          h('td', {}, r.ackMs === undefined ? 'waiting' : `${r.ackMs} ms`),
          h('td', {}, log.moved(r, t)),
        ),
      ),
    )
  }
  async function shift(d: number) {
    const e = erg()
    if (!e) return void (summary.textContent = 'Connect a trainer first.')
    gear = shiftGear(gear, d)
    sent = grade()
    const r = log.press(now(), gear, sent, power)
    render()
    await e.setGrade(sent, CFG.ride.grade, true)
    log.ack(r, now())
    render()
  }
  addEventListener('keydown', (e) => {
    const d = isKey(e, 'gearUp') ? 1 : isKey(e, 'gearDown') ? -1 : 0
    if (!d) return
    e.preventDefault()
    void shift(d)
  })
  const copy = h(
    'button',
    {
      onclick: () => void navigator.clipboard?.writeText(log.text(now())),
    },
    'Copy log',
  )
  const el = h(
    'div',
    { class: 'card' },
    h('h2', {}, 'Gear log'),
    h(
      'p',
      { class: 'dim' },
      `Shifts on a flat road as the Zombie Bus sends them (${keyHint('gearUp')} harder, ${keyHint('gearDown')} easier, or the Click). Pedal steadily; each row times the trainer's reply and power moving ${CFG.gearLog.movedW} W.`,
    ),
    state,
    h(
      'div',
      { class: 'row' },
      h('button', { onclick: () => void shift(-1) }, 'Easier ▼'),
      h('button', { onclick: () => void shift(1) }, 'Harder ▲'),
      copy,
    ),
    summary,
    h(
      'table',
      {},
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          ...['#', 'Pressed', 'Gear', 'Gradient sent', 'Trainer ack', 'Power moved'].map((t) =>
            h('th', {}, t),
          ),
        ),
      ),
      body,
    ),
  )
  return {
    el,
    shift,
    /** Every trainer report: track power for the lag, and hold the gear's gradient as a ride does. */
    data(d: { power: number; cadence: number }) {
      power = d.power
      cadence = d.cadence
      log.power(now(), power)
      const e = erg()
      if (e && !Number.isNaN(sent)) {
        const g = grade()
        if (Math.abs(g - sent) > CFG.freeRide.sendDeltaPct)
          void e.setGrade((sent = g), CFG.ride.grade)
      }
      render()
    },
  }
}
