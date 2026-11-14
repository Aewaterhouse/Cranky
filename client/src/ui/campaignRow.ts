import type { Lobby } from '../net/protocol'
import { h } from './dom'

/**
 * The bus lobby's campaign line: the driver ticks it to make this ride the crew's next leg (armour carries over);
 * everyone sees which leg it is and the armour it starts on.
 */
export function campaignRow(toggle: (on: boolean) => void) {
  const box = h('input', { type: 'checkbox', onchange: () => toggle(box.checked) })
  const text = h('span', { class: 'dim' })
  const root = h(
    'label',
    { class: 'bot-row campaign-row' },
    box,
    h('span', {}, '🗺️ Campaign ride'),
    text,
  )
  return {
    root,
    update(l: Lobby, isHost: boolean) {
      const c = l.campaign
      root.hidden = (l.game ?? 'bus') !== 'bus' || (!isHost && !c)
      box.checked = !!c
      box.disabled = !isHost
      text.textContent = c
        ? `Leg ${c.leg} of ${c.of}: ${c.from} to ${c.to}, starting on ${c.armour} armour`
        : 'Make this ride the crew’s next leg, Brisbane to Sydney. Armour carries over.'
    },
  }
}
