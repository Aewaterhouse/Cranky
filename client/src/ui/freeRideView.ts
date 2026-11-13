import '../solo.css'
import '../freeride.css'
import { ascentFrom, routeStats, type Route } from '../core/route'
import type { Live } from '../modes/rideController'
import { fmt, h } from './dom'
import { gradeColour, profileChart } from './freeRideChart'
import { gearTile, strengthSlider } from './gearTile'

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
  /** Virtual gear. */
  gear: number
  dist: number
  el: number
  paused: 'manual' | 'auto' | null
  /** Waiting for the first pedal stroke. */
  starting: boolean
  avgPower: number
  np: number
  weightKg: number
  /** Seconds to the finish at the average speed so far. */
  etaS: number
}

const kmh = (v: number) => (v * 3.6).toFixed(1)
const km = (m: number) => (m / 1000).toFixed(m < 10000 ? 2 : 1)
const clock = (s: number) => {
  const t = Math.max(0, Math.round(s))
  return t >= 3600 ? `${Math.floor(t / 3600)}:${fmt(t % 3600).padStart(5, '0')}` : fmt(t)
}

/** Free ride player: big numbers, whole-route and next-km elevation profiles, optional map, controls. */
export function freeRideView(route: Route, on: FreeHandlers, difficulty: number) {
  const num = (label: string, unit = '', cls = '') => {
    const v = h('b', {}, '–')
    const sub = h('i', {})
    return {
      v,
      sub,
      el: h(
        'div',
        { class: `sbig ${cls}` },
        h('span', {}, label),
        v,
        unit ? h('small', {}, unit) : '',
        sub,
      ),
    }
  }
  const speed = num('Speed', 'km/h')
  const pow = num('Power · 3 s', 'W')
  const cad = num('Cadence', 'rpm')
  const hr = num('HR', 'bpm')
  const gearT = gearTile()
  const dist = num('Distance', 'km', 'sm')
  const togo = num('To go', 'km', 'sm')
  const up = num('Climbed', 'm', 'sm')
  const upLeft = num('Climb to go', 'm', 'sm')
  const el = num('Elapsed', '', 'sm')
  const eta = num('ETA', '', 'sm')
  const avgP = num('Avg power', 'W', 'sm')
  const np = num('NP', 'W', 'sm')
  const wkg = num('W/kg', '', 'sm')

  const whole = profileChart(route)
  const next = profileChart(route, { behind: 100, ahead: 900 })
  const gv = h('b', {}, '0.0')
  const gbox = h('div', { class: 'gradebox' }, h('span', {}, 'Gradient'), gv, h('small', {}, '%'))
  const mapBox = h('div', { class: 'fr-map' })
  mapBox.hidden = true
  let mapUpdate: ((d: number) => void) | undefined
  // The map is optional: no coordinates, no network or a failed load all leave the panel hidden.
  if (routeStats(route).hasMap && navigator.onLine)
    void import('./freeRideMap')
      .then((m) => {
        const r = m.routeMap(mapBox, route)
        mapBox.hidden = false
        r.resize()
        new ResizeObserver(r.resize).observe(mapBox)
        mapUpdate = r.update
      })
      .catch(() => {
        mapBox.hidden = true
      })

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
            h('button', { onclick: () => (delete ov.dataset.k, say(null)) }, 'Keep riding'),
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
      route.approx ? h('span', { class: 'tag-approx' }, 'approximate profile') : '',
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
      strengthSlider(),
      h(
        'div',
        { class: 'ctl' },
        pauseBtn,
        h('button', { class: 'danger', onclick: confirmEnd }, 'End ride'),
      ),
    ),
    h('div', { class: 'frrow frtop' }, speed.el, pow.el, cad.el, gearT.el, hr.el),
    h(
      'section',
      { class: 'fr-mid' },
      h(
        'div',
        { class: 'fr-charts' },
        h('div', { class: 'chartbox whole' }, whole.el),
        h('div', { class: 'chartbox strip' }, gbox, h('div', { class: 'next' }, next.el)),
      ),
      mapBox,
      ov,
    ),
    h(
      'div',
      { class: 'frrow frbot' },
      dist.el,
      togo.el,
      up.el,
      upLeft.el,
      el.el,
      eta.el,
      avgP.el,
      np.el,
      wkg.el,
    ),
  )

  return {
    root,
    confirmEnd,
    setDifficulty: setDiff,
    frame(s: FreeState) {
      const l = s.live
      const set = (n: { v: HTMLElement }, t: string) => (n.v.textContent = t)
      set(speed, kmh(s.speed))
      set(pow, String(Math.round(l.avg)))
      set(cad, String(Math.round(l.cadence)))
      set(hr, l.hr ? String(l.hr) : '–')
      set(dist, km(s.dist))
      set(togo, km(Math.max(0, route.distance - s.dist)))
      const gained = route.ascent - ascentFrom(route, s.dist)
      set(up, String(Math.round(gained)))
      set(upLeft, String(Math.round(route.ascent - gained)))
      set(el, clock(s.el))
      set(eta, clock(s.etaS))
      eta.sub.textContent = `arrive ${new Date(Date.now() + s.etaS * 1000).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
      set(avgP, String(Math.round(s.avgPower)))
      set(np, String(Math.round(s.np)))
      set(wkg, (l.avg / s.weightKg).toFixed(2))
      gv.textContent = s.grade.toFixed(1)
      gbox.style.setProperty('--g', gradeColour(s.grade))
      gearT.set(s.gear, s.trainerGrade)
      whole.set(s.dist)
      next.set(s.dist)
      mapUpdate?.(s.dist)
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
