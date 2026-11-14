import type { Route } from '../../core/route'
import { routeSegments } from '../../core/segments'
import { VIS } from '../params'
import type { Chalk } from './funSigns'
import { seedOf } from './oddPlan'
import { rng } from './scatter'

const P = VIS.route.place.paint
/** A line or dots painted across the road at `d`. */
export interface Paint {
  d: number
  kind: 'kom' | 'sprint' | 'dots'
}

/**
 * Road paint for a route, Tour-style: lines and dots (`lines`) and words (`words`, laid like chalk): kilometres
 * to go, KOM and SPRINT before their lines, and `names` cheered near the top of every timed climb.
 */
export function planPaint(route: Route, names: string[]): { lines: Paint[]; words: Chalk[] } {
  const rand = rng(seedOf(route.id) ^ 0x9a17)
  const lines: Paint[] = []
  const words: Chalk[] = []
  const L = route.distance
  const say = (d: number, text: string, colour: string) =>
    d > 0 && d < L && words.push({ d, text, tint: 0, colour })
  if (!route.loop) for (let k = 1; k * 1000 < L - 100; k++) say(L - k * 1000, `${k} KM`, P.white)
  const short = [...new Set(names.map((n) => n.split(' ')[0].toUpperCase().slice(0, 8)))].filter(
    Boolean,
  )
  for (const s of routeSegments(route)) {
    if (s.kind === 'sprint') {
      lines.push({ d: s.start, kind: 'sprint' }, { d: s.end, kind: 'sprint' })
      say(s.start - P.wordsBefore, 'SPRINT', P.white)
    }
    if (s.kind !== 'climb') continue
    lines.push({ d: s.end, kind: 'kom' })
    say(s.end - P.wordsBefore, 'KOM', P.red)
    for (let d = s.end - P.dotsFrom; d < s.end - P.wordsBefore - 6; d += P.dotsEvery)
      if (d > s.start) lines.push({ d, kind: 'dots' })
    // The crew's names, a different cheer each, the rider's own first.
    for (let i = 0; i < Math.min(P.names, short.length); i++) {
      const d = s.end - P.namesFrom + i * P.nameGap + rand() * 15
      const cheer = P.cheers[Math.floor(rand() * P.cheers.length)]
      if (d > s.start)
        say(
          d,
          cheer.replaceAll('{n}', short[i === 0 ? 0 : 1 + Math.floor(rand() * (short.length - 1))]),
          P.white,
        )
    }
  }
  return { lines, words }
}
