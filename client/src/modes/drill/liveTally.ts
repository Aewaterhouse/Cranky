import { zoneOf } from '../../core/curve'
import { locate } from '../../core/plan'
import { loadStats, type RideRecorder } from '../../core/ride'
import type { SoloSnap } from '../../core/snapshot'
import type { LiveStats } from '../../ui/soloPanel'
import type { Plan } from '../../types'
import type { Live } from '../rideController'
import { CadenceTally } from './cadence'

/** Incremental ride stats for the player: one `xs` entry (plan second) per recorded sample. */
export class LiveTally {
  xs: number[]
  zones = Array<number>(7).fill(0)
  cSum: number
  cN: number
  cad: CadenceTally
  private load
  private loadN = 0
  private cadAvg = 0

  constructor(
    private plan: Plan,
    private ftp: number,
    resume?: SoloSnap,
  ) {
    this.xs = resume?.xs ?? []
    this.cSum = resume?.cSum ?? 0
    this.cN = resume?.cN ?? 0
    this.load = loadStats([], ftp)
    this.cad = new CadenceTally(plan.blocks)
    resume?.rec.power.forEach((w) => this.zones[zoneOf(w, ftp)]++)
    resume?.rec.cadence.forEach((c, n) => this.cad.add(locate(plan.blocks, this.xs[n])?.i ?? 0, c))
  }

  /** Account for samples recorded since the last call, taken at plan second `el`. */
  record(rec: RideRecorder, el: number, live: Live) {
    const p = rec.power
    for (; this.xs.length < p.length; this.xs.push(el)) {
      const n = this.xs.length
      this.zones[zoneOf(p[n], this.ftp)]++
      this.cad.add(locate(this.plan.blocks, el)?.i ?? 0, rec.cadence[n])
      if (live.c !== null) {
        this.cSum += live.c
        this.cN++
      }
    }
  }

  stats(rec: RideRecorder, el: number, total: number): LiveStats {
    const p = rec.power
    if (p.length !== this.loadN) {
      this.load = loadStats(p, this.ftp)
      this.loadN = p.length
      this.cadAvg = rec.cadence.reduce((a, b) => a + b, 0) / (p.length || 1)
    }
    const sum = p.reduce((a, b) => a + b, 0)
    return {
      elapsed: el,
      remaining: total - el,
      avg: p.length ? sum / p.length : 0,
      np: this.load.np,
      if: this.load.if,
      tss: this.load.tss,
      kj: sum / 1000,
      cadence: this.cadAvg,
      compliance: this.cN ? this.cSum / this.cN : null,
      zones: this.zones,
    }
  }
}
