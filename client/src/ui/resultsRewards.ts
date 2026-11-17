import { badges } from '../core/badges'
import { applyRide, rideRecord, type Profile } from '../core/curve'
import { dailyReward } from '../core/daily'
import { stampRide } from '../core/passport'
import type { RideSummary } from '../core/ride'
import { ROUTE_INDEX } from '../core/routeLibrary'
import { weeklyRewards } from '../core/weekly'
import type { GroupSummary } from './resultsViews'

/**
 * What a finished ride earns the rider, applied to a copy of their profile: the ride itself (bests, totals,
 * streak), any badges it unlocked, passport stamps and the weekly and
 * daily rewards. Rides under 30 s and test rides (simulator) count for nothing.
 */
export function rideRewards(profile: Profile, s: RideSummary, group?: GroupSummary) {
  if (s.test) return { p: profile, unlocked: [], week: { p: profile, won: [] } }
  let p = s.record.secs >= 30 ? applyRide(profile, rideRecord(s)) : profile
  // Badges this ride unlocked, for a moment of their own at the top of the results.
  const had = new Set(
    badges(profile)
      .filter((b) => b.earned)
      .map((b) => b.id),
  )
  const unlocked = p === profile ? [] : badges(p).filter((b) => b.earned && !had.has(b.id))
  // A free ride goes in the passport and may pay this week's rewards (each once a week).
  const week = weeklyRewards(stampRide(p, s), s, ROUTE_INDEX)
  p = week.p
  const today = s.record.secs >= 30 ? dailyReward(p, { ...s, crew: !!group }) : { p, won: null }
  p = today.p
  if (today.won) week.won.push(today.won)
  return { p, unlocked, week }
}
