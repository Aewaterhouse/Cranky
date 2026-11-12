/** Temporary resistance modifiers. Modes emit them; the core enforces the cap and stacking rule. */
export const EFFECT_CAP = 1.25
export const EFFECT_MAX_STACK = 3

export interface Effect {
  mult: number
  until: number
}

export class EffectsBus {
  private list: Effect[] = []
  add(mult: number, durS: number, now: number) {
    this.prune(now)
    if (this.list.length < EFFECT_MAX_STACK) this.list.push({ mult, until: now + durS })
  }
  private prune(now: number) {
    this.list = this.list.filter((e) => e.until > now)
  }
  /** Stacked multiplier: effects add (mult-1) together, clamped to the cap. */
  multiplier(now: number): number {
    this.prune(now)
    return Math.min(EFFECT_CAP, 1 + this.list.reduce((a, e) => a + (e.mult - 1), 0))
  }
}
