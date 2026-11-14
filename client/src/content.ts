import type { Plan } from './types'
import type { TrainingPlan } from './core/trainingPlan'

const mods = import.meta.glob<Plan>('../../content/workouts/*.json', {
  eager: true,
  import: 'default',
})
const BUILT_IN: Plan[] = Object.values(mods).sort((a, b) => a.name.localeCompare(b.name))
const KEY = 'cranky.myWorkouts'

/** Imported workouts live in this browser only and are solo-only (the server doesn't know them). */
export function myPlans(): Plan[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
export const isMine = (id: string) => id.startsWith('my-')
export function saveMyPlan(p: Plan) {
  localStorage.setItem(KEY, JSON.stringify([...myPlans().filter((x) => x.id !== p.id), p]))
  refresh()
}
export function removeMyPlan(id: string) {
  localStorage.setItem(KEY, JSON.stringify(myPlans().filter((x) => x.id !== id)))
  refresh()
}

/** Every plan the picker can show: built-in plus imported. Same array object, refreshed in place. */
export const PLANS: Plan[] = []
function refresh() {
  PLANS.splice(
    0,
    PLANS.length,
    ...BUILT_IN,
    ...(typeof localStorage === 'undefined' ? [] : myPlans()),
  )
}
refresh()
export const planById = (id: string) => PLANS.find((p) => p.id === id)

/** Bundled multi-week training plans (content/plans). */
export const TRAINING_PLANS: TrainingPlan[] = Object.values(
  import.meta.glob<TrainingPlan>('../../content/plans/*.json', { eager: true, import: 'default' }),
).sort((a, b) => a.weeks.length - b.weeks.length || a.name.localeCompare(b.name))
