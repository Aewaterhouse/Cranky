import { SIM_NOTE, simConnected } from '../core/testRide'
import { h } from './dom'
import { onTrainer } from './trainer'

const note = h('div', { class: 'sim-note', role: 'status' }, SIM_NOTE)
note.hidden = true
let off: (() => void) | null = null

/** In a lobby or a ride (`on`): a small note while the simulated trainer is connected. Off on the home screen. */
export function simNote(on: boolean) {
  off?.()
  off = null
  note.hidden = true
  if (!on) return
  document.body.append(note)
  const show = () => void (note.hidden = !simConnected())
  off = onTrainer(show)
  show()
}
