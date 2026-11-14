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

/** A badge the ride just unlocked: its own moment at the top of the results. */
export const badgeCard = (b: Badge) =>
  h(
    'div',
    { class: `card hl badge-new ${b.rank}` },
    h('i', { class: 'medal' }, b.mark),
    h('span', {}, h('b', {}, `Badge unlocked: ${b.name}`), h('small', {}, b.desc)),
  )
