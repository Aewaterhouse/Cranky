import type { Profile } from '../core/curve'
import { h } from './dom'
import type { HomeActions } from './home'
import { needTrainer } from './trainer'

/**
 * The top of home for a rider without a training plan: a first ride to try, or a welcome back with what they have
 * done and what they can spend. It changes as they ride, so home never looks like day one again.
 */
export function hello(p: Profile, act: HomeActions) {
  const last = p.rides.reduce<Profile['rides'][number] | null>(
    (m, r) => (!m || r.date > m.date ? r : m),
    null,
  )
  if (!last)
    return h(
      'button',
      { class: 'panel hello', onclick: needTrainer(() => act.create('bus')) },
      h('span', { class: 'big-emoji' }, '🧟'),
      h(
        'span',
        {},
        h('b', {}, `First ride, ${p.name}? Jump on the Zombie Bus`),
        h(
          'small',
          {},
          'Bots fill the seats, pick the 15 minute Lunch Break Quickie, and keep the bus ahead of the horde.',
        ),
      ),
      h('span', { class: 'arrow' }, 'Go →'),
    )
  const days = Math.floor((Date.now() - Date.parse(last.date)) / 86400000)
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
  return h(
    'section',
    { class: 'panel hello' },
    h('span', { class: 'big-emoji' }, p.stats.streak > 1 ? '🔥' : '👋'),
    h(
      'span',
      {},
      h('b', {}, `G'day ${p.name}. Last ride ${ago}.`),
      h(
        'small',
        {},
        `${p.stats.rides} rides · ${Math.round(p.stats.secs / 3600)} h · ${p.stats.kj.toLocaleString()} kJ` +
          (p.stats.streak > 1 ? ` · ${p.stats.streak} week streak` : ''),
      ),
    ),
    p.scrap > 0 ? h('a', { class: 'arrow', href: '#garage' }, `⚙ ${p.scrap} to spend →`) : '',
  )
}

/** A big card for one of the solo modes, alongside the crew games. */
export const mode = (icon: string, name: string, tag: string, go: () => void) =>
  h(
    'button',
    { class: 'home-game home-mode', onclick: go },
    h('span', { class: 'gc-icon' }, icon),
    h('b', {}, name),
    h('small', {}, tag),
  )
