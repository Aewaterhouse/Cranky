import type * as THREE from 'three'
import { VIS } from './params'

export const LEVELS = ['potato', 'low', 'medium', 'high'] as const
export type Level = (typeof LEVELS)[number]
const SPEC: Record<Level, { ratio: number; shadow: boolean }> = {
  potato: { ratio: 0.75, shadow: false },
  low: { ratio: 1, shadow: false },
  medium: { ratio: 1.25, shadow: true },
  high: { ratio: 2, shadow: true },
}
const KEY = 'cranky.gfx'
const WINDOW_S = 2

/** Pure step rule: drop a level after two slow windows, climb one after ten fast ones. */
export function nextLevel(level: Level, fps: number, slow: number, fast: number) {
  const i = LEVELS.indexOf(level)
  slow = fps < 40 ? slow + 1 : 0
  fast = fps > 57 ? fast + 1 : 0
  if (slow >= 2 && i > 0) return { level: LEVELS[i - 1], slow: 0, fast: 0, dropped: true }
  if (fast >= 10 && i < LEVELS.length - 1)
    return { level: LEVELS[i + 1], slow: 0, fast: 0, dropped: false }
  return { level, slow, fast, dropped: false }
}

/** Graphics quality: 'auto' follows the measured frame rate, or pin a level (saved per device). */
export class Quality {
  level: Level = 'high'
  mode: Level | 'auto'
  private shadowOn = VIS.shadow
  private acc = 0
  private frames = 0
  private slow = 0
  private fast = 0
  private ceiling = LEVELS.length - 1

  constructor(
    private renderer: THREE.WebGLRenderer,
    private onChange: () => void,
  ) {
    const saved = new URLSearchParams(location.search).get('gfx') ?? localStorage.getItem(KEY)
    this.mode = (LEVELS as readonly string[]).includes(saved ?? '') ? (saved as Level) : 'auto'
    this.apply(this.mode === 'auto' ? 'high' : this.mode)
  }

  set(mode: Level | 'auto') {
    this.mode = mode
    localStorage.setItem(KEY, mode)
    if (mode !== 'auto') this.apply(mode)
  }

  private apply(level: Level) {
    this.level = level
    this.renderer.setPixelRatio(Math.min(SPEC[level].ratio, devicePixelRatio))
    VIS.shadow = SPEC[level].shadow ? this.shadowOn : 0
    this.onChange()
  }

  /** Call once per frame with the real (unslowed) frame time in seconds. */
  frame(dt: number) {
    if (this.mode !== 'auto' || document.hidden) return
    this.acc += dt
    this.frames++
    if (this.acc < WINDOW_S) return
    const r = nextLevel(this.level, this.frames / this.acc, this.slow, this.fast)
    this.acc = this.frames = 0
    this.slow = r.slow
    this.fast = r.fast
    // Once a level has proved too slow, don't climb back to it: avoids flip-flopping.
    if (r.dropped) this.ceiling = LEVELS.indexOf(r.level)
    if (r.level !== this.level && LEVELS.indexOf(r.level) <= this.ceiling) this.apply(r.level)
  }
}
