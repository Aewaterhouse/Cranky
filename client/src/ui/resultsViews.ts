import { h } from './dom'

export interface GroupSummary {
  /** The crew game's id: absent for the bus, or a game that has gone on an old ride. */
  mode?: string
  distance: number
  armour: number
  syncPct: number
  score: number
  riders: {
    id: string
    name: string
    /** On the simulated trainer: a test rider, left out of the crew's records and best bits. */
    test?: boolean
    compliance: number
    inBandSecs: number
    sprints: string[]
    falls: number
  }[]
  /** The crew's best score in this game before this ride (none the first time). */
  crewBest?: number | null
  /** Held titles that changed hands or stayed put this ride ("Kat takes 🔨 Roadblock MVP from Dazza"). */
  titles?: string[]
  /** A campaign ride: how the leg went. */
  campaign?: string
  /** The bus ride's best moments: ride seconds and what happened. */
  highlights?: { t: number; text: string }[]
  awards: { award: string; id: string; name: string; why: string }[]
  postcard?: string
}

export const tile = (label: string, value: string, cls = '') =>
  h('div', { class: `res-tile ${cls}` }, h('span', {}, label), h('b', {}, value))

type Row = GroupSummary['riders'][number]
/** The bus's tiles after distance and its own table column. */
export const BUS_VIEW = {
  tiles: (g: GroupSummary) => [
    g.armour <= 0
      ? tile('Armour', 'Wrecked, but home')
      : tile('Armour', String(Math.round(g.armour))),
    tile('Sync', `${Math.round(g.syncPct)}%`),
  ],
  col: 'Falls',
  cell: (r: Row) => String(r.falls ?? 0),
}

/** Everyone's best bit of the ride, as one line: the stat where they ranked highest in the crew. */
const MVP: [string, (r: Row) => number | undefined][] = [
  ['Most on target', (r) => r.compliance],
  ['Longest in the zone', (r) => r.inBandSecs],
  ['Most sprints', (r) => r.sprints.length || undefined],
]
export function mvpLine(r: Row, everyone: Row[]) {
  if (r.test) return 'Test ride (simulator)'
  const all = everyone.filter((o) => !o.test)
  let best: [string, number] | null = null
  for (const [label, get] of MVP) {
    const v = get(r)
    if (v == null) continue
    const rank = all.filter((o) => (get(o) ?? -Infinity) > v).length
    if (!best || rank < best[1]) best = [label, rank]
  }
  if (!best) return ''
  return best[1] === 0
    ? `🏅 ${best[0]}`
    : `${best[0]}: ${best[1] + 1}${['st', 'nd', 'rd'][best[1]] ?? 'th'} in the crew`
}
