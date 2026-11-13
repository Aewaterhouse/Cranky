import type { RiderTick } from '../net/protocol'
import { crewShares } from '../core/hud'
import { h } from './dom'
import { compColour, hrColour, set } from './hudKit'

const HAUL_S = 20

interface Row {
  root: HTMLElement
  tier: HTMLElement
  watts: HTMLElement
  status: HTMLElement
  hr: HTMLElement
}

/**
 * The crew, on the right edge in the rider list's rows: name and tier, watts and share of the crew's, compliance (or what happened to
 * them) and heart rate. Rows are kept and updated in place; mine is the highlighted one.
 */
export function makeRoster() {
  const root = h('div', { class: 'glass rlist crew' })
  const rows = new Map<string, Row>()
  const fellAt = new Map<string, number>()
  return {
    root,
    update(riders: Record<string, RiderTick>, meId: string, el: number) {
      const { share, carrier } = crewShares(riders)
      for (const [id, r] of Object.entries(riders)) {
        let row = rows.get(id)
        if (!row) {
          const tier = h('small', {})
          const watts = h('span', { class: 'rw' })
          const status = h('span', { class: 'rg' })
          const hr = h('span', { class: 'rb' })
          row = {
            root: h(
              'div',
              { class: `rrow${id === meId ? ' me' : ''}` },
              h('span', { class: 'rn' }, r.name, tier),
              watts,
              status,
              hr,
            ),
            tier,
            watts,
            status,
            hr,
          }
          rows.set(id, row)
          root.append(row.root)
        }
        if (r.st === 'fell' && !fellAt.has(id)) fellAt.set(id, el)
        if (r.st !== 'fell') fellAt.delete(id)
        const left = Math.max(0, HAUL_S - (el - (fellAt.get(id) ?? el)))
        row.root.dataset.st = r.st
        set(row.tier, r.tier[0].toUpperCase())
        row.tier.title = `${r.tier} tier`
        // watts and this rider's share of the crew's; 💪 on whoever carries most while someone is off
        const pct = `${Math.round((share[id] ?? 0) * 100)}%`
        row.watts.replaceChildren(
          ...(r.st === 'riding'
            ? [`${id === carrier ? '💪' : ''}${Math.round(r.w)} W`, h('small', {}, pct)]
            : ['–']),
        )
        row.watts.title =
          id === carrier ? 'Carrying the crew' : "Watts, and share of the crew's work"
        set(row.hr, r.hr && r.st !== 'spectator' ? `♥ ${r.hr}` : '')
        row.hr.style.color = hrColour(r.hrp)
        set(
          row.status,
          r.st === 'fell'
            ? `fell · ${Math.ceil(left)} s`
            : r.st === 'spectator'
              ? 'watching'
              : r.s == null
                ? 'free'
                : `${Math.round(r.s * 100)}%`,
        )
        row.status.style.color = r.st === 'fell' ? 'var(--bad)' : compColour(r.s)
      }
      for (const [id, row] of rows)
        if (!riders[id]) {
          row.root.remove()
          rows.delete(id)
        }
    },
  }
}
