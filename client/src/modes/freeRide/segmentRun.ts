import { CFG } from '../../config'
import type { Best, Bests } from '../../core/efforts'
import type { Route } from '../../core/route'
import {
  baseRoute,
  routeSegments,
  segClock,
  splitText,
  type SegKind,
  type Segment,
} from '../../core/segments'
import { SegmentTracker, traceTime, type Effort, type SegResult } from '../../core/segmentTracker'
import { segLine } from '../../fun/segmentLines'

/** What the HUD's segment panel shows. */
export interface SegLive {
  name: string
  kind: SegKind
  /** Metres to the start while it is still up the road. */
  inM?: number
  /** Time so far and the splits, or the times to beat before the start. */
  lines: string[]
}

/**
 * The segments of one ride: times them, works out the live splits against `bests` (my PR and the best of
 * the crew, each from the pace of that effort itself), and says so when one is finished. `say(text, level)`: 0 a plain result, 1 a PR, 2 a crew best.
 * No DOM and no network: the caller stores what `onEffort` hands it.
 */
export function segmentRun(
  route: Route,
  rider: { id: string; kg: number },
  bests: Bests,
  say: (text: string, level: 0 | 1 | 2) => void,
  onEffort: (e: Effort) => void = () => {},
) {
  const base = baseRoute(route)
  const lapM = route.lapOf ? base.distance : Infinity
  const laps = route.lapOf ? Math.round(route.distance / base.distance) : 1
  const segs = routeSegments(route)
  const tracker = new SegmentTracker(segs, base.id, rider.kg, lapM, laps)
  const whole = segs[segs.length - 1]
  const results: SegResult[] = []
  let joules = 0

  /**
   * "−0:04 vs PR" and "+0:11 vs Luke" for a go `t` seconds in at `d` metres along the lap: my time against
   * the time the best took to get this far, read off its own trace. A best with no trace gives no split.
   */
  const splits = (s: Segment, t: number, d: number) => {
    const b = bests[s.id]
    const vs = (best: Best | undefined, who: string) =>
      best?.trace
        ? [
            `${splitText(t - traceTime(best.trace, best.secs, s.end - s.start, d - s.start))} vs ${who}`,
          ]
        : []
    return [...vs(b?.pr, 'PR'), ...vs(b?.crew, b?.crew?.name ?? '')]
  }

  function finish(e: Effort) {
    const b = (bests[e.segment] ??= {})
    const prevS = b.pr?.secs
    const pr = prevS === undefined || e.secs < prevS
    // Taking the crew's best means beating the best of the others with a time I had not already beaten it with.
    const crewBest =
      pr && !!b.crew && e.secs < b.crew.secs && (prevS === undefined || prevS >= b.crew.secs)
    const { trace, ...row } = e
    if (pr) b.pr = { secs: e.secs, date: e.date, trace }
    results.push({ ...row, pr, first: prevS === undefined, crewBest, prevS })
    onEffort(e)
    const head = `${e.name} · ${segClock(e.secs)}`
    if (crewBest)
      say(
        `Crew best! ${head}, ${segClock(b.crew!.secs - e.secs)} up on ${b.crew!.name}. ${segLine('crew', e.secs)}`,
        2,
      )
    else if (prevS === undefined) say(`${head}. ${segLine('first', e.secs)}`, 1)
    else if (pr) say(`New PR! ${head}, by ${segClock(prevS - e.secs)}. ${segLine('pr', e.secs)}`, 1)
    // A plain lap already gets the lap toast.
    else if (e.kind !== 'lap')
      say(`${head} · ${splitText(e.secs - prevS)} on your best. ${segLine('miss', e.secs)}`, 0)
  }

  return {
    segs,
    results,
    /**
     * Call every tick with metres ridden, ride time, power and the ride time since the last tick. Returns the
     * climb or sprint to show (on it, or about to be) and the split for the whole route or lap.
     */
    tick(dist: number, el: number, power: number, dt: number, teleport = false) {
      joules += power * dt
      tracker.update(dist, el, joules, teleport).forEach(finish)
      const d = dist >= route.distance ? base.distance : dist % lapM
      let seg: SegLive | undefined
      for (const s of segs) {
        if (s === whole) continue
        const t = tracker.elapsed(s, el)
        const lead = s.kind === 'climb' ? CFG.hud.climb.leadM : CFG.segments.sprint.leadM
        if (t !== undefined && d < s.end)
          seg = { name: s.name, kind: s.kind, lines: [segClock(t), ...splits(s, t, d)] }
        else if (!seg && d < s.start && d >= s.start - lead) {
          const b = bests[s.id]
          seg = {
            name: s.name,
            kind: s.kind,
            inM: s.start - d,
            lines: [
              ...(b?.pr ? [`PR ${segClock(b.pr.secs)}`] : []),
              ...(b?.crew ? [`${b.crew.name} ${segClock(b.crew.secs)}`] : []),
            ],
          }
        }
      }
      const t = tracker.elapsed(whole, el)
      return { seg, whole: t === undefined ? [] : splits(whole, t, d) }
    },
  }
}
