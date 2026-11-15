import {
  ACTION_IDS,
  ACTIONS,
  type ActionId,
  clashOf,
  keyLabel,
  keyOf,
  keysOf,
  MAX_KEYS,
  resetKeys,
  setKey,
} from '../core/keys'
import { h } from './dom'

const MODS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'Dead', 'Unidentified'])

/**
 * Rider → Settings → Controls: every ride action with its two key slots. Click a slot and press a key (Esc
 * cancels, Backspace clears it); a key another action already uses asks to swap.
 */
export function controlsPanel() {
  const list = h('div', { class: 'keys-list' })
  const warn = h('div', { class: 'keys-warn', hidden: true })
  let stop = () => {}
  const paint = () => {
    stop()
    warn.hidden = true
    const groups = [...new Set(ACTION_IDS.map((id) => ACTIONS[id].group))]
    list.replaceChildren(
      ...groups.flatMap((g) => [
        h('h3', {}, g),
        ...ACTION_IDS.filter((id) => ACTIONS[id].group === g).map((id) =>
          h(
            'div',
            { class: 'keys-row' },
            h('span', {}, ACTIONS[id].label),
            ...Array.from({ length: MAX_KEYS }, (_, i) => slot(id, i)),
          ),
        ),
      ]),
    )
  }
  const ask = (id: ActionId, i: number, key: string, other: ActionId) => {
    warn.replaceChildren(
      h('span', {}, `${keyLabel(key)} is already "${ACTIONS[other].label}". Swap them?`),
      h('button', { class: 'primary', onclick: () => (setKey(id, i, key), paint()) }, 'Swap'),
      h('button', { onclick: paint }, 'Cancel'),
    )
    warn.hidden = false
  }
  const slot = (id: ActionId, i: number) => {
    const k = keysOf(id)[i]
    const b = h(
      'button',
      { class: `key-slot${k ? '' : ' key-none'}`, 'data-slot': `${id}:${i}` },
      k ? keyLabel(k) : '+',
    )
    b.onclick = () => {
      paint()
      const fresh = list.querySelector<HTMLElement>(`[data-slot="${id}:${i}"]`)!
      fresh.textContent = 'Press a key…'
      fresh.classList.add('listening')
      // Capture, so the key reaches nothing else (not the simulator, not a ride).
      const on = (e: KeyboardEvent) => {
        if (!list.isConnected) return stop()
        if (MODS.has(e.key)) return
        e.preventDefault()
        e.stopImmediatePropagation()
        stop()
        if (e.key === 'Escape') return paint()
        if (e.key === 'Backspace' || e.key === 'Delete') return (setKey(id, i, null), paint())
        const key = keyOf(e)
        const other = clashOf(id, key)
        if (other) return ask(id, i, key, other.id)
        setKey(id, i, key)
        paint()
      }
      addEventListener('keydown', on, true)
      stop = () => removeEventListener('keydown', on, true)
    }
    return b
  }
  paint()
  return h(
    'div',
    { class: 'controls' },
    h(
      'p',
      { class: 'dim' },
      'Click a key, then press the new one: Esc cancels, Backspace clears it. Up to two keys each, saved on this device. A Bluetooth page-turner remote works too (most send Page Up and Page Down, or the arrows).',
    ),
    warn,
    list,
    h('button', { onclick: () => (resetKeys(), paint()) }, 'Reset to defaults'),
  )
}
