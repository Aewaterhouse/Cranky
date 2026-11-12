import { CFG } from '../config'
import type { Plan, Tier } from '../types'
import type { RideRecorder } from './ride'

type RecJson = ReturnType<RideRecorder['toJSON']>

/** Solo ride state saved every few seconds so a refresh or crash can resume it. */
export interface SoloSnap {
  plan: Plan
  el: number
  intensity: number
  tier: Tier
  rec: RecJson
  /** Plan second of each recorded sample (for the chart) and compliance sums. */
  xs: number[]
  cSum: number
  cN: number
  at: number
}

/** Crew ride: only the rider's own recorder, since the server owns the clock. */
export interface BusSnap {
  planId: string
  rec: RecJson
  at: number
}

export const soloKey = (rid: string) => `cranky.solo.${rid}`
export const busKey = (rid: string, code: string) => `cranky.bus.${rid}.${code}`
const codeKey = (rid: string) => `cranky.buscode.${rid}`

export function saveSnap(key: string, snap: object) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...snap, at: Date.now() }))
  } catch {
    /* storage full or blocked: recovery is best effort */
  }
}

/** The saved snapshot, unless it is missing, unreadable or older than the recovery window. */
export function loadSnap<T extends { at: number }>(key: string, now = Date.now()): T | null {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
    return s && now - s.at < CFG.recovery.maxAgeMs ? s : null
  } catch {
    return null
  }
}

export const clearSnap = (key: string) => localStorage.removeItem(key)

/** The bus this rider was last in (survives closing the tab). */
export const rememberBus = (rid: string, code: string) =>
  localStorage.setItem(codeKey(rid), JSON.stringify({ code, at: Date.now() }))
export const forgetBus = (rid: string) => localStorage.removeItem(codeKey(rid))
export function rememberedBus(rid: string): string | null {
  const s = sessionStorage.getItem('zombiebus.code')
  return s ?? loadSnap<{ code: string; at: number }>(codeKey(rid))?.code ?? null
}
