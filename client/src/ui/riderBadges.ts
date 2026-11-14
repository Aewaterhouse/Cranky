import { badges, prTimeline, type Badge } from '../core/badges'
import type { Profile } from '../core/curve'
import { fmtDur } from '../core/powerCurve'
import { h } from './dom'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** Milestone badges: earned ones in colour with their date, the rest dimmed with what they take. `only` narrows the list. */
export function badgeGrid(p: Profile, title = 'Badges', only: (b: Badge) => boolean = () => true) {
  const all = badges(p).filter(only)
  return h(
    'section',
    { class: 'panel' },
    h(
      'h2',
      { class: 'label' },
      `${title} (${all.filter((b) => b.earned).length} of ${all.length})`,
    ),
    h(
      'div',
      { class: 'badges' },
      ...all.map((b) =>
        h(
          'div',
          { class: `badge ${b.rank}${b.earned ? ' got' : ''}`, title: b.desc },
          h('i', { class: 'medal' }, b.mark),
          h(
            'div',
            {},
            h('b', {}, b.name),
            h('small', {}, b.earned ? (b.date ? `Earned ${day(b.date)}` : 'Earned') : b.desc),
            // How far along a locked badge is, so there is always a next thing within reach.
            !b.earned && b.progress
              ? h(
                  'span',
                  { class: 'badge-prog' },
                  h('i', {
                    style: `width:${Math.min(100, (b.progress[0] / b.progress[1]) * 100)}%`,
                  }),
                  h(
                    'small',
                    {},
                    `${Math.round(b.progress[0]).toLocaleString()} / ${b.progress[1].toLocaleString()}`,
                  ),
                )
              : '',
          ),
        ),
      ),
    ),
  )
}

/** When each power best was set, newest first. */
export function prTimelinePanel(p: Profile) {
  const events = prTimeline(p)
  const list = h('ol', { class: 'timeline' })
  let all = false
  const draw = () => {
    list.replaceChildren(
      ...events
        .slice(0, all ? events.length : 12)
        .map((e) =>
          h(
            'li',
            {},
            h('time', {}, day(e.date)),
            h(
              'span',
              {},
              h('b', {}, `${fmtDur(e.d)} best: ${e.w} W`),
              p.weightKg ? ` (${(e.w / p.weightKg).toFixed(2)} W/kg)` : '',
              h(
                'small',
                {},
                e.prev == null ? ' first effort' : ` up ${e.w - e.prev} W from ${e.prev} W`,
              ),
            ),
          ),
        ),
    )
    more.hidden = all || events.length <= 12
  }
  const more = h(
    'button',
    { class: 'link', onclick: () => ((all = true), draw()) },
    `Show all ${events.length}`,
  )
  draw()
  return h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'label' }, 'Power best timeline'),
    events.length ? list : h('p', { class: 'dim' }, 'Your bests land here as you set them.'),
    more,
  )
}
