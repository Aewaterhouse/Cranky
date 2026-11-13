import '../intro.css'
import { profileSample } from '../core/flyover'
import type { Route } from '../core/route'
import { routeLine } from '../fun/routeLines'
import { h } from './dom'
import { miniProfile } from './routePicker'

/**
 * The card before a ride: route name, distance, climb, a small profile and a line about the place. It covers
 * the screen while the world loads, then `fly` turns it into a caption under the flyover. Any key or tap calls
 * `skip`; `done` fades it out and takes it away.
 */
export function rideIntro(route: Route, skip: () => void) {
  const what = h('span', { class: 'in-what' }, 'Loading the road…')
  const hint = h('span', { class: 'in-hint' }, '')
  const el = h(
    'div',
    { class: 'intro loading', onpointerdown: skip },
    h(
      'div',
      { class: 'in-card' },
      what,
      h('h1', {}, route.name),
      h(
        'p',
        { class: 'in-nums' },
        h('b', {}, `${(route.distance / 1000).toFixed(1)} km`),
        h('b', {}, `${Math.round(route.ascent)} m up`),
      ),
      miniProfile(profileSample(route)),
      h('p', { class: 'in-line' }, routeLine(route.id)),
      hint,
    ),
  )
  // Capture, so the key that skips the flyover does not also pause, shift or open a menu.
  const key = (e: KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    skip()
  }
  addEventListener('keydown', key, true)
  hint.textContent = 'Any key or tap to skip'
  return {
    el,
    /** The world is up: stop covering it and caption the sweep over `stretch`. */
    fly(stretch: string) {
      what.textContent = stretch
      el.classList.remove('loading')
    },
    done() {
      removeEventListener('keydown', key, true)
      el.classList.add('out')
      setTimeout(() => el.remove(), 600)
    },
  }
}
