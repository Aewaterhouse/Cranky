import { CFG } from '../config'

/** Time-windowed rolling mean (default 3 s). */
export class RollingAvg {
  private s: [number, number][] = []
  constructor(private windowS = CFG.compliance.avgWindowS) {}
  push(t: number, v: number): number {
    this.s.push([t, v])
    while (this.s[0][0] < t - this.windowS) this.s.shift()
    return this.avg
  }
  get avg(): number {
    return this.s.length ? this.s.reduce((a, [, v]) => a + v, 0) / this.s.length : 0
  }
  reset() {
    this.s = []
  }
}

export type Band = [number, number] | 'sprint'

/** How far outside the band the power is, as a share of the target: 0 inside. A game's own band replaces ±band. */
const miss = (avg: number, target: number, b?: Band) => {
  const half = target * CFG.compliance.band
  const [lo, hi] = Array.isArray(b) ? b : [target - half, target + half]
  return Math.max(0, lo - avg, avg - hi) / target
}

/** 1 inside the band, linearly to 0 at zeroAt past its edge; null when there is nothing to score against. */
export function score(avg: number, target: number | null, b?: Band): number | null {
  if (!target) return null
  const { band, zeroAt } = CFG.compliance
  return Math.max(0, 1 - miss(avg, target, b) / (zeroAt - band))
}

export const inBand = (avg: number, target: number | null, b?: Band) =>
  !!target && miss(avg, target, b) <= 1e-9
