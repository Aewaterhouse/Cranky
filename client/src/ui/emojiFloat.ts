import '../emojiFloat.css'
import { h } from './dom'

/**
 * Reactions: a tray of buttons that sends one, and a layer on the page where everyone's float up and fade. The HUD is
 * zoomed, so the layer lives on the page itself; it goes when `owner` leaves the page.
 */
export function emojiFloat(list: string[], send: (e: string) => void, owner: () => HTMLElement) {
  const float = h('div', { class: 'emoji-float' })
  return {
    tray: h(
      'div',
      { class: 'emoji-tray' },
      ...list.map((e) => h('button', { onclick: () => send(e) }, e)),
    ),
    show(text: string) {
      const e = h('i', {}, text)
      e.style.setProperty('--x', `${Math.random() * 18}vw`)
      if (!float.isConnected) document.body.append(float)
      float.append(e)
      if (!owner().isConnected) float.remove()
      setTimeout(() => e.remove(), 3200)
    },
  }
}
