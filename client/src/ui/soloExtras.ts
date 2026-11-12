import { h } from './dom'

/** A context button the player shows only when it makes sense (I'm done, +5 min, ...). */
export interface SoloAction {
  id: string
  label: string
  title?: string
  cls?: string
  run: () => void
}

/** Strip of context buttons under the header. Rebuilt only when the set of actions changes. */
export function soloActions() {
  const root = h('div', { class: 'sactions' })
  let key = ''
  return {
    root,
    set(list: SoloAction[]) {
      const k = list.map((a) => a.id + a.label).join('|')
      if (k === key) return
      key = k
      root.classList.toggle('on', list.length > 0)
      root.replaceChildren(
        ...list.map((a) =>
          h('button', { class: a.cls ?? '', title: a.title, onclick: a.run }, a.label),
        ),
      )
    },
  }
}
