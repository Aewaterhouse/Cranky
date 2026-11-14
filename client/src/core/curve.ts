import type { Stamp } from './passport'
import type { WeekLog } from './weekly'
import { CFG } from '../config'
import type { Grade, Tier } from '../types'
import type { Look } from './cosmetics'
import type { PlanPick } from './trainingPlan'

export interface RideRecord {
  date: string
  secs: number
  kj: number
  best: Record<number, number>
  zones: number[]
  /** Training stress and normalised power; missing on rides recorded before they were kept. */
  tss?: number
  np?: number
  /** True when the ride had a LEGEND sprint. */
  legend?: boolean
  /** The workout or route ridden, for comparing with last time. */
  plan?: string
}
export interface Profile {
  id: string
  name: string
  ftp: number
  tier: Tier
  /** Optional max heart rate (bpm) for HR zones. */
  maxHr?: number
  restHr?: number
  weightKg?: number
  /** Six upper bounds of power zones 1..6 as a fraction of FTP; defaults to `CFG.zones`. */
  zoneBounds?: number[]
  /** Badges earned so far, id to the date they were earned (kept even after old rides drop off the list). */
  badges?: Record<string, string>
  /** Free ride: what has been ridden on each route, and the last few weeks' climbing and weekly rewards. */
  passport?: Record<string, Stamp>
  weeks?: Record<number, WeekLog>
  /** The training plan the rider is on, if any. */
  plan?: PlanPick
  /** Every FTP change, oldest first. */
  ftpHistory: { date: string; ftp: number }[]
  /** All-time real bests by duration. */
  allTime: Record<number, { w: number; date: string }>
  rides: RideRecord[]
  stats: {
    rides: number
    secs: number
    kj: number
    zones: number[]
    streak: number
    lastWeek: number
    /** Missed weeks the streak can survive. */
    freezes?: number
  }
  updated: number
  scrap: number
  owned: string[]
  look: Look
}

export const newProfile = (id: string, name = '', ftp = 200, tier: Tier = 'hard'): Profile => ({
  id,
  name,
  ftp,
  tier,
  ftpHistory: [],
  allTime: {},
  rides: [],
  updated: 0,
  scrap: 0,
  owned: [],
  look: {},
  stats: { rides: 0, secs: 0, kj: 0, zones: Array(7).fill(0), streak: 0, lastWeek: 0 },
})

const DAY = 86400000
const D = CFG.curveDurations

/** The FTP estimate's share of FTP at `d` seconds, read between the configured durations on a log scale. */
function defaultPct(d: number) {
  const pct = CFG.defaultCurvePct as Record<number, number>
  if (pct[d]) return pct[d]
  const ks = Object.keys(pct)
    .map(Number)
    .sort((a, b) => a - b)
  const hi = ks.findIndex((k) => k > d)
  if (hi <= 0) return pct[ks[hi < 0 ? ks.length - 1 : 0]]
  const [a, b] = [ks[hi - 1], ks[hi]]
  const t = Math.log(d / a) / Math.log(b / a)
  return pct[a] + (pct[b] - pct[a]) * t
}

export const defaultCurve = (ftp: number): Record<number, number> =>
  Object.fromEntries(D.map((d) => [d, Math.round(ftp * defaultPct(d))]))

/** Best average power for each curve duration from a 1 Hz power series. */
export function bestEfforts(power: number[]): Record<number, number> {
  const pre = [0]
  for (const p of power) pre.push(pre[pre.length - 1] + p)
  const out: Record<number, number> = {}
  for (const d of D) {
    if (d > power.length) continue
    let m = 0
    for (let i = d; i < pre.length; i++) m = Math.max(m, pre[i] - pre[i - d])
    out[d] = Math.round(m / d)
  }
  // Interval rides can leave a longer best a touch above a shorter one (45 s windows straddle the efforts badly);
  // a power curve never rises with duration, so a shorter best is at least any longer one.
  const ds = Object.keys(out)
    .map(Number)
    .sort((a, b) => b - a)
  ds.forEach((d, i) => i && (out[d] = Math.max(out[d], out[ds[i - 1]])))
  return out
}

export interface Point {
  w: number
  real: boolean
}
export interface Curve {
  allTime: Record<number, Point>
  d90: Record<number, Point>
}

export function curves(p: Profile, now = Date.now()): Curve {
  const def = defaultCurve(p.ftp)
  const cutoff = now - CFG.bestWindowDays * DAY
  const out: Curve = { allTime: {}, d90: {} }
  for (const d of D) {
    const a = p.allTime[d]
    out.allTime[d] = a ? { w: a.w, real: true } : { w: def[d], real: false }
    const recent = p.rides
      .filter((r) => Date.parse(r.date) >= cutoff && r.best[d])
      .map((r) => r.best[d])
    out.d90[d] = recent.length
      ? { w: Math.max(...recent), real: true }
      : a
        ? { w: a.w, real: true }
        : { w: def[d], real: false }
  }
  fill(out.allTime)
  fill(out.d90)
  return out
}

/**
 * A duration with no effort of its own, between two that have one, reads between them (on a log scale) rather than
 * from the FTP estimate: a ride history from before a duration was measured still grades sprints as it did.
 */
function fill(c: Record<number, Point>) {
  const real = D.filter((d) => c[d].real)
  for (const d of D) {
    if (c[d].real) continue
    const lo = [...real].reverse().find((r) => r < d)
    const hi = real.find((r) => r > d)
    if (lo == null || hi == null) continue
    const f = Math.log(d / lo) / Math.log(hi / lo)
    c[d] = { w: Math.round(c[lo].w + (c[hi].w - c[lo].w) * f), real: false }
  }
}

/** Log-time interpolation between curve points. */
export function at(c: Record<number, Point>, dur: number): Point {
  if (c[dur]) return c[dur]
  const hi = D.find((d) => d > dur) ?? D[D.length - 1]
  const lo = [...D].reverse().find((d) => d < dur) ?? D[0]
  const f = Math.log(dur / lo) / Math.log(hi / lo)
  return {
    w: c[lo].w + (c[hi].w - c[lo].w) * Math.min(1, Math.max(0, f)),
    real: c[lo].real && c[hi].real,
  }
}

export function gradeSprint(
  avg: number,
  dur: number,
  p: Profile,
  now = Date.now(),
): { grade: Grade; pct: number } {
  const c = curves(p, now)
  const b90 = at(c.d90, dur)
  const pct = avg / b90.w
  const { hit, great } = CFG.sprint
  let grade: Grade = pct < hit ? 'FAIL' : pct < great ? 'HIT' : 'GREAT'
  if (b90.real && avg > b90.w) grade = avg > at(c.allTime, dur).w ? 'LEGEND' : 'MEGA'
  return { grade, pct }
}

export const isoWeek = (t: number) => Math.floor((t - 3 * DAY) / (7 * DAY))

/** The weekly streak as of `now`: still alive through this week and last, or the week before when a freeze covers it. */
export function liveStreak(p: Profile, now = Date.now()) {
  const gap = isoWeek(now) - p.stats.lastWeek
  return gap <= 1 || (gap === 2 && (p.stats.freezes ?? 0) > 0) ? p.stats.streak : 0
}

export function applyRide(p: Profile, r: RideRecord): Profile {
  const next: Profile = JSON.parse(JSON.stringify(p))
  for (const [d, w] of Object.entries(r.best)) {
    const cur = next.allTime[+d]
    if (!cur || w > cur.w) next.allTime[+d] = { w, date: r.date }
  }
  next.rides = [...next.rides, { ...r }].slice(-200)
  if (r.legend) next.badges = { ...next.badges, legend: next.badges?.legend ?? r.date }
  const s = next.stats
  const wk = isoWeek(Date.parse(r.date))
  if (wk > s.lastWeek) {
    const freeze = wk === s.lastWeek + 2 && (s.freezes ?? 0) > 0
    s.streak = wk === s.lastWeek + 1 || freeze ? s.streak + 1 : 1
    s.freezes = Math.max(0, (s.freezes ?? 0) - (freeze ? 1 : 0))
    if (s.streak % CFG.streak.freezeEvery === 0)
      s.freezes = Math.min(CFG.streak.freezeMax, s.freezes + 1)
    s.lastWeek = wk
  }
  s.rides++
  s.secs += r.secs
  s.kj += r.kj
  s.zones = s.zones.map((z, i) => z + (r.zones[i] ?? 0))
  return next
}

/** The profile record for a finished ride: the recorder's record plus TSS, NP and whether it had a LEGEND sprint. */
export const rideRecord = (s: {
  record: RideRecord
  tss: number
  np: number
  sprints: { grade: string }[]
  planName?: string
}): RideRecord => ({
  ...s.record,
  tss: s.tss,
  np: s.np,
  plan: s.planName,
  ...(s.sprints.some((x) => x.grade === 'LEGEND') ? { legend: true } : {}),
})

/** Drops a deleted ride from the profile's list and lifetime totals. All-time bests stay. */
export function removeRide(p: Profile, date: string): Profile {
  const r = p.rides.find((x) => x.date === date)
  if (!r) return p
  const s = p.stats
  return {
    ...p,
    rides: p.rides.filter((x) => x !== r),
    stats: {
      ...s,
      rides: Math.max(0, s.rides - 1),
      secs: Math.max(0, s.secs - r.secs),
      kj: Math.max(0, s.kj - r.kj),
      zones: s.zones.map((z, i) => Math.max(0, z - (r.zones[i] ?? 0))),
    },
  }
}

/** Sets the FTP and logs the change in the history (no-op if unchanged). Replaces the history array, so copies stay safe. */
export function recordFtp(p: Profile, ftp: number, now = Date.now()) {
  if (ftp === p.ftp) return
  p.ftp = ftp
  p.ftpHistory = [...(p.ftpHistory ?? []), { date: new Date(now).toISOString(), ftp }]
}

/** Suggested FTP when 95% of the 20 min best beats FTP by more than the threshold (never suggests a drop). */
export function ftpSuggestion(p: Profile): number | null {
  const b = p.allTime[1200]
  if (!b) return null
  const s = Math.round(b.w * 0.95)
  return (s - p.ftp) / p.ftp > CFG.ftpSuggestThreshold ? s : null
}

/** HR zone 1-5: below 60% of max HR, then 60/70/80/90% boundaries. */
export const hrZone = (bpm: number, maxHr: number) =>
  1 + [0.6, 0.7, 0.8, 0.9].filter((f) => bpm >= f * maxHr).length

export const zoneOf = (w: number, ftp: number) => {
  const f = w / ftp
  const i = CFG.zones.findIndex((z) => f < z)
  return i < 0 ? CFG.zones.length : i
}
