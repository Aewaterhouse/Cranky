import type { Plan, SprintResult } from '../types'
import { bestEfforts, zoneOf, type RideRecord } from './curve'

export interface BlockStat {
  i: number
  label: string
  type: string
  secs: number
  avgPower: number
  avgTarget: number
  compliance: number
  inBandSecs: number
}

/** Collects 1 Hz samples during a ride and builds the summary. */
export class RideRecorder {
  power: number[] = []
  cadence: number[] = []
  private rows: { i: number; p: number; tgt: number | null; c: number | null; band: boolean }[] = []
  sprints: SprintResult[] = []
  readonly startedAt = new Date().toISOString()
  constructor(
    public plan: Plan,
    public ftp: number,
  ) {}

  sample(i: number, p: number, cad: number, tgt: number | null, c: number | null, band: boolean) {
    this.power.push(p)
    this.cadence.push(cad)
    this.rows.push({ i, p, tgt, c, band })
  }

  summary() {
    const blocks: BlockStat[] = this.plan.blocks
      .map((b, i) => {
        const r = this.rows.filter((x) => x.i === i)
        const scored = r.filter((x) => x.c !== null)
        const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
        return {
          i,
          label: b.label ?? b.type,
          type: b.type,
          secs: r.length,
          avgPower: Math.round(mean(r.map((x) => x.p))),
          avgTarget: Math.round(mean(r.filter((x) => x.tgt).map((x) => x.tgt!))),
          compliance: +mean(scored.map((x) => x.c!)).toFixed(3),
          inBandSecs: r.filter((x) => x.band).length,
        }
      })
      .filter((b) => b.secs > 0)
    const zones = Array(7).fill(0)
    for (const p of this.power) zones[zoneOf(p, this.ftp)]++
    const scored = this.rows.filter((x) => x.c !== null)
    const record: RideRecord = {
      date: this.startedAt,
      secs: this.power.length,
      kj: Math.round(this.power.reduce((a, b) => a + b, 0) / 1000),
      best: bestEfforts(this.power),
      zones,
    }
    return {
      plan: this.plan.id,
      planName: this.plan.name,
      ftp: this.ftp,
      blocks,
      sprints: this.sprints,
      record,
      compliance: scored.length
        ? +(scored.reduce((a, x) => a + x.c!, 0) / scored.length).toFixed(3)
        : 0,
      avgPower: this.power.length
        ? Math.round(this.power.reduce((a, b) => a + b, 0) / this.power.length)
        : 0,
      zones,
    }
  }
}
export type RideSummary = ReturnType<RideRecorder['summary']>
