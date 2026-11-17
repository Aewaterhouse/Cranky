import { gearCount, gearText, shiftGear } from '../core/gears'
import { ZwiftDirect } from '../trainer/zwiftDirect'
import { h } from './dom'

/**
 * Trainer check page: "Direct gears (experimental)". Does nothing until Start is clicked. Every byte both ways is
 * listed; "Back to normal" puts the trainer back on a flat road in the middle gear and disconnects.
 */
export function directGearsPanel() {
  const lines: string[] = []
  const t0 = performance.now()
  const out = h('pre', { class: 'direct-log' })
  const log = (dir: string, text: string) => {
    lines.push(`${((performance.now() - t0) / 1000).toFixed(3)} s ${dir} ${text}`)
    out.textContent = lines.slice(-200).join('\n')
    out.scrollTop = out.scrollHeight
  }
  const z = new ZwiftDirect(log)
  const state = h('p', { class: 'big' }, 'Off')
  z.onRiding = (p, c) => (state.textContent = `${gearText(z.gear)} · ${p} W · ${c} rpm`)
  const run = (f: () => Promise<void>) => async () => {
    try {
      await f()
    } catch (e) {
      log('·', `Error: ${e instanceof Error ? e.message : String(e)}`)
    }
    state.textContent = z.on ? gearText(z.gear) : 'Off'
  }
  const shift = (d: number) => run(() => z.setGear(shiftGear(z.gear, d)))
  return h(
    'div',
    { class: 'card' },
    h('h2', {}, 'Direct gears (experimental)'),
    h(
      'p',
      { class: 'dim' },
      `Sends ${gearCount} gear ratios straight to a Zwift-protocol trainer (Zwift Hub, JetBlack Victory), as in docs/zwift-gear-protocol.md. Not used by any ride. Pedal gently; it may stop ERG working until Back to normal.`,
    ),
    state,
    h(
      'div',
      { class: 'row' },
      h('button', { onclick: run(() => z.start()) }, 'Start direct gears'),
      h('button', { onclick: shift(-1) }, 'Easier ▼'),
      h('button', { onclick: shift(1) }, 'Harder ▲'),
      h('button', { onclick: run(() => z.checkFtms()) }, 'Check FTMS still answers'),
      h('button', { class: 'danger', onclick: run(() => z.stop()) }, 'Back to normal'),
      h(
        'button',
        { onclick: () => void navigator.clipboard?.writeText(lines.join('\n')) },
        'Copy bytes',
      ),
    ),
    out,
  )
}
