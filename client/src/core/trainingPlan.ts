import { CFG } from '../config'
import { planById } from '../content'
import { dayKey } from './fitness'
import { parsePlan, planStats } from './plan'

/** A bundled multi-week plan: each week is its sessions in order, as workout ids. */
export interface TrainingPlan {
  id: string
  name: string
  emoji: string
  blurb: string
  weeks: string[][]
}
/** The plan a rider is on: its id, the first day (yyyy-mm-dd) and the weekdays they ride (0 is Sunday). */
export interface PlanPick {
  id: string
  start: string
  days: number[]
}
export interface Session {
  date: string
  /** Plan week, from 0. */
  week: number
  workout: string
}
/** What a ride needs for matching: its start, the workout it rode (by name) and its length. */
export interface RideLite {
  date: string
  plan?: string | null
  secs: number
}
export type SessionState = 'done' | 'missed' | 'today' | 'upcoming'

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const perWeek = (p: TrainingPlan) => Math.max(...p.weeks.map((w) => w.length))

/** The local day `n` days after a yyyy-mm-dd day. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n, 12))
}
const weekday = (day: string) => new Date(`${day}T12:00`).getDay()

/**
 * Lays each plan week onto the rider's weekdays in the 7 days from `start + 7 * week`. A week with fewer
 * sessions than riding days spreads them out (first and last day first); one with more drops the extras.
 */
export function schedule(p: TrainingPlan, pick: PlanPick): Session[] {
  return p.weeks.flatMap((w, week) => {
    const slots = Array.from({ length: 7 }, (_, i) => addDays(pick.start, week * 7 + i)).filter(
      (d) => pick.days.includes(weekday(d)),
    )
    const list = w.slice(0, slots.length)
    return list.map((workout, i) => ({
      date: slots[list.length > 1 ? Math.round((i * (slots.length - 1)) / (list.length - 1)) : 0],
      week,
      workout,
    }))
  })
}

/** Done when a ride that day was this workout, or any ride long enough; otherwise by the date. */
export function sessionState(
  s: Session,
  info: { name: string; secs: number },
  rides: RideLite[],
  today: string,
): SessionState {
  const done = rides.some(
    (r) =>
      dayKey(r.date) === s.date &&
      (r.plan === info.name || r.secs >= info.secs * CFG.trainingPlan.doneFrac),
  )
  return done ? 'done' : s.date === today ? 'today' : s.date < today ? 'missed' : 'upcoming'
}

const infoCache = new Map<string, { name: string; secs: number; tss: number }>()
/** A workout's name, length and TSS at full effort. */
export function workoutInfo(id: string) {
  let i = infoCache.get(id)
  if (!i) {
    const raw = planById(id)
    const s = raw ? planStats(parsePlan(raw).blocks) : { total: 0, tss: 0 }
    i = { name: raw?.name ?? id, secs: s.total, tss: Math.round(s.tss) }
    infoCache.set(id, i)
  }
  return i
}
