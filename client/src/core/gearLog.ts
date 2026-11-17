import { CFG } from '../config'

const L = CFG.gearLog

export interface GearRow {
  n: number
  /** ms (page clock) of the press. */
  at: number
  gear: number
  /** Gradient sent, %. */
  grade: number
  /** Power when the shift was pressed. */
  from: number
  /** ms from the press until the trainer accepted the write. */
  ackMs?: number
  /** ms from the press until power moved by CFG.gearLog.movedW. */
  moveMs?: number
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** The trainer check page's gear log: each shift's time, the gradient sent, the trainer's ack and the lag until power moves. */
export class GearLog {
  rows: GearRow[] = []
  private n = 0

  press(at: number, gear: number, grade: number, power: number) {
    const r: GearRow = { n: ++this.n, at, gear, grade, from: power }
    this.rows = [r, ...this.rows].slice(0, L.rows)
    return r
  }

  ack(r: GearRow, at: number) {
    r.ackMs = Math.round(at - r.at)
  }

  /** Every power report: closes any shift whose power has now moved enough, inside the time-out. */
  power(at: number, watts: number) {
    for (const r of this.rows)
      if (
        r.moveMs === undefined &&
        at - r.at <= L.timeoutS * 1000 &&
        Math.abs(watts - r.from) >= L.movedW
      )
        r.moveMs = Math.round(at - r.at)
  }

  /** What the power column shows: the lag, "waiting" or "no move" once timed out. */
  moved(r: GearRow, now: number) {
    if (r.moveMs !== undefined) return `${r.moveMs} ms`
    return now - r.at > L.timeoutS * 1000 ? 'no move' : 'waiting'
  }

  /** Median ack and power lag over the rows that have them. */
  stats() {
    return {
      ackMs: median(this.rows.flatMap((r) => (r.ackMs === undefined ? [] : [r.ackMs]))),
      moveMs: median(this.rows.flatMap((r) => (r.moveMs === undefined ? [] : [r.moveMs]))),
    }
  }

  /** Tab-separated, oldest first, for pasting into a report. */
  text(now: number) {
    const head = 'n\tpress ms\tgear\tgradient %\tack ms\tpower moved'
    const rows = [...this.rows]
      .reverse()
      .map((r) =>
        [r.n, Math.round(r.at), r.gear, r.grade, r.ackMs ?? '', this.moved(r, now)].join('\t'),
      )
    return [head, ...rows].join('\n')
  }
}
