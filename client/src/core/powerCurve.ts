import { CFG } from '../config'
import { defaultCurve, type Profile } from './curve'

const DAY = 86400000
const D = CFG.curveDurations
export const CURVE_MAX = D[D.length - 1]

export interface CurvePt {
  d: number
  w: number
  /** True when the point comes from a real effort rather than the FTP estimate. */
  real: boolean
  /** ISO date the effort was set; null for estimates. */
  date: string | null
}
export interface CurveLine {
  key: 'all' | 'd90' | 'last' | 'mate'
  label: string
  /** Crewmates only: their colour and weight (no weight, no W/kg). */
  colour?: string
  kg?: number
  pts: CurvePt[]
}

/** All-time, 90-day and last-ride curves with the date each point was set. The last ride only has its real points. */
export function curveLines(p: Profile, now = Date.now()): CurveLine[] {
  const def = defaultCurve(p.ftp)
  const cutoff = now - CFG.bestWindowDays * DAY
  const recent = p.rides.filter((r) => Date.parse(r.date) >= cutoff)
  const all: CurvePt[] = []
  const d90: CurvePt[] = []
  for (const d of D) {
    const a = p.allTime[d]
    const est: CurvePt = { d, w: def[d], real: false, date: null }
    all.push(a ? { d, w: a.w, real: true, date: a.date } : est)
    const top = recent
      .filter((r) => r.best[d])
      .reduce<{ w: number; date: string } | null>(
        (m, r) => (!m || r.best[d] > m.w ? { w: r.best[d], date: r.date } : m),
        null,
      )
    d90.push(top ? { d, w: top.w, real: true, date: top.date } : (all[all.length - 1] ?? est))
  }
  const last = p.rides.reduce<Profile['rides'][number] | null>(
    (m, r) => (!m || r.date >= m.date ? r : m),
    null,
  )
  const lastPts = last
    ? D.filter((d) => last.best[d]).map((d) => ({
        d,
        w: last.best[d],
        real: true,
        date: last.date,
      }))
    : []
  // Estimates from FTP only stand in until there is a real effort; mixed in, they make the curve climb.
  const tidy = (pts: CurvePt[]) => (pts.some((q) => q.real) ? pts.filter((q) => q.real) : pts)
  return [
    { key: 'all', label: 'All time', pts: tidy(all) },
    { key: 'd90', label: 'Last 90 days', pts: tidy(d90) },
    { key: 'last', label: 'Last ride', pts: lastPts },
  ]
}

/** Position of a duration along a 1 s to 60 min log axis, 0..1. */
export const xFrac = (d: number) => Math.log(d) / Math.log(CURVE_MAX)

/** The curve duration closest (in log time) to a 0..1 position on the axis. */
export const nearestDur = (f: number) =>
  D.reduce((best, d) => (Math.abs(xFrac(d) - f) < Math.abs(xFrac(best) - f) ? d : best), D[0])

/** Duration label: 5 s, 20 min, 1 h. */
export const fmtDur = (s: number) =>
  s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${s / 3600} h`

/** Y value for the chart: watts, or W/kg (rounded to two places) when a weight is given. */
export const yValue = (w: number, kg?: number) => (kg ? Math.round((w / kg) * 100) / 100 : w)

/** The weight to divide a line by: the chosen mode's weight, or the crewmate's own. */
export const lineKg = (l: CurveLine, kg?: number) => (kg && l.key === 'mate' ? l.kg : kg)

/** Top of the y axis: the highest point plus 8%, rounded up to a step of 100 W (or 1 W/kg). */
export function yTop(lines: CurveLine[], kg?: number) {
  const step = kg ? 1 : 100
  const hi = Math.max(1, ...lines.flatMap((l) => l.pts.map((q) => yValue(q.w, lineKg(l, kg)))))
  return Math.ceil((hi * 1.08) / step) * step
}
