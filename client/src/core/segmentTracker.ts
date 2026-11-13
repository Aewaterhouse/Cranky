import { CFG } from '../config'
import type { SegKind, Segment } from './segments'

/** One timed go at a segment. */
export interface Effort {
  route: string
  segment: string
  name: string
  kind: SegKind
  secs: number
  /** Average power and W/kg over the effort. */
  watts: number
  wkg: number
  /** ISO time the effort finished. */
  date: string
  /** ISO start of the ride it came from. */
  rideDate?: string
  /** Lap rides: which lap, from 1. */
  lap?: number
  /** Metres from the segment's start every `traceS` seconds: the pace of the effort, for splits and ghosts. */
  trace?: number[]
}

/** A finished effort as the results and the ride history show it. */
export interface SegResult extends Omit<Effort, 'trace'> {
  /** A new personal best (a first go counts), and whether it also took the crew's best. */
  pr: boolean
  first: boolean
  crewBest: boolean
  /** The PR it was up against, if there was one. */
  prevS?: number
}

interface Open {
  t0: number
  j0: number
  at: number
  trace: number[]
}

/**
 * Times every segment as the rider crosses its start and end. Feed it distance, ride time and work done as
 * they grow; crossings are timed to where the line was, not to the tick. On a lap ride every lap is a go.
 */
export class SegmentTracker {
  private open = new Map<string, Open>()
  private prev = { d: 0, el: 0, j: 0 }

  constructor(
    readonly segs: Segment[],
    private route: string,
    private kg: number,
    private lapM = Infinity,
    private laps = 1,
    private now = () => new Date().toISOString(),
  ) {}

  /** Seconds into a go at `seg` at ride time `el`, or undefined when not on it. */
  elapsed(seg: Segment, el: number) {
    const o = this.open.get(seg.id)
    return o && el - o.t0
  }

  /**
   * `d` metres ridden, `el` seconds of riding, `joules` of work so far. `teleport` is a position jump that was
   * not ridden (a late join): goes under way are dropped and nothing starts. Returns the efforts just finished.
   */
  update(d: number, el: number, joules: number, teleport = false): Effort[] {
    const p = this.prev
    this.prev = { d, el, j: joules }
    if (teleport) this.open.clear()
    if (teleport || d <= p.d) return []
    const f = (m: number) => (m - p.d) / (d - p.d)
    const out: Effort[] = []
    const T = CFG.segments.traceS
    const first = Math.floor(p.d / this.lapM) || 0
    const last = Math.min(this.laps - 1, Math.floor(d / this.lapM) || 0)
    for (const s of this.segs)
      for (let k = first; k <= last; k++) {
        const off = k ? k * this.lapM : 0
        const a = s.start + off
        const b = s.end + off
        if (p.d <= a && a < d)
          this.open.set(s.id, {
            t0: p.el + f(a) * (el - p.el),
            j0: p.j + f(a) * (joules - p.j),
            at: a,
            trace: [],
          })
        const o = this.open.get(s.id)
        if (!o || o.at !== a) continue
        while (el > p.el && o.t0 + (o.trace.length + 1) * T <= el) {
          const at = (o.t0 + (o.trace.length + 1) * T - p.el) / (el - p.el)
          o.trace.push(Math.round(Math.min(b, p.d + Math.max(0, at) * (d - p.d)) - a))
        }
        if (!(p.d < b && b <= d)) continue
        this.open.delete(s.id)
        const secs = p.el + f(b) * (el - p.el) - o.t0
        if (secs <= 0) continue
        const watts = (p.j + f(b) * (joules - p.j) - o.j0) / secs
        out.push({
          route: this.route,
          segment: s.id,
          name: s.name,
          kind: s.kind,
          secs: +secs.toFixed(1),
          watts: Math.round(watts),
          wkg: +(watts / this.kg).toFixed(2),
          date: this.now(),
          ...(this.laps > 1 ? { lap: k + 1 } : {}),
          trace: o.trace.filter((_, i) => (i + 1) * T < secs),
        })
      }
    return out
  }
}

/** Where a ghost riding `trace` (an effort of `secs` over `lenM` metres) is `t` seconds in. */
export function traceAt(trace: number[], secs: number, lenM: number, t: number): number {
  if (t >= secs) return lenM
  const T = CFG.segments.traceS
  const i = Math.floor(Math.max(0, t) / T)
  const a = i ? (trace[i - 1] ?? lenM) : 0
  const t1 = Math.min(secs, (i + 1) * T)
  const b = (i + 1) * T < secs ? (trace[i] ?? lenM) : lenM
  return a + ((b - a) * (Math.max(0, t) - i * T)) / (t1 - i * T)
}

/** Seconds into an effort (`trace`, `secs` over `lenM` metres) at which it was `m` metres along. */
export function traceTime(trace: number[], secs: number, lenM: number, m: number): number {
  if (m >= lenM) return secs
  const T = CFG.segments.traceS
  const i = trace.findIndex((d) => d >= m)
  const a = i < 0 ? (trace[trace.length - 1] ?? 0) : i ? trace[i - 1] : 0
  const b = i < 0 ? lenM : trace[i]
  const t0 = (i < 0 ? trace.length : i) * T
  const t1 = i < 0 ? secs : t0 + T
  return b > a ? t0 + ((t1 - t0) * (Math.max(0, m) - a)) / (b - a) : t0
}
