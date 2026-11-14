import type { Badge } from '../core/badges'
import type { RoadSummary } from '../net/protocol'
import { h } from './dom'
import type { GroupSummary } from './resultsViews'

const ORD = ['th', 'st', 'nd', 'rd']
const ordinal = (n: number) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : (ORD[n % 10] ?? 'th')}`
/** The results headline says how it went: your place in a race, a limp home, a flooded town. */
export function headline(me: string, group?: GroupSummary, road?: RoadSummary) {
  if (road?.game && road.game !== 'ride') {
    const at = road.riders.findIndex((r) => r.id === me)
    return at === 0 ? 'You won!' : at > 0 ? `${ordinal(at + 1)} place` : 'Race done'
  }
  if (!group) return 'Ride done'
  if (group.flooded) return 'The town flooded'
  if (group.mode === undefined || group.mode === 'bus')
    return group.armour <= 0 ? 'Limped home!' : 'Made it!'
  return 'Made it!'
}

/**
 * A crew score with something to compare it to: your best and your last for this game on this device, then
 * remembers this one. Empty the first time.
 */
export function scoreContext(me: string, g: GroupSummary) {
  const key = `cranky.scores.${me}.${g.mode ?? 'bus'}`
  let was: { best: number; last: number } | null = null
  try {
    was = JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    /* none kept */
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ best: Math.max(was?.best ?? 0, g.score), last: g.score }),
    )
  } catch {
    /* storage blocked: the score still shows */
  }
  const crew = g.crewBest
  if (crew != null && g.score > crew)
    return `New crew record! The old best was ${crew.toLocaleString()}.`
  const mine = was ? ` · your best ${was.best.toLocaleString()}` : ''
  if (crew != null) return `Crew best ${crew.toLocaleString()}${mine}`
  if (!was) return 'Your first go. Beat it next time.'
  if (g.score > was.best) return `New best! Up from ${was.best.toLocaleString()}.`
  return `Your best ${was.best.toLocaleString()} · last time ${was.last.toLocaleString()}`
}

/** A badge the ride just unlocked: its own moment at the top of the results. */
export const badgeCard = (b: Badge) =>
  h(
    'div',
    { class: `card hl badge-new ${b.rank}` },
    h('i', { class: 'medal' }, b.mark),
    h('span', {}, h('b', {}, `Badge unlocked: ${b.name}`), h('small', {}, b.desc)),
  )
