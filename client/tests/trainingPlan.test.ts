import { describe, expect, it } from 'vitest'
import { planById, TRAINING_PLANS } from '../src/content'
import {
  addDays,
  perWeek,
  schedule,
  sessionState,
  workoutInfo,
  type TrainingPlan,
} from '../src/core/trainingPlan'

// 2026-11-16 is a Monday.
const MON = '2026-11-16'
const plan: TrainingPlan = {
  id: 't',
  name: 'T',
  emoji: '',
  blurb: '',
  weeks: [
    ['a', 'b', 'c'],
    ['d', 'e'],
  ],
}

describe('bundled training plans', () => {
  it('has a few plans whose sessions are all real workouts', () => {
    expect(TRAINING_PLANS.length).toBeGreaterThanOrEqual(4)
    for (const p of TRAINING_PLANS) {
      expect(p.name && p.blurb && p.weeks.length).toBeTruthy()
      for (const id of p.weeks.flat()) expect(planById(id), `${p.id}: ${id}`).toBeDefined()
    }
  })
  it('works out a workout’s length and TSS', () => {
    const i = workoutInfo('ss-2x20')
    expect(i.name).toBe('Sweet Spot 2x20')
    expect(i.secs).toBeGreaterThan(3600)
    expect(i.tss).toBeGreaterThan(50)
  })
})

describe('schedule', () => {
  it('lays sessions onto the chosen weekdays, week by week', () => {
    const s = schedule(plan, { id: 't', start: MON, days: [1, 3, 5] })
    expect(s.map((x) => [x.date, x.workout, x.week])).toEqual([
      [MON, 'a', 0],
      [addDays(MON, 2), 'b', 0],
      [addDays(MON, 4), 'c', 0],
      [addDays(MON, 7), 'd', 1],
      [addDays(MON, 11), 'e', 1],
    ])
  })
  it('starts each plan week on the start day, mid-week too', () => {
    const thu = addDays(MON, 3)
    const s = schedule(plan, { id: 't', start: thu, days: [1, 3, 5] })
    expect(s.slice(0, 3).map((x) => x.date)).toEqual([
      addDays(MON, 4),
      addDays(MON, 7),
      addDays(MON, 9),
    ])
  })
  it('drops extras when there are fewer days than sessions', () => {
    const s = schedule(plan, { id: 't', start: MON, days: [6, 0] })
    expect(s.map((x) => x.workout)).toEqual(['a', 'b', 'd', 'e'])
    expect(perWeek(plan)).toBe(3)
  })
  it('crosses month ends', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'))
})

describe('sessionState', () => {
  const s = { date: MON, week: 0, workout: 'x' }
  const info = { name: 'Sweet Spot 2x20', secs: 4000 }
  const at = (h: number) => new Date(`${MON}T${String(h).padStart(2, '0')}:00`).toISOString()
  it('is done by a ride of that workout that day, however short', () =>
    expect(sessionState(s, info, [{ date: at(7), plan: info.name, secs: 600 }], MON)).toBe('done'))
  it('is done by any ride of at least 80% of its length', () => {
    expect(sessionState(s, info, [{ date: at(18), plan: 'Other', secs: 3200 }], MON)).toBe('done')
    expect(sessionState(s, info, [{ date: at(18), plan: 'Other', secs: 3100 }], MON)).toBe('today')
  })
  it('ignores rides on other days', () => {
    const r = [
      { date: new Date(`${addDays(MON, 1)}T07:00`).toISOString(), plan: info.name, secs: 4000 },
    ]
    expect(sessionState(s, info, r, addDays(MON, 1))).toBe('missed')
    expect(sessionState(s, info, [], addDays(MON, -1))).toBe('upcoming')
  })
})
