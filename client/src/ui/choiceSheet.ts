import '../choiceSheet.css'
import type { Ask } from '../net/protocol'
import { h } from './dom'

/**
 * A crew game's question to this rider (a card to play, a fuel, a vote), bottom centre. The server sends the
 * question in the rider's tick; a tap or the number keys 1 to 9 answer it with an `act` of the same key.
 */
export function choiceSheet(onPick: (k: string, v: string) => void) {
  const root = h('div', { class: 'choice glass', hidden: true })
  let ask: Ask | null = null
  let key = ''
  const pick = (v: string) => ask && !ask.opts.find((o) => o.v === v)?.off && onPick(ask.k, v)
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) return removeEventListener('keydown', onKey)
    const o = ask?.opts[Number(e.key) - 1]
    if (o && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement)?.tagName !== 'INPUT') pick(o.v)
  }
  addEventListener('keydown', onKey)
  return {
    root,
    update(a: Ask | null | undefined) {
      ask = a ?? null
      root.hidden = !ask
      if (!ask) return void (key = '')
      const k = JSON.stringify([ask.k, ask.title, ask.sub, ask.opts, ask.v])
      if (k !== key) {
        key = k
        root.replaceChildren(
          h('div', { class: 'ch-head' }, h('b', {}, ask.title), h('span', { class: 'ch-left' })),
          ask.sub ? h('div', { class: 'ch-sub' }, ask.sub) : '',
          h(
            'div',
            { class: 'ch-opts' },
            ...ask.opts.map((o, i) =>
              h(
                'button',
                {
                  class: `ch-opt${o.v === ask!.v ? ' on' : ''}`,
                  disabled: !!o.off,
                  onclick: () => pick(o.v),
                },
                h('kbd', {}, `${i + 1}`),
                o.icon ? h('span', { class: 'ch-icon' }, o.icon) : '',
                h('b', {}, o.label),
                o.sub ? h('small', {}, o.sub) : '',
              ),
            ),
          ),
        )
      }
      root.querySelector('.ch-left')!.textContent =
        ask.left == null ? '' : `${Math.max(0, Math.ceil(ask.left))} s`
    },
  }
}
