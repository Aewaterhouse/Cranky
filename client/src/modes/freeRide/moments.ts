import { CFG } from '../../config'
import { segClock } from '../../core/segments'
import { MOMENT_LINES } from '../../fun/momentLines'

const M = CFG.moments

export type MomentKind = 'summit' | 'finish'
/** What the stats flash shows. */
export interface MomentCard {
  kind: MomentKind
  head: string
  line: string
  tiles: [label: string, value: string][]
}

/** Spots the two set-piece moments of a ride, each once: over the top of the main climb, and the finish. No DOM. */
export class Moments {
  private seen = new Set<MomentKind>()

  /** `topD` is where the main climb tops out (undefined on a route with no climb to speak of). */
  constructor(
    private topD: number | undefined,
    private total: number,
  ) {
    // A summit right before the line is the finish's moment, not one of its own.
    if (topD === undefined || total - topD < M.nearFinishM) this.seen.add('summit')
  }

  next(dist: number): MomentKind | undefined {
    const kind: MomentKind | undefined =
      dist >= this.total ? 'finish' : dist >= (this.topD ?? Infinity) ? 'summit' : undefined
    if (!kind || this.seen.has(kind)) return undefined
    this.seen.add(kind)
    return kind
  }
}

/** The card for a moment: a headline, a dry line (the same one for the same time) and the numbers so far. */
export function momentCard(
  kind: MomentKind,
  s: { el: number; avgPower: number; kg: number; prs: number; place?: string },
): MomentCard {
  const lines = MOMENT_LINES[kind]
  return {
    kind,
    head: kind === 'summit' ? 'Summit' : s.place ? `Finished ${s.place}` : 'Finish',
    line: lines[Math.round(s.el) % lines.length],
    tiles: [
      ['Time', segClock(s.el)],
      ['Avg power', `${Math.round(s.avgPower)} W`],
      ['W/kg', (s.avgPower / s.kg).toFixed(2)],
      ['PRs', String(s.prs)],
    ],
  }
}
