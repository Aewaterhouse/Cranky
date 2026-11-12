import { isoWeek, type Profile, type RideRecord } from './curve'

export interface Badge {
  id: string
  name: string
  /** What it takes. */
  desc: string
  /** Short text on the medal. */
  mark: string
  rank: 'bronze' | 'silver' | 'gold'
  earned: boolean
  /** ISO date earned, when known. */
  date?: string
}

const byDate = (rides: RideRecord[]) => [...rides].sort((a, b) => a.date.localeCompare(b.date))

/** Longest run of consecutive weeks with a ride, and the date of the ride that completed `goal` weeks. */
export function weekStreak(rides: RideRecord[], goal = 4) {
  let best = 0
  let run = 0
  let prev = -99
  let reached: string | undefined
  for (const r of byDate(rides)) {
    const wk = isoWeek(Date.parse(r.date))
    if (wk === prev) continue
    run = wk === prev + 1 ? run + 1 : 1
    prev = wk
    best = Math.max(best, run)
    if (run >= goal && !reached) reached = r.date
  }
  return { best, reached }
}

/** Date of the ride on which a running total passes `target` (only known while the profile holds every ride). */
function totalDate(p: Profile, pick: (r: RideRecord) => number, target: number) {
  if (p.rides.length < p.stats.rides) return undefined
  let sum = 0
  return byDate(p.rides).find((r) => (sum += pick(r)) >= target)?.date
}

/** The first ride with a best of at least `w` watts for `dur` seconds, else the all-time best's date. */
function firstOver(p: Profile, dur: number, w: number) {
  return byDate(p.rides).find((r) => (r.best[dur] ?? 0) >= w)?.date ?? p.allTime[dur]?.date
}

/** Milestone badges worked out from the profile. Badges earned once stay earned (see `p.badges`). */
export function badges(p: Profile): Badge[] {
  const n = p.stats.rides
  const first = byDate(p.rides)[0]?.date
  const streak = weekStreak(p.rides)
  const big = byDate(p.rides).find((r) => r.kj >= 1000)
  const def: [string, string, string, string, Badge['rank'], boolean, string | undefined][] = [
    ['first', 'Fair Dinkum Start', 'Finish your first ride', '1', 'bronze', n >= 1, first],
    [
      'rides10',
      'Getting Cranky',
      'Finish 10 rides',
      '10',
      'bronze',
      n >= 10,
      totalDate(p, () => 1, 10),
    ],
    ['rides50', 'Battler', 'Finish 50 rides', '50', 'silver', n >= 50, totalDate(p, () => 1, 50)],
    [
      'rides100',
      'True Blue Ton',
      'Finish 100 rides',
      '100',
      'gold',
      n >= 100,
      totalDate(p, () => 1, 100),
    ],
    [
      'kj5k',
      'Pie Burner',
      'Burn 5,000 kJ in total, about a dozen meat pies',
      '5k',
      'bronze',
      p.stats.kj >= 5000,
      totalDate(p, (r) => r.kj, 5000),
    ],
    [
      'kj25k',
      'Barbie Banisher',
      'Burn 25,000 kJ in total',
      '25k',
      'silver',
      p.stats.kj >= 25000,
      totalDate(p, (r) => r.kj, 25000),
    ],
    [
      'kj100k',
      'Bottomless Esky',
      'Burn 100,000 kJ in total',
      '100k',
      'gold',
      p.stats.kj >= 100000,
      totalDate(p, (r) => r.kj, 100000),
    ],
    [
      'w300',
      'Roo Punch',
      'Hold 300 W for a full minute',
      '300',
      'bronze',
      (p.allTime[60]?.w ?? 0) >= 300,
      firstOver(p, 60, 300),
    ],
    [
      'w400',
      'Croc Snap',
      'Hold 400 W for a full minute',
      '400',
      'silver',
      (p.allTime[60]?.w ?? 0) >= 400,
      firstOver(p, 60, 400),
    ],
    [
      'w500',
      'Thunder Down Under',
      'Hold 500 W for a full minute',
      '500',
      'gold',
      (p.allTime[60]?.w ?? 0) >= 500,
      firstOver(p, 60, 500),
    ],
    [
      'streak4',
      'Four-Week Fair Go',
      'Ride in four weeks in a row',
      '4w',
      'silver',
      streak.best >= 4,
      streak.reached,
    ],
    ['bigday', 'Full Tucker', 'Burn 1,000 kJ in a single ride', '1k', 'silver', !!big, big?.date],
    [
      'legend',
      'Absolute Legend',
      'Land a LEGEND grade sprint',
      'LEG',
      'gold',
      !!p.badges?.legend,
      p.badges?.legend,
    ],
  ]
  return def.map(([id, name, desc, mark, rank, now, date]) => {
    const kept = p.badges?.[id]
    return { id, name, desc, mark, rank, earned: now || !!kept, date: kept ?? date }
  })
}

/** Writes newly earned badges into `p.badges` so they stay earned. Returns true if anything changed. */
export function stickBadges(p: Profile): boolean {
  const fresh = badges(p).filter((b) => b.earned && !p.badges?.[b.id])
  if (!fresh.length) return false
  p.badges = {
    ...p.badges,
    ...Object.fromEntries(fresh.map((b) => [b.id, b.date ?? new Date().toISOString()])),
  }
  return true
}

export interface PrEvent {
  date: string
  /** Duration in seconds. */
  d: number
  w: number
  /** The best before this one, or null for the first effort at that length. */
  prev: number | null
}

/** Every time a power best went up, newest first. Rides are replayed in date order; all-time bests older than the kept rides are added as they are. */
export function prTimeline(p: Profile): PrEvent[] {
  const best: Record<number, number> = {}
  const out: PrEvent[] = []
  for (const r of byDate(p.rides))
    for (const [k, w] of Object.entries(r.best)) {
      const d = +k
      if (w > (best[d] ?? 0)) {
        out.push({ date: r.date, d, w, prev: best[d] ?? null })
        best[d] = w
      }
    }
  for (const [k, a] of Object.entries(p.allTime))
    if (!out.some((e) => e.d === +k && e.w === a.w))
      out.push({ date: a.date, d: +k, w: a.w, prev: null })
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.d - b.d)
}
