import { BOARD_LINES } from '../fun/boardLines'
import type { CrewRow } from './efforts'

export type BoardBy = 'time' | 'wkg'
export interface BoardRow extends CrewRow {
  rank: number
  me: boolean
}

/** Rows in board order with ranks (equal results share a rank) and the caller's row marked. */
export function boardRows(rows: CrewRow[], me: string, by: BoardBy = 'time'): BoardRow[] {
  const val = (r: CrewRow) => (by === 'wkg' ? -(r.wkg ?? 0) : r.secs)
  const sorted = [...rows].sort((a, b) => val(a) - val(b) || a.date.localeCompare(b.date))
  let rank = 0
  return sorted.map((r, i) => {
    if (!i || val(r) !== val(sorted[i - 1])) rank = i + 1
    return { ...r, rank, me: r.id === me }
  })
}

/** "1st", "2nd", "11th". */
export function ordinal(n: number) {
  const t = n % 100
  const end = t >= 11 && t <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${end}`
}

/** "You are 2nd of 5", or a nudge when the rider has no time on the segment. */
export function rankText(rows: BoardRow[]) {
  const mine = rows.find((r) => r.me)
  if (!mine) return rows.length ? 'You have no time here yet.' : 'Nobody has a time here yet.'
  return `You are ${ordinal(mine.rank)} of ${rows.length}`
}

/** A dry line under the leader, picked from the result so the same board always says the same thing. */
export function leaderLine(leader: BoardRow, alone: boolean) {
  const set = BOARD_LINES[alone ? 'alone' : leader.me ? 'me' : 'mate']
  return set[Math.round(leader.secs * 10) % set.length].replace('{name}', leader.name)
}

/**
 * The top three of a segment for the ride's stats drawer: the crew's rows with my best as it stands now (a PR
 * set this ride is not on the server's list yet), fastest first.
 */
export function topThree(
  crew: CrewRow[],
  me: { id: string; name: string },
  prS?: number,
): BoardRow[] {
  const rows = crew.filter((r) => r.id !== me.id)
  const mine = crew.find((r) => r.id === me.id)
  const secs = Math.min(mine?.secs ?? Infinity, prS ?? Infinity)
  if (isFinite(secs)) rows.push({ ...me, date: mine?.date ?? '', secs })
  return boardRows(rows, me.id).slice(0, 3)
}
