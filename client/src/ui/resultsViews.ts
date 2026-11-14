import { h, stars } from './dom'

export interface GroupSummary {
  /** The crew game's id; absent for the bus. */
  mode?: string
  distance: number
  armour: number
  syncPct: number
  scrap: number
  score: number
  riders: {
    id: string
    name: string
    compliance: number
    inBandSecs: number
    sprints: string[]
    falls: number
    /** VO2 Madness: effort points and seconds over 90% of max heart rate. */
    points?: number
    redSecs?: number
    /** Kidney Stone Express: power spread (% FTP), spikes and fines. */
    spread?: number
    spikes?: number
    fines?: number
    /** Speed Dating: average match (0..1), best date's name and red flags. */
    match?: number
    best?: string
    flags?: string[]
    /** Climate Lawsuit: the company, its coins and emissions, and whether it took the bribe. */
    company?: string
    coins?: number
    emit?: number
    bribed?: boolean
  }[]
  /** Speed Dating: couples by points, who married, who won the Divorce, and the leaked chat. */
  couples?: { a: string; b: string; pts: number }[]
  /** Names, as the server sends them. */
  married?: { a: string; b: string } | null
  divorced?: { winner: string; loser: string } | null
  chat?: string[]
  /** Climate Lawsuit: whether the town flooded, how far the sea got and the Trial's verdicts. */
  flooded?: boolean
  stageName?: string
  verdicts?: Record<string, 'guilty' | 'acquitted'>
  /** The crew's best score in this game before this ride (none the first time). */
  crewBest?: number | null
  /** Kidney Stone Express: each patient's Google review. */
  reviews?: { patient: string; icon: string; stars: number; text: string }[]
  awards: { award: string; id: string; name: string; why: string }[]
  postcard?: string
}

export const tile = (label: string, value: string, cls = '') =>
  h('div', { class: `res-tile ${cls}` }, h('span', {}, label), h('b', {}, value))

/**
 * The leaked chat, readable: the game's own commentary (the lines that are not emoji traffic) and the last few
 * messages, with the whole thing folded away under "Read the whole chat".
 */
function chatLines(chat: string[]) {
  const line = (l: string) => h('p', { class: 'res-review' }, l)
  const said = chat.filter((l) => !/^Date \d+ · .+ → .+: /.test(l))
  const top = [...new Set([...said, ...chat.slice(-3)])].slice(-CHAT_TOP)
  if (chat.length <= CHAT_TOP) return chat.map(line)
  return [
    ...top.map(line),
    h(
      'details',
      {},
      h('summary', {}, `Read the whole chat (${chat.length} messages)`),
      ...chat.map(line),
    ),
  ]
}
const CHAT_TOP = 8

const who = (g: GroupSummary, id: string) => g.riders.find((r) => r.id === id)?.name ?? '?'

type Row = GroupSummary['riders'][number]
/** What differs between games on the crew card: the tiles after distance, one table column and an extra card. */
export const VIEWS: Record<
  string,
  {
    tiles: (g: GroupSummary) => Node[]
    col: string
    cell: (r: Row) => string
    extra?: (g: GroupSummary) => Node | ''
  }
> = {
  bus: {
    tiles: (g) => [
      g.armour <= 0
        ? tile('Armour', 'Wrecked, but home')
        : tile('Armour', String(Math.round(g.armour))),
      tile('Sync', `${Math.round(g.syncPct)}%`),
    ],
    col: 'Falls',
    cell: (r) => String(r.falls),
  },
  madness: {
    tiles: () => [],
    col: 'Points · in the red',
    cell: (r) => `${r.points ?? 0} · ${r.redSecs ?? 0} s`,
  },
  ambo: {
    tiles: (g) => {
      const rv = g.reviews ?? []
      const avg = rv.reduce((a, r) => a + r.stars, 0) / (rv.length || 1)
      return [
        tile('Delivered', `${rv.filter((r) => r.stars > 1).length} / ${rv.length}`),
        tile('Rating', `${avg.toFixed(1)} ★`),
      ]
    },
    col: 'Spread · spikes · fines',
    cell: (r) => `${(r.spread ?? 0).toFixed(1)}% · ${r.spikes ?? 0} · ${r.fines ?? 0}`,
    extra: (g) =>
      g.reviews?.length
        ? h(
            'div',
            { class: 'card' },
            h('h2', {}, 'Google reviews'),
            ...g.reviews.map((r) =>
              h(
                'p',
                { class: 'res-review' },
                h('b', {}, `${r.icon} ${r.patient} `),
                h('span', { class: 'res-stars' }, stars(r.stars)),
                h('br', {}),
                r.text,
              ),
            ),
          )
        : '',
  },
  date: {
    tiles: (g) => [
      tile('Married', g.married ? `${g.married.a} + ${g.married.b}` : 'Nobody', 'words'),
      tile('Kept the house', g.divorced ? g.divorced.winner : 'No divorce', 'words'),
    ],
    col: 'Match · best date · red flags',
    cell: (r) =>
      `${Math.round((r.match ?? 0) * 100)}% · ${r.best ?? '–'} · ${r.flags?.join(', ') || 'none'}`,
    extra: (g) =>
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Couples'),
        ...(g.couples ?? []).map((c, i) =>
          h(
            'p',
            { class: 'res-review' },
            `${i + 1}. ${who(g, c.a)} + ${who(g, c.b)} · ${Math.round(c.pts)} pts`,
          ),
        ),
        g.chat?.length ? h('h2', {}, 'The leaked group chat') : '',
        ...chatLines(g.chat ?? []),
      ),
  },
  climate: {
    tiles: (g) => [
      tile('The town', g.flooded ? 'Flooded' : 'Survived', 'words'),
      tile('Sea level', g.stageName ?? 'Dry', 'words'),
    ],
    col: 'Company · coins · emissions',
    cell: (r) =>
      `${r.company ?? '–'} · ${Math.round(r.coins ?? 0)} 🪙 · ${Math.round(r.emit ?? 0)} t${r.bribed ? ' · 💰 bribed' : ''}`,
    extra: (g) =>
      g.verdicts && Object.keys(g.verdicts).length
        ? h(
            'div',
            { class: 'card' },
            h('h2', {}, 'The Trial'),
            ...Object.entries(g.verdicts).map(([id, v]) =>
              h(
                'p',
                { class: 'res-review' },
                `${who(g, id)}: ${v === 'guilty' ? '🔨 guilty. Wears the sash until acquitted.' : '🎉 acquitted on a technicality.'}`,
              ),
            ),
          )
        : '',
  },
}

/** Everyone's best bit of the ride, as one line: the stat where they ranked highest in the crew. */
const MVP: [string, (r: Row) => number | undefined][] = [
  ['Most on target', (r) => r.compliance],
  ['Longest in the zone', (r) => r.inBandSecs],
  ['Smoothest legs', (r) => (r.spread == null ? undefined : -r.spread)],
  ['Best matched', (r) => r.match],
  ['Richest company', (r) => r.coins],
  ['Top points', (r) => r.points],
  ['Most sprints', (r) => r.sprints.length || undefined],
]
export function mvpLine(r: Row, all: Row[]) {
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
