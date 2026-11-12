import type { RiderTick } from '../net/protocol'
import { avatar, h } from './dom'
import { compColour, set } from './hudKit'

const HAUL_S = 20

interface Row {
  root: HTMLElement
  tier: HTMLElement
  badge: HTMLElement
  bar: HTMLElement
  watts: HTMLElement
}

/** Right-hand crew roster. Rows are kept and updated in place. */
export function makeRoster(footer: Node) {
  const list = h('div', { class: 'rs-list' })
  const root = h('section', { class: 'hud-glass rs' }, list, footer)
  const rows = new Map<string, Row>()
  const fellAt = new Map<string, number>()
  return {
    root,
    update(riders: Record<string, RiderTick>, meId: string, el: number) {
      for (const [id, r] of Object.entries(riders)) {
        let row = rows.get(id)
        if (!row) {
          const tier = h('span', { class: 'rs-tier' })
          const badge = h('span', { class: 'rs-badge' })
          const bar = h('i', {})
          const watts = h('b', {})
          row = {
            root: h(
              'div',
              { class: `rs-row${id === meId ? ' me' : ''}` },
              avatar(r.name),
              h(
                'div',
                { class: 'rs-mid' },
                h('div', { class: 'rs-name' }, h('span', {}, r.name), tier, badge),
                h('div', { class: 'rs-bar' }, bar),
              ),
              h('div', { class: 'rs-w' }, watts, h('small', {}, 'W')),
            ),
            tier,
            badge,
            bar,
            watts,
          }
          rows.set(id, row)
          list.append(row.root)
        }
        if (r.st === 'fell' && !fellAt.has(id)) fellAt.set(id, el)
        if (r.st !== 'fell') fellAt.delete(id)
        const left = Math.max(0, HAUL_S - (el - (fellAt.get(id) ?? el)))
        row.root.dataset.st = r.st
        set(row.tier, r.tier[0].toUpperCase())
        row.tier.dataset.t = r.tier
        set(row.watts, r.st === 'riding' ? `${Math.round(r.w)}` : '–')
        set(
          row.badge,
          r.st === 'fell'
            ? `FELL OFF · ${Math.ceil(left)}s`
            : r.st === 'spectator'
              ? 'SPECTATING'
              : '',
        )
        const frac = r.st === 'fell' ? left / HAUL_S : (r.s ?? 0)
        row.bar.style.width = `${Math.round(frac * 100)}%`
        row.bar.style.background = r.st === 'fell' ? 'var(--bad)' : compColour(r.s)
        row.bar.parentElement!.classList.toggle('free', r.st === 'riding' && r.s == null)
      }
      for (const [id, row] of rows)
        if (!riders[id]) {
          row.root.remove()
          rows.delete(id)
        }
    },
  }
}
