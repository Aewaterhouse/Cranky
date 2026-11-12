import { PLANS } from '../content'
import { api } from '../core/api'
import { generate, parsePlan } from '../core/plan'
import type { Profile } from '../core/curve'
import type { Plan } from '../types'
import { avatar, h } from './dom'
import { soloSetup } from './solo'
import { needTrainer } from './trainer'

export interface HomeActions {
  drill(plan: Plan): void
  create(): void
  join(code: string): void
  logout(): void
}
interface Room {
  code: string
  state: string
  plan: string
  host: string | null
  riders: string[]
}

export const DURATIONS = [0, 30, 45, 60, 75, 90]
const POLL_MS = 3000

export function planFor(id: string, minutes: number): Plan {
  const raw = PLANS.find((p) => p.id === id)!
  return minutes ? generate(raw, minutes) : parsePlan(raw)
}

function busCard(r: Room, join: (code: string) => void) {
  const running = r.state === 'running'
  return h(
    'article',
    { class: 'bus-card' },
    h(
      'header',
      {},
      h('h3', {}, `${r.host ?? 'Someone'}’s bus`),
      h('span', { class: `state${running ? ' run' : ''}` }, running ? 'On the road' : 'Boarding'),
    ),
    h('p', { class: 'plan' }, r.plan, h('span', { class: 'code-tag' }, r.code)),
    h(
      'div',
      { class: 'aboard' },
      ...r.riders.map((n) => avatar(n, 'sm')),
      h('span', { class: 'dim' }, `${r.riders.length}/6 on board`),
    ),
    h(
      'button',
      {
        class: 'primary',
        disabled: r.riders.length >= 6,
        onclick: needTrainer(() => join(r.code)),
      },
      r.riders.length >= 6 ? 'Bus full' : running ? 'Jump on' : 'Join',
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

export function rideTab(p: Profile, act: HomeActions) {
  const list = h('div', { class: 'buses' })
  let seen = ''
  const render = (rooms: Room[] | null) => {
    const key = JSON.stringify(rooms)
    if (key === seen) return
    seen = key
    if (!rooms) return list.replaceChildren(h('p', { class: 'dim' }, 'Looking for buses…'))
    list.replaceChildren(
      ...(rooms.length
        ? rooms.map((r) => busCard(r, act.join))
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
  const joinCode = (e: Event) => {
    e.preventDefault()
    const c = code.value.trim().toUpperCase()
    if (c.length === 4) needTrainer(() => act.join(c))()
    else code.focus()
  }
  const main = h(
    'div',
    { class: 'ride' },
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
    soon('📺', 'Watch party', 'Same workout, same video, all in sync.'),
    soon('🎮', 'More games', 'Handicap race, chaingang, last rider standing.'),
  )
  const wrap = h('div', {}, main)
  return wrap
}
