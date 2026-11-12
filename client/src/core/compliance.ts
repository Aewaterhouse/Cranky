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

/** 1 inside the band, linearly to 0 at zeroAt; null when there is nothing to score against. */
export function score(avg: number, target: number | null): number | null {
  if (!target) return null
  const { band, zeroAt } = CFG.compliance
  const dev = Math.abs(avg - target) / target
  return dev <= band ? 1 : Math.max(0, (zeroAt - dev) / (zeroAt - band))
}

export const inBand = (avg: number, target: number | null) =>
  !!target && Math.abs(avg - target) / target <= CFG.compliance.band
