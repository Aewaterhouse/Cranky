import type { GhostSpec } from '../core/ghost'
import { CFG } from '../config'
import { PLANS } from '../content'
import { api } from '../core/api'
import { generate, parsePlan } from '../core/plan'
import { clearSnap, loadSnap, rememberedBus, soloKey, type SoloSnap } from '../core/snapshot'
import type { Profile } from '../core/curve'
import type { Route } from '../core/route'
import type { Plan } from '../types'
import { avatar, fmt, h } from './dom'
import { freeRideSetup } from './freeRideSetup'
import { soloSetup } from './solo'
import { planScreen, todayCard } from './planCalendar'
import { needTrainer } from './trainer'

export interface HomeActions {
  drill(plan: Plan): void
  /** `ghosts` are the best efforts picked to ride along. */
  freeRide(route: Route, ghosts?: GhostSpec[]): void
  /** Make a group-ride room on a bundled route. Joining one by code is `join`. */
  groupRide(route: string, laps: number): void
  resume(snap: SoloSnap): void
  create(): void
  join(code: string): void
  watch(code: string): void
  logout(): void
}
interface Room {
  code: string
  /** `road` is a group ride on a route; `plan` is then the route's name. */
  kind?: 'bus' | 'road'
  state: string
  plan: string
  host: string | null
  riders: string[]
}

export const DURATIONS = [0, 15, 30, 45, 60, 75, 90]
const POLL_MS = 3000

export function planFor(id: string, minutes: number): Plan {
  const raw = PLANS.find((p) => p.id === id)!
  return minutes ? generate(raw, minutes) : parsePlan(raw)
}

function rejoinCard(r: Room, join: (code: string) => void) {
  return h(
    'section',
    { class: 'resume' },
    h('span', { class: 'big-emoji' }, r.kind === 'road' ? '🚴' : '🚌'),
    h(
      'span',
      {},
      h('b', {}, `Rejoin ${r.kind === 'road' ? 'ride' : 'bus'} ${r.code}`),
      h('small', {}, r.plan),
    ),
    h('button', { class: 'primary', onclick: needTrainer(() => join(r.code)) }, 'Rejoin'),
  )
}

function busCard(r: Room, act: HomeActions) {
  const { join, watch } = act
  const road = r.kind === 'road'
  const full = r.riders.length >= (road ? CFG.road.seats : 6)
  const running = r.state === 'running'
  return h(
    'article',
    { class: 'bus-card' },
    h(
      'header',
      {},
      h('h3', {}, `${r.host ?? 'Someone'}’s ${road ? 'group ride' : 'bus'}`),
      h(
        'span',
        { class: `state${running ? ' run' : ''}` },
        running ? 'On the road' : road ? 'Gathering' : 'Boarding',
      ),
    ),
    h('p', { class: 'plan' }, r.plan, h('span', { class: 'code-tag' }, r.code)),
    h(
      'div',
      { class: 'aboard' },
      ...r.riders.map((n) => avatar(n, 'sm')),
      h(
        'span',
        { class: 'dim' },
        road ? `${r.riders.length} riding` : `${r.riders.length}/6 on board`,
      ),
    ),
    h(
      'div',
      { class: 'card-btns' },
      full
        ? ''
        : h(
            'button',
            { class: 'primary', onclick: needTrainer(() => join(r.code)) },
            running ? 'Jump on' : 'Join',
          ),
      h(
        'button',
        {
          class: full ? 'primary' : 'ghost',
          title: 'Watch on this screen',
          onclick: () => watch(r.code),
        },
        full ? 'Full · Watch' : '📺 Watch',
      ),
    ),
  )
}

/** Ride tab: open buses first, then a new bus, then solo. */
const soon = (emoji: string, name: string, blurb: string) =>
  h(
    'div',
    { class: 'solo soon' },
    h('span', { class: 'big-emoji' }, emoji),
    h('span', {}, h('b', {}, name), h('small', {}, blurb)),
    h('span', { class: 'arrow' }, 'coming soon'),
  )

/** Card offering to carry on a solo ride that a refresh or crash cut short. */
function resumeCard(p: Profile, act: HomeActions) {
  const snap = loadSnap<SoloSnap>(soloKey(p.id))
  if (!snap) return h('div')
  const card = h('section', { class: 'resume' })
  const discard = () => (clearSnap(soloKey(p.id)), card.remove())
  card.append(
    h('span', { class: 'big-emoji' }, '⏪'),
    h(
      'span',
      {},
      h('b', {}, 'Resume your workout?'),
      h('small', {}, `${snap.plan.name}, ${fmt(snap.el)} in`),
    ),
    h('button', { class: 'primary', onclick: needTrainer(() => act.resume(snap)) }, 'Resume'),
    h('button', { onclick: discard }, 'Discard'),
  )
  return card
}

export function rideTab(p: Profile, act: HomeActions) {
  const list = h('div', { class: 'buses' })
  const rejoin = h('div')
  let seen = ''
  const render = (rooms: Room[] | null) => {
    const key = JSON.stringify(rooms)
    if (key === seen) return
    seen = key
    const mine = rooms?.find((r) => r.code === rememberedBus(p.id))
    rejoin.replaceChildren(mine ? rejoinCard(mine, act.join) : '')
    if (!rooms) return list.replaceChildren(h('p', { class: 'dim' }, 'Looking for buses…'))
    list.replaceChildren(
      ...(rooms.length
        ? rooms.map((r) => busCard(r, act))
        : [
            h(
              'div',
              { class: 'empty' },
              h('span', { class: 'big-emoji' }, '🛣️'),
              h('b', {}, 'No buses on the road yet'),
              h('span', {}, 'Start one and it shows up here for the crew.'),
            ),
          ]),
    )
  }
  const poll = async () => {
    const rooms = await api<Room[]>('/api/rooms').catch(() => [])
    if (!list.isConnected) return clearInterval(timer)
    render(rooms)
  }
  const timer = setInterval(poll, POLL_MS)
  render(null)
  poll()

  const code = h('input', {
    placeholder: 'ABCD',
    maxLength: 4,
    'aria-label': 'Bus code',
    value:
      new URLSearchParams(location.search).get('join') ??
      sessionStorage.getItem('zombiebus.code') ??
      '',
  })
  const withCode = (go: (c: string) => void) => (e: Event) => {
    e.preventDefault()
    const c = code.value.trim().toUpperCase()
    if (c.length === 4) go(c)
    else code.focus()
  }
  const joinCode = withCode((c) => needTrainer(() => act.join(c))())
  const goWorkout = (id: string) => needTrainer(() => act.drill(planFor(id, 0)))()
  const today = h('div')
  const home = () => (
    today.replaceChildren(todayCard(p, goWorkout, openPlan)),
    wrap.replaceChildren(main)
  )
  const openPlan = () => wrap.replaceChildren(planScreen(p, goWorkout, home))
  const main = h(
    'div',
    { class: 'ride' },
    resumeCard(p, act),
    rejoin,
    today,
    h(
      'section',
      { class: 'hero' },
      h('h2', { class: 'label' }, 'Crew game'),
      h('h1', {}, '🧟 Zombie Bus'),
      h(
        'p',
        { class: 'lede' },
        'Everyone pedals at their own FTP. Keep the bus moving or the horde eats you.',
      ),
      h(
        'div',
        { class: 'hero-grid' },
        h('div', {}, h('h2', { class: 'label' }, 'Open buses'), list),
        h(
          'div',
          { class: 'start' },
          h(
            'button',
            { class: 'mega', onclick: needTrainer(act.create) },
            h('span', { class: 'plus' }, '+'),
            h('b', {}, 'Start a new bus'),
            h('small', {}, 'You drive. Pick the plan, share the code.'),
          ),
          h(
            'form',
            { class: 'by-code', onsubmit: joinCode },
            h('span', {}, 'Got a code?'),
            code,
            h('button', {}, 'Join'),
            h(
              'button',
              { type: 'button', class: 'ghost', onclick: withCode(act.watch) },
              '📺 Watch',
            ),
          ),
        ),
      ),
    ),
    h(
      'button',
      {
        class: 'solo',
        onclick: () => wrap.replaceChildren(soloSetup(p, act, () => wrap.replaceChildren(main))),
      },
      h('span', { class: 'big-emoji' }, '🚴'),
      h(
        'span',
        {},
        h('b', {}, 'Solo workout'),
        h('small', {}, 'Ride a workout on your own, no bus.'),
      ),
      h('span', { class: 'arrow' }, '→'),
    ),
    h(
      'button',
      { class: 'solo', onclick: openPlan },
      h('span', { class: 'big-emoji' }, '📅'),
      h(
        'span',
        {},
        h('b', {}, 'Training plan'),
        h(
          'small',
          {},
          p.plan
            ? 'Your calendar and what is next.'
            : 'Pick a multi-week plan and the days you ride.',
        ),
      ),
      h('span', { class: 'arrow' }, '→'),
    ),
    h(
      'button',
      {
        class: 'solo',
        onclick: () =>
          wrap.replaceChildren(freeRideSetup(p, act, () => wrap.replaceChildren(main))),
      },
      h('span', { class: 'big-emoji' }, '🏔️'),
      h(
        'span',
        {},
        h('b', {}, 'Free ride'),
        h('small', {}, 'Ride a real route. No ERG, the trainer follows the road.'),
      ),
      h('span', { class: 'arrow' }, '→'),
    ),
    soon('📺', 'Watch party', 'Same workout, same video, all in sync.'),
    soon('🎮', 'More games', 'Handicap race, chaingang, last rider standing.'),
  )
  const wrap = h('div', {}, main)
  home()
  return wrap
}
