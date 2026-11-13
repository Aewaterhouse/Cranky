import { CFG } from '../config'
import type { Profile } from './curve'
import type { RodeRoute } from './passport'
import type { RouteSummary } from './routeLibrary'

const W = CFG.weekly

/** A week's climbing and which of its rewards have been paid. */
export interface WeekLog {
  vertM: number
  paid?: ('featured' | 'vert')[]
}

const DAY = 86400000
/**
 * The number of the week `t` falls in. Weeks start at midnight on Monday by the clock on the wall (`tzMin` is
 * minutes behind UTC, as `Date.getTimezoneOffset` gives it), so mates in one time zone always agree.
 */
export const weekOf = (t = Date.now(), tzMin = new Date(t).getTimezoneOffset()) =>
  Math.floor((t - tzMin * 60000 + 3 * DAY) / (7 * DAY))

/**
 * This week's featured route: the same for everyone, worked out from the week alone. It steps through the
 * routes by a stride that shares no factor with their number, so it is never last week's again and every
 * route gets a turn before any repeats.
 */
export function featuredRoute(routes: RouteSummary[], week = weekOf()): RouteSummary | undefined {
  const sorted = [...routes].sort((a, b) => a.id.localeCompare(b.id))
  const n = sorted.length
  const stride = [7, 5, 3, 11, 13].find((s) => n % s !== 0) ?? 1
  return sorted[(((week * stride) % n) + n) % n]
}

/**
 * This week's climbing target for a rider: a bit more than their average over the last few weeks they
 * climbed anything, or a default for someone new. It only looks at earlier weeks, so it holds still all week.
 */
export function vertTarget(p: Profile, week = weekOf()): number {
  const c = W.vert
  const past = Array.from(
    { length: c.weeks },
    (_, i) => p.weeks?.[week - 1 - i]?.vertM ?? 0,
  ).filter((v) => v > 0)
  if (!past.length) return c.defaultM
  const want = (past.reduce((a, b) => a + b, 0) / past.length) * c.stretch
  return Math.min(c.maxM, Math.max(c.minM, Math.round(want / c.roundM) * c.roundM))
}

/** Where the rider stands this week. */
export function weekState(p: Profile, week = weekOf()) {
  const log = p.weeks?.[week] ?? { vertM: 0 }
  return {
    vertM: log.vertM,
    targetM: vertTarget(p, week),
    featuredDone: !!log.paid?.includes('featured'),
    vertDone: !!log.paid?.includes('vert'),
  }
}

/**
 * Adds a free ride's climbing to its week and pays any reward it has just earned: finishing the featured
 * route, and reaching the week's climbing target. Each is paid once a week however often it is earned.
 */
export function weeklyRewards(p: Profile, s: RodeRoute, routes: RouteSummary[]) {
  const won: { text: string; scrap: number }[] = []
  if (!s.route) return { p, won }
  const week = weekOf(Date.parse(s.record.date))
  const was = p.weeks?.[week] ?? { vertM: 0 }
  const log: WeekLog = {
    vertM: was.vertM + Math.max(0, Math.round(s.ascent ?? 0)),
    paid: [...(was.paid ?? [])],
  }
  const finished = (s.segments ?? []).some((e) => e.kind === 'route' || e.kind === 'lap')
  const pay = (what: 'featured' | 'vert', earned: boolean, scrap: number, text: string) => {
    if (!earned || log.paid!.includes(what)) return
    log.paid!.push(what)
    won.push({ text, scrap })
  }
  const feat = featuredRoute(routes, week)
  pay(
    'featured',
    finished && feat?.id === s.route.id,
    W.featuredScrap,
    `Route of the week: ${feat?.name}`,
  )
  const target = vertTarget(p, week)
  pay(
    'vert',
    log.vertM >= target,
    W.vert.scrap,
    `Weekly climb: ${target.toLocaleString('en-AU')} m`,
  )
  // Only the weeks the target looks back over are kept.
  const weeks = Object.fromEntries(
    Object.entries({ ...p.weeks, [week]: log }).filter(([k]) => +k >= week - W.vert.weeks),
  )
  return { p: { ...p, weeks, scrap: p.scrap + won.reduce((a, w) => a + w.scrap, 0) }, won }
}
