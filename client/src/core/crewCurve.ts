import { CFG } from '../config'
import type { CurveLine } from './powerCurve'

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
