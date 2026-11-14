import { setBack } from './back'
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
import { toast } from './toast'
import { freeRideSetup } from './freeRideSetup'
import { gamePicker } from './gamePicker'
import type { Game } from '../net/protocol'
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
  /** Opens a new crew room, set to `game` if given. */
  create(game?: Game): void
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

/** A big card for one of the solo modes, alongside the crew games. */
const mode = (icon: string, name: string, tag: string, go: () => void) =>
  h(
    'button',
    { class: 'home-game home-mode', onclick: go },
    h('span', { class: 'gc-icon' }, icon),
    h('b', {}, name),
    h('small', {}, tag),
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
              h('b', {}, 'Nobody is riding yet'),
              h('span', {}, 'Pick a crew game above and it shows up here for your mates to join.'),
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
  // Check the code before asking for a trainer, so a typo is caught straight away and the letters stay put.
  const joinCode = withCode((c) =>
    api(`/api/rooms/${c}`).then(
      () => needTrainer(() => act.join(c))(),
      () => (toast(`No ride with the code ${c}. Check the letters?`, 'bad'), code.select()),
    ),
  )
  const goWorkout = (id: string) => needTrainer(() => act.drill(planFor(id, 0)))()
  const today = h('div')
  const home = () => (
    setBack(null),
    today.replaceChildren(todayCard(p, goWorkout, openPlan)),
    wrap.replaceChildren(main)
  )
  /** A screen inside the Ride tab; Back (or its own back button) returns to the tab. */
  const open = (el: HTMLElement) => (wrap.replaceChildren(el), setBack(home))
  const openPlan = () => open(planScreen(p, goWorkout, home))
  const main = h(
    'div',
    { class: 'ride' },
    resumeCard(p, act),
    rejoin,
    today,
    h(
      'section',
      { class: 'hero' },
      h('h2', { class: 'label' }, 'Pick a ride'),
      h('h1', {}, 'Ride'),
      h(
        'div',
        { class: 'home-games home-modes' },
        mode('🏔️', 'Free ride', 'Real roads, solo or with the crew', () =>
          open(freeRideSetup(p, act, home)),
        ),
        mode('🚴', 'Solo workout', 'A structured workout on ERG', () =>
          open(soloSetup(p, act, home)),
        ),
        mode(
          '📈',
          'Training plan',
          p.plan ? 'Your calendar and what is next' : 'A few weeks, your riding days',
          openPlan,
        ),
      ),
      h('h2', { class: 'label' }, 'Crew games'),
      h(
        'p',
        { class: 'lede' },
        'Everyone rides at their own FTP. Pick a game, share the code, bots fill the empty seats.',
      ),
      gamePicker((g) => needTrainer(() => act.create(g))()),
      h(
        'div',
        { class: 'hero-grid' },
        h('div', {}, h('h2', { class: 'label' }, 'Open rides'), list),
        h(
          'div',
          { class: 'start' },
          h(
            'form',
            { class: 'by-code', onsubmit: joinCode },
            h('span', {}, 'Got a code?'),
            code,
            h('button', {}, 'Join'),
            h(
              'button',
              { type: 'button', class: 'ghost', onclick: withCode(act.watch) },
              '📺 TV view',
            ),
          ),
        ),
      ),
    ),
  )
  const wrap = h('div', {}, main)
  home()
  return wrap
}
