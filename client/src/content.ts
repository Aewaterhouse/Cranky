import type { Plan } from './types'

const mods = import.meta.glob<Plan>('../../content/workouts/*.json', { eager: true, import: 'default' })
export const PLANS: Plan[] = Object.values(mods).sort((a, b) => a.name.localeCompare(b.name))
export const planById = (id: string) => PLANS.find((p) => p.id === id)
