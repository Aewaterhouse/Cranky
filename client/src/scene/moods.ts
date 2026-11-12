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
