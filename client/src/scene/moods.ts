import * as THREE from 'three'
import { VIS, type MoodDef } from './params'
import { clamp } from './util'

const COLOURS = ['sky', 'fog', 'light', 'hemi', 'ground', 'hill'] as const
const NUMS = ['sunI', 'hemiI', 'sunElev', 'sunAz', 'sunSize', 'head', 'stars', 'fogFar'] as const

export type Env = Record<(typeof COLOURS)[number], THREE.Color> &
  Record<(typeof NUMS)[number], number>

/** Smoothly blends the current environment towards the target mood's definition. */
export class MoodBlend {
  env = {} as Env
  private tmp = new THREE.Color()
  private first = true

  update(dt: number, name: string) {
    const def: MoodDef = VIS.moods[name] ?? VIS.moods.drill
    const k = this.first ? 1 : clamp(dt * VIS.moodBlend)
    this.first = false
    for (const c of COLOURS) {
      this.env[c] ??= new THREE.Color(def[c])
      this.env[c].lerp(this.tmp.set(def[c]), k)
    }
    for (const n of NUMS) {
      this.env[n] ??= def[n]
      this.env[n] += (def[n] - this.env[n]) * k
    }
    return this.env
  }
}

export type Weather = 'clear' | 'rain' | 'dust' | 'night'
/** A bus ride's weather over whatever the event's mood is: a tint and how far towards it, light and fog scales. */
export const WEATHER: Record<
  Exclude<Weather, 'clear'>,
  { tint: string; k: number; sun: number; fog: number; head: number }
> = {
  rain: { tint: '#5a6470', k: 0.45, sun: 0.45, fog: 0.55, head: 0.5 },
  dust: { tint: '#c49a5c', k: 0.6, sun: 0.7, fog: 0.3, head: 0.3 },
  night: { tint: '#141b33', k: 0.75, sun: 0.2, fog: 0.75, head: 1 },
}

/** `env` with the weather laid over it, written into `out` (the mood's own env is left alone). */
export function weatherEnv(env: Env, w: Weather | undefined, out: Env) {
  for (const c of COLOURS) (out[c] ??= new THREE.Color()).copy(env[c])
  for (const n of NUMS) out[n] = env[n]
  const d = w && w !== 'clear' ? WEATHER[w] : null
  if (!d) return out
  const tint = new THREE.Color(d.tint)
  for (const c of COLOURS) out[c].lerp(tint, d.k)
  out.sunI *= d.sun
  out.hemiI *= d.sun + (1 - d.sun) * 0.5
  out.fogFar *= d.fog
  out.head = Math.max(out.head, d.head)
  if (w === 'night') out.stars = 1
  return out
}
