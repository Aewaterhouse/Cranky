import type { Tick } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'

/** Galley Ship: the drum's beat against your cadence, the crew's sync, the pirates' gap and the hull. */
export function makeGalleyPanel(): GamePanel {
  const beat = h('b', { class: 'gal-beat' })
  const you = h('span', {})
  const sync = h('i', {})
  const gap = h('b', {})
  const hull = h('b', {})
  const root = h(
    'section',
    { class: 'hud-glass am' },
    h('div', { class: 'bs-head' }, h('label', {}, '🥁 ROW AT'), beat),
    you,
    h('div', { class: 'bs-head' }, h('label', {}, 'CREW IN TIME'), h('span', {})),
    h('div', { class: 'bs-bar' }, sync),
    h('div', { class: 'bs-head' }, h('label', {}, '🏴‍☠️ PIRATES'), gap),
    h('div', { class: 'bs-head' }, h('label', {}, '🛶 HULL'), hull),
  )
  return {
    root,
    update(m: Tick, me: string) {
      const g = m.game as {
        beat: number
        sync: number
        gap: number
        hull: number
        tol: number
      } | null
      if (!g?.beat) return
      const cad = Math.round(m.riders[me]?.cad ?? 0)
      beat.textContent = `${g.beat} rpm`
      const off = cad - g.beat
      you.textContent = `You: ${cad} rpm ${Math.abs(off) <= g.tol ? '✓ on the beat' : off < 0 ? '↑ faster' : '↓ slower'}`
      sync.style.width = `${Math.round(g.sync * 100)}%`
      gap.textContent = `${Math.round(g.gap)} m`
      hull.textContent = `${g.hull}`
    },
    fx(fx, sp) {
      if (fx.k === 'drum') sp.splash('sp-smash', '🥁 NEW BEAT', fx.text ?? '', 2600, 2)
      else if (fx.k === 'boarded') sp.splash('sp-fell', '🏴‍☠️ BOARDED', fx.text ?? '', 3000, 3)
    },
  }
}
