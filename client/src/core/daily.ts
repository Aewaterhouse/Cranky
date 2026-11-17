import { CFG } from '../config'
import type { Profile } from './curve'

/** What a challenge looks at: the ride's summary, and whether it was a crew game. */
export interface DayRide {
  record: { secs: number; kj: number }
  sprints: { grade: string }[]
  compliance: number
  avgCadence: number
  route?: unknown
  crew: boolean
}

const D = CFG.daily
/** Each day's challenge: what to do, and whether a ride did it. */
export const CHALLENGES: { id: string; text: string; done: (r: DayRide) => boolean }[] = [
  { id: 'long', text: 'Ride for 30 minutes or more', done: (r) => r.record.secs >= 1800 },
  { id: 'kj', text: `Burn ${D.kj} kJ in one ride`, done: (r) => r.record.kj >= D.kj },
  {
    id: 'great',
    text: 'Land a GREAT sprint or better',
    done: (r) => r.sprints.some((s) => ['GREAT', 'MEGA', 'LEGEND'].includes(s.grade)),
  },
  { id: 'crew', text: 'Finish a crew game', done: (r) => r.crew },
  {
    id: 'spin',
    text: `Average ${D.rpm} rpm over 10 minutes or more`,
    done: (r) => r.record.secs >= 600 && r.avgCadence >= D.rpm,
  },
  {
    id: 'target',
    text: 'Hold your target 90% of a workout',
    done: (r) => !r.route && r.record.secs >= 600 && r.compliance >= 0.9,
  },
]

/** Today's day number, by the clock on the wall, so mates in one time zone share a challenge. */
export const dayOf = (t = Date.now()) =>
  Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 864e5)

/** The challenge for a day: stepping through them so it is never yesterday's again. */
export const dailyChallenge = (day = dayOf()) => CHALLENGES[(((day * 5) % 6) + 6) % 6]

/** Ticks off today's challenge once if this ride did it. */
export function dailyReward(p: Profile, r: DayRide, day = dayOf()) {
  const c = dailyChallenge(day)
  if (p.dailyPaid === day || !c.done(r)) return { p, won: null }
  return {
    p: { ...p, dailyPaid: day },
    won: { text: `Daily challenge: ${c.text}` },
  }
}
