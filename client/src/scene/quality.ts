import type * as THREE from 'three'
import { VIS } from './params'

export const LEVELS = ['lowpower', 'potato', 'low', 'medium', 'high'] as const
export type Level = (typeof LEVELS)[number]
const SPEC: Record<Level, { ratio: number; shadow: boolean }> = {
  lowpower: { ratio: 0.6, shadow: false },
  potato: { ratio: 0.75, shadow: false },
  low: { ratio: 1, shadow: false },
  medium: { ratio: 1.25, shadow: true },
  high: { ratio: 2, shadow: true },
}
const KEY = 'cranky.gfx'
/** Where auto settled last time on this device, so the next ride starts there instead of at the top. */
const AUTO_KEY = 'cranky.gfx.auto'
const Q = VIS.quality
const isLevel = (s: string | null): s is Level => (LEVELS as readonly string[]).includes(s ?? '')

/**
 * Pure step rule: a very slow window drops two levels at once, two slow windows drop one, ten fast ones climb
 * one. `fps` is the average over the window just ended.
 */
export function nextLevel(level: Level, fps: number, slow: number, fast: number) {
  const i = LEVELS.indexOf(level)
  slow = fps < Q.slowFps ? slow + 1 : 0
  fast = fps > Q.fastFps ? fast + 1 : 0
  const by = fps < Q.verySlowFps ? Q.verySlowDrop : slow >= Q.slowWindows ? 1 : 0
  if (by && i > 0) return { level: LEVELS[Math.max(0, i - by)], slow: 0, fast: 0, dropped: true }
  if (fast >= Q.fastWindows && i < LEVELS.length - 1)
    return { level: LEVELS[i + 1], slow: 0, fast: 0, dropped: false }
  return { level, slow, fast, dropped: false }
}

/** The pinned level or 'auto', from the address bar or this device's setting. */
const savedMode = (): Level | 'auto' => {
  const saved = new URLSearchParams(location.search).get('gfx') ?? localStorage.getItem(KEY)
  return isLevel(saved) ? saved : 'auto'
}

/** The level a scene will start at: the pinned one, or where auto settled last time (the top, the first time). */
export function startLevel(): Level {
  const mode = savedMode()
  const last = localStorage.getItem(AUTO_KEY)
  return mode !== 'auto' ? mode : isLevel(last) ? last : 'high'
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
    this.mode = savedMode()
    this.apply(startLevel())
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
    if (this.mode === 'auto') localStorage.setItem(AUTO_KEY, level)
    this.onChange()
  }

  /** Call once per frame with the real (unslowed) frame time in seconds. */
  frame(dt: number) {
    if (this.mode !== 'auto' || document.hidden) return
    this.acc += dt
    this.frames++
    if (this.acc < Q.windowS) return
    const r = nextLevel(this.level, this.frames / this.acc, this.slow, this.fast)
    this.acc = this.frames = 0
    this.slow = r.slow
    this.fast = r.fast
    // Once a level has proved too slow, don't climb back to it: avoids flip-flopping.
    if (r.dropped) this.ceiling = LEVELS.indexOf(r.level)
    if (r.level !== this.level && LEVELS.indexOf(r.level) <= this.ceiling) this.apply(r.level)
  }
}
