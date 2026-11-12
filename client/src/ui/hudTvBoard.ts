import type { RiderTick } from '../net/protocol'
import type { Grade } from '../types'
import { avatar, h } from './dom'
import { compColour, GRADE_COLOUR, set } from './hudKit'

interface Row {
  root: HTMLElement
  tier: HTMLElement
  badge: HTMLElement
  bar: HTMLElement
  pct: HTMLElement
  watts: HTMLElement
  grades: HTMLElement
  nGrades: number
}

/** The big TV crew leaderboard. Rows keep seat order and are patched in place. */
export function makeTvBoard() {
  const list = h('div', { class: 'tvb-list' })
  const root = h('section', { class: 'hud-glass tvb' }, h('h2', {}, 'CREW'), list)
  const rows = new Map<string, Row>()
  const build = (r: RiderTick): Row => {
    const tier = h('span', { class: 'tvb-tier' })
    const badge = h('span', { class: 'tvb-badge' })
    const bar = h('i', {})
    const pct = h('small', {})
    const watts = h('b', {})
    const grades = h('div', { class: 'tvb-grades' })
    return {
      root: h(
        'div',
        { class: 'tvb-row' },
        avatar(r.name),
        h(
          'div',
          { class: 'tvb-mid' },
          h('div', { class: 'tvb-name' }, h('span', {}, r.name), tier, badge),
          h('div', { class: 'tvb-bar' }, bar, pct),
          grades,
        ),
        h('div', { class: 'tvb-w' }, watts, h('small', {}, 'W')),
      ),
      tier,
      badge,
      bar,
      pct,
      watts,
      grades,
      nGrades: -1,
    }
  }
  return {
    root,
    update(riders: Record<string, RiderTick>, grades: Map<string, Grade[]>) {
      for (const [id, r] of Object.entries(riders)) {
        let row = rows.get(id)
        if (!row) {
          row = build(r)
          rows.set(id, row)
          list.append(row.root)
        }
        row.root.dataset.st = r.st
        set(row.tier, r.tier.toUpperCase())
        row.tier.dataset.t = r.tier
        set(row.watts, r.st === 'riding' ? `${Math.round(r.w)}` : '–')
        set(row.badge, r.st === 'fell' ? 'FELL OFF' : r.st === 'spectator' ? 'SPECTATING' : '')
        row.bar.style.width = `${r.st === 'riding' ? Math.round((r.s ?? 0) * 100) : 0}%`
        row.bar.style.background = compColour(r.s)
        set(row.pct, r.st === 'riding' && r.s != null ? `${Math.round(r.s * 100)}%` : '')
        const g = grades.get(id) ?? []
        if (g.length !== row.nGrades) {
          row.nGrades = g.length
          row.grades.replaceChildren(
            ...g.map((x) =>
              h('i', { style: `--g:${GRADE_COLOUR[x]}` }, x === 'LEGEND' ? 'LGD' : x),
            ),
          )
        }
      }
      for (const [id, row] of rows)
        if (!riders[id]) {
          row.root.remove()
          rows.delete(id)
        }
    },
  }
}
