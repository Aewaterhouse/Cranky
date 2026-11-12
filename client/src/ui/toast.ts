import { h } from './dom'

let tray: HTMLElement | null = null

/** Short message in the corner; replaces alert(). */
export function toast(msg: string, kind: 'info' | 'bad' | 'good' = 'info') {
  if (!tray?.isConnected) document.body.append((tray = h('div', { class: 'tray' })))
  const t = h('div', { class: `note ${kind}`, role: 'status' }, msg)
  tray.append(t)
  setTimeout(() => t.classList.add('out'), 3800)
  setTimeout(() => t.remove(), 4200)
}

/** Centred dialog; returns a close function. Escape or a backdrop click also closes. */
export function modal(title: string, ...body: (Node | string)[]) {
  const close = () => {
    back.remove()
    removeEventListener('keydown', esc)
  }
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
  const back: HTMLElement = h(
    'div',
    { class: 'backdrop', onclick: (e) => e.target === back && close() },
    h(
      'div',
      { class: 'modal', role: 'dialog' },
      h(
        'header',
        {},
        h('h2', {}, title),
        h('button', { class: 'x', 'aria-label': 'Close', onclick: close }, '×'),
      ),
      ...body,
    ),
  )
  addEventListener('keydown', esc)
  document.body.append(back)
  return close
}
