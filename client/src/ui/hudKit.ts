import type { SprintResult } from '../types'

export interface EventStyle {
  name: string
  icon: string
  col: string
}
export const EVENTS: Record<string, EventStyle> = {
  warmup: { name: 'Warm-up', icon: '☀️', col: '#5aa9e6' },
  longhaul: { name: 'Long Haul', icon: '🛣️', col: '#f2b705' },
  surge: { name: 'Horde Surge', icon: '🧟', col: '#ff5a4e' },
  roadblock: { name: 'Roadblock', icon: '🚧', col: '#e040fb' },
  servo: { name: 'Servo Stop', icon: '⛽', col: '#7fd13b' },
  cooldown: { name: 'Cool-down', icon: '❄️', col: '#44bba4' },
}
export const eventOf = (ev: string) => EVENTS[ev] ?? EVENTS.longhaul

export const FX_ICON: Record<string, string> = {
  hit: '💥',
  crash: '💥',
  grab: '🧟',
  shake: '💨',
  smash: '🚧',
  fell: '🪂',
  hauled: '🤝',
  sprint: '⚡',
  slowmo: '⚡',
  tune: '🎶',
  scrap: '⚙️',
  buy: '🛒',
  repel: '🛡️',
}
export const FX_DEFAULT: Record<string, string> = {
  crash: 'The bus hit the roadblock!',
  hit: 'The bus took a hit!',
  scrap: 'Scrap collected',
}

/** Set text only when it changed, so the DOM isn't churned at 2 Hz. */
export const set = (el: HTMLElement, v: string) => {
  if (el.textContent !== v) el.textContent = v
}
/** Green / amber / red by compliance. */
export const compColour = (c: number | null | undefined) =>
  c == null ? 'var(--dim)' : c > 0.85 ? 'var(--tox)' : c > 0.6 ? 'var(--amber)' : 'var(--bad)'

export const GRADE_COLOUR: Record<SprintResult['grade'], string> = {
  FAIL: '#ff5a4e',
  HIT: '#f3f0e6',
  GREAT: '#7fd13b',
  MEGA: '#e040fb',
  LEGEND: '#ffd54a',
}

/** Animate a counter to its new value. */
export function tween(el: HTMLElement, to: number) {
  const from = +(el.dataset.v ?? to)
  el.dataset.v = String(to)
  if (from === to) return set(el, String(to))
  const t0 = performance.now()
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 700)
    set(el, String(Math.round(from + (to - from) * k)))
    if (k < 1 && el.isConnected) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** Restart a one-shot CSS animation class. */
export function pulse(el: HTMLElement, cls: string) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}
