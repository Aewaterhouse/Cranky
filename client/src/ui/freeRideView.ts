import '../solo.css'
import '../freeride.css'
import type { Live } from '../modes/rideController'
import type { Route } from '../core/route'
import { fmt, h } from './dom'

export interface FreeHandlers {
  pause: () => void
  end: () => void
  /** Trainer difficulty, 0..1. */
  difficulty: (v: number) => void
}

export interface FreeState {
  live: Live
  /** m/s */
  speed: number
  grade: number
  trainerGrade: number
  dist: number
  el: number
  paused: 'manual' | 'auto' | null
  /** Waiting for the first pedal stroke. */
  starting: boolean
  difficulty: number
  ascentDone: number
}

const kmh = (v: number) => (v * 3.6).toFixed(1)
const km = (m: number) => (m / 1000).toFixed(m < 10000 ? 2 : 1)

/** Free ride player layout: big numbers, route progress and controls. */
export function freeRideView(route: Route, on: FreeHandlers, difficulty: number) {
  const num = (label: string, unit = '', cls = '') => {
    const v = h('b', {}, '–')
    return {
      v,
      el: h(
        'div',
        { class: `sbig ${cls}` },
        h('span', {}, label),
        v,
        unit ? h('small', {}, unit) : '',
      ),
    }
  }
  const speed = num('Speed', 'km/h', 'hero')
  const pow = num('Power · 3 s', 'W')
  const cad = num('Cadence', 'rpm')
  const hr = num('HR', 'bpm')
  const grade = num('Gradient', '%', 'grade')
  const dist = num('Distance', 'km')
  const togo = num('To go', 'km')
  const el = num('Elapsed')
  const bar = h('i')
  const ov = h('div', { class: 'overlay' })
  const pauseBtn = h('button', { onclick: on.pause })
  const diffVal = h('b', { class: 'pct' })
  const diff = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    'aria-label': 'Trainer difficulty',
    oninput: () => on.difficulty(+diff.value / 100),
  })
  const setDiff = (v: number) => {
    diff.value = String(Math.round(v * 100))
    diffVal.textContent = `${Math.round(v * 100)}%`
  }
  setDiff(difficulty)

  let dialog = false
  const say = (nodes: Node[] | null, cls = '') => {
    dialog = cls === 'dialog'
    ov.className = `overlay${nodes ? ` open ${cls}` : ''}`
    if (nodes) ov.replaceChildren(...nodes)
  }
  const confirmEnd = () =>
    say(
      [
        h(
          'div',
          { class: 'dlg' },
          h('h2', {}, 'End ride?'),
          h('p', { class: 'dim' }, 'Your ride so far will be saved.'),
          h(
            'div',
            { class: 'row' },
            h('button', { onclick: () => say(null) }, 'Keep riding'),
            h('button', { class: 'primary', onclick: on.end }, 'End ride'),
          ),
        ),
      ],
      'dialog',
    )
  const kbd = (t: string) => h('kbd', {}, t)
  const root = h(
    'div',
    { class: 'fr' },
    h(
      'header',
      { class: 'solo-head' },
      h('h1', {}, route.name),
      h(
        'label',
        {
          class: 'field',
          title:
            'How much of the road gradient your trainer gets. Your speed always uses the real gradient.',
        },
        'Trainer difficulty',
        h('div', { class: 'diff' }, diff, diffVal),
      ),
      h(
        'div',
        { class: 'ctl' },
        pauseBtn,
        h('button', { class: 'danger', onclick: confirmEnd }, 'End ride'),
      ),
    ),
    h(
      'section',
      { class: 'fr-main' },
      h('div', { class: 'frrow top' }, speed.el, pow.el, cad.el, hr.el, grade.el),
      h('div', { class: 'frrow' }, dist.el, togo.el, el.el),
      h('div', { class: 'fr-bar' }, bar),
      ov,
    ),
  )

  return {
    root,
    confirmEnd,
    setDifficulty: setDiff,
    frame(s: FreeState) {
      const l = s.live
      speed.v.textContent = kmh(s.speed)
      pow.v.textContent = String(Math.round(l.avg))
      cad.v.textContent = String(Math.round(l.cadence))
      hr.v.textContent = l.hr ? String(l.hr) : '–'
      grade.v.textContent = s.grade.toFixed(1)
      grade.el.title = `Trainer is getting ${s.trainerGrade.toFixed(1)}%`
      dist.v.textContent = km(s.dist)
      togo.v.textContent = km(Math.max(0, route.distance - s.dist))
      el.v.textContent = fmt(s.el)
      bar.style.width = `${Math.min(100, (s.dist / route.distance) * 100)}%`
      pauseBtn.replaceChildren(s.paused === 'manual' ? 'Resume ' : 'Pause ', kbd('Space'))
      root.classList.toggle('paused', !!s.paused)
      if (dialog) return
      const msg = s.starting
        ? ['Start pedalling', 'The clock starts when you do', 'count']
        : s.paused === 'manual'
          ? ['Paused', 'Press Space to carry on', 'pause']
          : s.paused === 'auto'
            ? ['Auto-paused', 'Keep pedalling to carry on', 'pause']
            : null
      const key = msg?.join('|') ?? ''
      if (ov.dataset.k === key) return
      ov.dataset.k = key
      say(
        msg && [
          h('div', { class: `ovbig ${msg[2]}` }, msg[0]),
          h('div', { class: 'ovsub' }, msg[1]),
        ],
        msg?.[2],
      )
    },
  }
}
