import type { Plan, SprintResult } from '../types'
import { bestEfforts, zoneOf, type RideRecord } from './curve'
import type { SegResult } from './segmentTracker'

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

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)

/** Normalised power: 4th-root mean of the 30 s rolling average to the 4th power (plain mean under 30 s). */
export function normalisedPower(power: number[]): number {
  if (power.length < 30) return mean(power)
  let sum = 0
  let acc = 0
  for (let i = 0; i < power.length; i++) {
    sum += power[i]
    if (i >= 30) sum -= power[i - 30]
    if (i >= 29) acc += (sum / 30) ** 4
  }
  return (acc / (power.length - 29)) ** 0.25
}

/** Normalised power, intensity factor and training stress score for a ride at `ftp`. */
export function loadStats(power: number[], ftp: number) {
  const np = normalisedPower(power)
  const iff = ftp ? np / ftp : 0
  return { np, if: iff, tss: ftp ? ((power.length * np * iff) / (ftp * 3600)) * 100 : 0 }
}

/** Collects 1 Hz samples during a ride and builds the summary. */
export class RideRecorder {
  power: number[] = []
  cadence: number[] = []
  target: (number | null)[] = []
  hr: (number | null)[] = []
  private rows: { i: number; p: number; tgt: number | null; c: number | null; band: boolean }[] = []
  sprints: SprintResult[] = []
  /** Free ride only: metres ridden and metres climbed. */
  distance?: number
  ascent?: number
  /** Free ride only: metres along the route at each recorded second, the route ridden and the segment results. */
  dist: number[] = []
  route?: { id: string; name: string; laps?: number; done: boolean }
  segments?: SegResult[]
  startedAt = new Date().toISOString()
  constructor(
    public plan: Plan,
    public ftp: number,
  ) {}

  /** Plain-data copy of everything recorded so far, for crash recovery. */
  toJSON() {
    const { plan, ftp, startedAt, power, cadence, target, hr, rows, sprints } = this
    return { plan, ftp, startedAt, power, cadence, target, hr, rows, sprints }
  }

  static fromJSON(j: ReturnType<RideRecorder['toJSON']>): RideRecorder {
    const r = new RideRecorder(j.plan, j.ftp)
    Object.assign(r, structuredClone(j))
    return r
  }

  sample(
    i: number,
    p: number,
    cad: number,
    tgt: number | null,
    c: number | null,
    band: boolean,
    hr: number | null = null,
  ) {
    this.hr.push(hr)
    if (this.distance !== undefined) this.dist.push(this.distance)
    this.power.push(p)
    this.cadence.push(cad)
    this.target.push(tgt)
    this.rows.push({ i, p, tgt, c, band })
  }

  summary() {
    const blocks: BlockStat[] = this.plan.blocks
      .map((b, i) => {
        const r = this.rows.filter((x) => x.i === i)
        const scored = r.filter((x) => x.c !== null)
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
    const load = loadStats(this.power, this.ftp)
    const hrs = this.hr.filter((v): v is number => v !== null)
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
      np: Math.round(load.np),
      if: +load.if.toFixed(2),
      tss: Math.round(load.tss),
      avgCadence: Math.round(mean(this.cadence)),
      power: [...this.power],
      cadence: [...this.cadence],
      target: [...this.target],
      hr: [...this.hr],
      avgHr: hrs.length ? Math.round(mean(hrs)) : null,
      maxHr: hrs.length ? Math.max(...hrs) : null,
      distance: this.distance,
      ascent: this.ascent,
      dist: this.dist.length ? [...this.dist] : undefined,
      route: this.route,
      segments: this.segments,
    }
  }
}
export type RideSummary = ReturnType<RideRecorder['summary']>
