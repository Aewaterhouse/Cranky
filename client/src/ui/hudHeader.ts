import type { Frame, Plan, Tier } from '../types'
import { fmt, h } from './dom'
import { eventOf, set } from './hudKit'
import { planGraph } from './planGraph'

/** Top-centre event header: event chip, block clock, next-block preview, plan timeline. */
export function makeHeader(plan: Plan | undefined, tier: Tier) {
  const icon = h('span', { class: 'eh-icon' }),
    name = h('span', { class: 'eh-name' }),
    label = h('span', { class: 'eh-label' }),
    left = h('b', { class: 'eh-left' }),
    next = h('div', { class: 'eh-next' }),
    elapsed = h('span', {}),
    total = h('span', {}),
    rbFill = h('i', {}),
    rb = h('div', { class: 'eh-rb' }, h('span', {}, 'ROADBLOCK'), h('div', {}, rbFill))
  const tl = h('div', { class: 'eh-tl' })
  let graph: ReturnType<typeof planGraph> | null = null
  const build = (t: Tier) => {
    if (!plan) return
    graph = planGraph(plan.blocks, t)
    tl.replaceChildren(elapsed, graph, total)
  }
  build(tier)
  const root = h(
    'header',
    { class: 'hud-glass eh' },
    h('div', { class: 'eh-main' }, h('div', { class: 'eh-chip' }, icon, name), label, left),
    next,
    tl,
    rb,
  )
  return {
    root,
    setTier: build,
    /** `mask` replaces the next block's name and watts (the VO2 Madness mystery box). */
    update(
      f: Frame,
      ev: string,
      elapsedS: number,
      totalS: number,
      rbProg: number | null,
      mask?: string,
    ) {
      const e = eventOf(ev)
      root.style.setProperty('--ev', e.col)
      set(icon, e.icon)
      set(name, e.name)
      set(label, f.label.toLowerCase() === e.name.toLowerCase() ? '' : f.label)
      set(left, fmt(f.dur - f.bel))
      set(
        next,
        f.next
          ? `NEXT  ${mask ?? `${f.next.label}${f.next.tgt ? ` · ${f.next.tgt} W` : ''}`}  in ${fmt(f.next.in)}`
          : 'LAST BLOCK',
      )
      graph?.setProgress(elapsedS)
      set(elapsed, fmt(elapsedS))
      set(total, fmt(totalS))
      rb.classList.toggle('on', rbProg != null)
      rbFill.style.width = `${(rbProg ?? 0) * 100}%`
    },
  }
}
