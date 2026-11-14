import type { Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { h } from './dom'
import { modal } from './toast'
import { currentTrainer, openTrainer, useSim } from './trainer'

const SEEN = (id: string) => `cranky.welcomed.${id}`

/** First-run welcome: FTP, what the tiers and "compliance" mean, and pairing a trainer. Shown once per rider per device. */
export function maybeWelcome(p: Profile, refresh: () => void) {
  if (localStorage.getItem(SEEN(p.id)) || p.stats.rides > 0) return
  localStorage.setItem(SEEN(p.id), '1')
  const ftp = h('input', { type: 'number', value: p.ftp, min: 50, max: 600 })
  const body = h('div', { class: 'welcome' })
  const steps: (() => Node[])[] = [
    () => [
      h(
        'p',
        {},
        `G'day ${p.name}. Cranky runs your smart trainer for workouts on your own and games with the crew.`,
      ),
      h(
        'p',
        {},
        "Everything is scaled to your FTP: the power you could hold for about an hour. If you don't know it, 200 W is a fair first guess, and there are FTP tests under Solo workout.",
      ),
      h('label', { class: 'field' }, h('span', {}, 'Your FTP (watts)'), ftp),
    ],
    () => [
      h(
        'ul',
        { class: 'welcome-points' },
        h(
          'li',
          {},
          h('b', {}, 'A target, not a race. '),
          'Your trainer holds your target power for you (ERG): keep the pedals turning.',
        ),
        h(
          'li',
          {},
          h('b', {}, 'Scored on you. '),
          'Points come from staying near your own target, so a 150 W rider and a 350 W rider ride together.',
        ),
        h(
          'li',
          {},
          h('b', {}, 'Pick your effort. '),
          'Full is the workout as written, Medium 90%, Easy 80%.',
        ),
      ),
    ],
    () => [
      h(
        'p',
        {},
        'Last step: connect your trainer. Close MyWhoosh, Zwift and the Wahoo app first, since only one app can control it. Use Chrome or Edge.',
      ),
      h(
        'button',
        { class: 'ghost', onclick: () => (useSim(Number(ftp.value) || p.ftp), close(), refresh()) },
        'No trainer handy? Use the simulator',
      ),
    ],
  ]
  let i = 0
  const next = h('button', { class: 'primary' }, 'Next')
  const back = h('button', { class: 'ghost', onclick: () => (i--, render()) }, 'Back')
  const dots = h('div', { class: 'welcome-dots' })
  const render = () => {
    body.replaceChildren(...steps[i]())
    dots.replaceChildren(...steps.map((_, n) => h('i', { class: n === i ? 'on' : '' })))
    back.hidden = i === 0
    next.textContent =
      i === steps.length - 1 ? (currentTrainer() ? 'Done' : 'Connect trainer') : 'Next'
  }
  const close = modal(
    'Welcome to Cranky',
    body,
    h('div', { class: 'welcome-foot' }, dots, back, next),
  )
  next.addEventListener('click', () => {
    if (i === 0) {
      p.ftp = Math.max(50, Math.min(600, +ftp.value || 200))
      saveProfile(p)
      refresh()
    }
    if (i < steps.length - 1) return (i++, render())
    close()
    if (!currentTrainer()) openTrainer()
  })
  render()
}
