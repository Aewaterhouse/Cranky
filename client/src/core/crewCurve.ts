import { CFG } from '../config'
import { fmtDur, type CurveLine } from './powerCurve'

export interface CrewRider {
  id: string
  name: string
  weightKg: number | null
  best: Record<number, { w: number; date: string }>
}
export interface BoardRow {
  id: string
  name: string
  w: number
  /** W/kg, or null when the rider has no weight. */
  wkg: number | null
  date: string
}

/** Riders ranked by their all-time best at a duration. Riders without a weight are left out of W/kg. */
export function leaderboard(riders: CrewRider[], d: number, perKg: boolean): BoardRow[] {
  return riders
    .filter((r) => r.best[d] && (!perKg || r.weightKg))
    .map((r) => ({
      id: r.id,
      name: r.name,
      w: r.best[d].w,
      wkg: r.weightKg ? Math.round((r.best[d].w / r.weightKg) * 100) / 100 : null,
      date: r.best[d].date,
    }))
    .sort((a, b) => (perKg ? b.wkg! - a.wkg! : b.w - a.w))
}

/** A crewmate's real all-time bests as a chart line; the colour follows their place in the crew. */
export function mateLine(r: CrewRider, i: number): CurveLine {
  const pts = CFG.curveDurations
    .filter((d) => r.best[d])
    .map((d) => ({ d, w: r.best[d].w, real: true, date: r.best[d].date }))
  return {
    key: 'mate',
    label: r.name,
    pts,
    colour: CFG.crewColours[i % CFG.crewColours.length],
    kg: r.weightKg ?? undefined,
  }
}

/**
 * One line of crew rivalry for the Power tab: the crowns you hold and who is closest behind, else the crown you are
 * nearest to taking. Empty with nobody to race.
 */
export function crownLine(riders: CrewRider[], me: string): string {
  const boards = CFG.crewDurations.map((d) => ({ d, rows: leaderboard(riders, d, false) }))
  const mine = boards.filter((b) => b.rows.length > 1 && b.rows[0].id === me)
  if (mine.length) {
    const close = mine
      .map((b) => ({ ...b, gap: b.rows[0].w - b.rows[1].w }))
      .sort((a, b) => a.gap - b.gap)[0]
    const names = mine.map((b) => fmtDur(b.d)).join(', ')
    return `👑 You hold the crew's ${names} crown${mine.length > 1 ? 's' : ''}. ${close.rows[1].name} is ${close.gap} W behind at ${fmtDur(close.d)}.`
  }
  const chase = boards
    .flatMap(({ d, rows }) => {
      const at = rows.findIndex((r) => r.id === me)
      return at > 0
        ? [{ d, lead: rows[0], gap: rows[0].w - rows[at].w, share: rows[at].w / rows[0].w }]
        : []
    })
    .sort((a, b) => b.share - a.share)[0]
  return chase
    ? `${chase.lead.name} holds the ${fmtDur(chase.d)} crown, ${chase.gap} W ahead of you. Go and get it.`
    : ''
}
