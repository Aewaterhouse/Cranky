import { CFG } from '../config'
import type { RideRecord } from './curve'

/** Typical intensity factor of each power zone, for estimating the TSS of rides recorded without one. */
const ZONE_IF = [0.45, 0.65, 0.83, 0.98, 1.12, 1.35, 1.8]
/** Intensity used when a ride has neither TSS nor zone data. */
const PLAIN_IF = 0.65

const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar day as yyyy-mm-dd. */
export const dayKey = (t: number | string | Date) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** The day `n` days after `d`, at local midday so daylight saving never shifts it. */
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)

/** Recorded TSS, or an estimate from time in each zone (or plain seconds) for older rides. */
export function rideTss(r: RideRecord): number {
  if (r.tss != null) return r.tss
  const z = r.zones ?? []
  if (z.some((s) => s > 0)) return z.reduce((a, s, i) => a + (s / 3600) * ZONE_IF[i] ** 2 * 100, 0)
  return (r.secs / 3600) * PLAIN_IF ** 2 * 100
}

/** TSS summed by local day. */
export function dailyTss(rides: RideRecord[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rides) m.set(dayKey(r.date), (m.get(dayKey(r.date)) ?? 0) + rideTss(r))
  return m
}

export interface FitnessDay {
  day: string
  tss: number
  ctl: number
  atl: number
  tsb: number
}

/**
 * Fitness (CTL), fatigue (ATL) and form (TSB) for each of the last `days` days up to `end`.
 * Both are exponentially weighted averages of daily TSS; the form on a day is the CTL minus the ATL
 * from the day before, as in TrainingPeaks.
 */
export function fitness(daily: Map<string, number>, end: Date, days = CFG.trends.fitnessDays) {
  const first = [...daily.keys()].sort()[0]
  const span = first
    ? Math.max(days, Math.round((+end - +new Date(`${first}T12:00`)) / 86400000) + 1)
    : days
  const [kc, ka] = [CFG.trends.ctlDays, CFG.trends.atlDays].map((n) => 1 - Math.exp(-1 / n))
  let ctl = 0
  let atl = 0
  const out: FitnessDay[] = []
  for (let i = span - 1; i >= 0; i--) {
    const day = dayKey(addDays(end, -i))
    const tss = daily.get(day) ?? 0
    const tsb = ctl - atl
    ctl += (tss - ctl) * kc
    atl += (tss - atl) * ka
    out.push({ day, tss, ctl, atl, tsb })
  }
  return out.slice(-days)
}

/** Monday of the week containing `d`. */
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

/** TSS per week (Monday start) for the last `weeks` weeks, oldest first. */
export function weeklyTss(daily: Map<string, number>, end: Date, weeks = CFG.trends.weeks) {
  const start = addDays(monday(end), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) => {
    const from = addDays(start, 7 * w)
    let tss = 0
    for (let i = 0; i < 7; i++) tss += daily.get(dayKey(addDays(from, i))) ?? 0
    return { start: dayKey(from), tss }
  })
}

export interface HeatCell {
  day: string
  /** Null on a rest day. */
  tss: number | null
  future: boolean
}

/** Calendar grid: `weeks` columns (oldest first) of seven days, Monday at the top. */
export function heatmap(daily: Map<string, number>, end: Date, weeks = CFG.trends.heatWeeks) {
  const start = addDays(monday(end), -7 * (weeks - 1))
  const today = dayKey(end)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i): HeatCell => {
      const day = dayKey(addDays(start, 7 * w + i))
      return { day, tss: daily.get(day) ?? null, future: day > today }
    }),
  )
}

/** Consecutive riding days: the run ending today (or yesterday, so the streak survives until tonight) and the best ever. */
export function streaks(daily: Map<string, number>, end: Date) {
  const days = [...daily.keys()].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of days) {
    run = prev && dayKey(addDays(new Date(`${prev}T12:00`), 1)) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  let current = 0
  let d = daily.has(dayKey(end)) ? end : addDays(end, -1)
  while (daily.has(dayKey(d))) {
    current++
    d = addDays(d, -1)
  }
  return { current, best }
}
