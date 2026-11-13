import { gradeColour, riderRows } from '../core/hud'
import { ascentFrom } from '../core/route'
import { clock, h } from './dom'
import { profileChart } from './freeRideChart'
import type { FreeLayout, FreeParts } from './freeRideView'
import { gearTile, strengthSlider } from './gearTile'
import { riderList } from './riderList'
import { segBoard } from './segBoard'
import { segPanel } from './segPanel'
import { UNIT } from './units'

/** Trainer difficulty slider with its percentage; `set` moves it without firing the handler. */
export function diffSlider(on: (v: number) => void, value: number) {
  const pct = h('b', { class: 'pct' })
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    'aria-label': 'Trainer difficulty',
    oninput: () => (on(+input.value / 100), set(+input.value / 100)),
  })
  const set = (v: number) => {
    input.value = String(Math.round(v * 100))
    pct.textContent = `${Math.round(v * 100)}%`
  }
  set(value)
  return { el: h('div', { class: 'diff' }, input, pct), set }
}

/** The flat free-ride layout: tiles of numbers, whole-route and next-km profiles and the map. */
export function freeRideFlat({ route, on, difficulty, mapBox, ov, confirmEnd }: FreeParts) {
  const num = (label: string, unit = '', cls = '') => {
    const v = h('b', {}, '–')
    const sub = h('i', {})
    const el = h('div', { class: `sbig ${cls}` }, h('span', {}, label), v)
    if (unit) el.append(h('small', {}, unit))
    el.append(sub)
    return { v, sub, el }
  }
  const speed = num('Speed', UNIT.names().speed)
  const pow = num('Power · 3 s', 'W')
  const cad = num('Cadence', 'rpm')
  const hr = num('HR', 'bpm')
  const dist = num('Distance', UNIT.names().dist, 'sm')
  const togo = num('To go', UNIT.names().dist, 'sm')
  const up = num('Climbed', UNIT.names().climb, 'sm')
  const upLeft = num('Climb to go', UNIT.names().climb, 'sm')
  const el = num('Elapsed', '', 'sm')
  const eta = num('ETA', '', 'sm')
  const avgP = num('Avg power', 'W', 'sm')
  const np = num('NP', 'W', 'sm')
  const wkg = num('W/kg', '', 'sm')

  const whole = profileChart(route)
  const next = profileChart(route, { behind: 100, ahead: 900 })
  const gv = h('b', {}, '0.0')
  const gearT = gearTile()
  const gbox = h('div', { class: 'gradebox' }, h('span', {}, 'Gradient'), gv, h('small', {}, '%'))
  const pauseBtn = h('button', { onclick: on.pause })
  // The same lap counter, segment panel, splits, top three and rider gaps (ghosts included) as the 3D HUD.
  const lap = h('div', { class: 'fs-lap' })
  const sp = segPanel()
  const segBox = h('div', { class: 'fs-seg' }, sp.name, sp.lines)
  const wholeSplit = h('div', { class: 'fs-whole' })
  const board = segBoard()
  const list = riderList()
  const side = h('aside', { class: 'fr-side' }, lap, segBox, wholeSplit, board.el, list.el)
  lap.hidden = segBox.hidden = wholeSplit.hidden = side.hidden = true
  const diff = diffSlider(on.difficulty, difficulty)

  const root = h(
    'div',
    { class: 'fr-flat' },
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
        diff.el,
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
      side,
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

  const layout: FreeLayout = {
    el: root,
    setDifficulty: diff.set,
    frame(s) {
      const l = s.live
      const set = (n: { v: HTMLElement }, t: string) => (n.v.textContent = t)
      set(speed, UNIT.speed(s.speed))
      set(pow, String(Math.round(l.avg)))
      set(cad, String(Math.round(l.cadence)))
      set(hr, l.hr ? String(l.hr) : '–')
      set(dist, UNIT.distNum(s.dist))
      set(togo, UNIT.distNum(Math.max(0, route.distance - s.dist)))
      const gained = route.ascent - ascentFrom(route, s.dist)
      set(up, UNIT.climbNum(gained))
      set(upLeft, UNIT.climbNum(route.ascent - gained))
      set(el, clock(s.el))
      set(eta, clock(s.etaS))
      eta.sub.textContent = `arrive ${new Date(Date.now() + s.etaS * 1000).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
      set(avgP, String(Math.round(s.avgPower)))
      set(np, String(Math.round(s.np)))
      set(wkg, (l.avg / s.weightKg).toFixed(2))
      gv.textContent = s.grade.toFixed(1)
      gbox.style.setProperty('--g', gradeColour(s.grade))
      gearT.set(s.gear, s.trainerGrade)
      lap.hidden = !s.lap
      if (s.lap)
        lap.replaceChildren(
          h('b', {}, `Lap ${s.lap.n} / ${s.lap.of}`),
          h('span', {}, `Last ${s.lap.lastS === undefined ? '–' : clock(s.lap.lastS)}`),
          h('span', {}, `Best ${s.lap.bestS === undefined ? '–' : clock(s.lap.bestS)}`),
        )
      segBox.hidden = !s.seg
      if (s.seg) sp.set(s.seg)
      wholeSplit.hidden = !s.whole?.length
      wholeSplit.textContent = `${route.lapOf ? 'This lap' : 'This ride'} ${s.whole?.join(' · ') ?? ''}`
      board.set(s.board)
      list.set(riderRows(s.riders, s.me), s.speed)
      side.hidden = [...side.children].every((c) => (c as HTMLElement).hidden)
      whole.set(s.dist)
      next.set(s.dist)
      pauseBtn.replaceChildren(s.paused === 'manual' ? 'Resume ' : 'Pause ', h('kbd', {}, 'Space'))
    },
  }
  return layout
}
