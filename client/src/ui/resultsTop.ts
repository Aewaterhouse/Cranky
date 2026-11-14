import { badges, type Badge } from '../core/badges'
import { COSMETICS } from '../core/cosmetics'
import type { Profile } from '../core/curve'
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

/** One thing to chase next: the Garage item nearest in reach, else the locked badge nearest done. */
export function nextUp(p: Profile) {
  const item = COSMETICS.filter((c) => !p.owned.includes(c.id) && c.price > p.scrap).sort(
    (a, b) => a.price - b.price,
  )[0]
  const badge = badges(p)
    .filter((b) => !b.earned && b.progress && b.progress[0] > 0)
    .sort((a, b) => b.progress![0] / b.progress![1] - a.progress![0] / a.progress![1])[0]
  const bar = (have: number, need: number) =>
    h(
      'div',
      { class: 'need-bar' },
      h('i', { style: `width:${Math.round((have / need) * 100)}%` }),
      h('span', {}, `${have} of ${need}`),
    )
  if (item && (!badge || p.scrap / item.price >= 0.5))
    return h(
      'a',
      { class: 'card next-up', href: '#garage' },
      h('b', {}, `Next up: ${item.name}, ${item.price - p.scrap} scrap to go`),
      bar(p.scrap, item.price),
    )
  if (badge)
    return h(
      'div',
      { class: 'card next-up' },
      h('b', {}, `Next up: the ${badge.name} badge. ${badge.desc}`),
      bar(...badge.progress!),
    )
  return ''
}

/** The same workout or route last time: normalised power then and now. */
export function lastTime(
  p: Profile,
  s: { planName: string; np: number; record: { secs: number } },
) {
  const was = [...p.rides].reverse().find((r) => r.plan === s.planName && r.np)
  if (!was?.np || s.record.secs < 30) return ''
  const d = s.np - was.np
  const when = new Date(was.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  return h(
    'div',
    { class: 'card' },
    h(
      'b',
      {},
      d > 0 ? `Up ${d} W on last time` : d < 0 ? `${-d} W down on last time` : 'Spot on last time',
    ),
    ` · ${s.planName}, ${when}: ${was.np} W normalised, today ${s.np} W.`,
  )
}
