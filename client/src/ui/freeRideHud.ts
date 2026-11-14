import { CFG } from '../config'
import { climbAt, findClimbs } from '../core/climbs'
import { gearCount } from '../core/gears'
import { gradeColour, riderRows, windText } from '../core/hud'
import { steadySpeed, totalMass } from '../core/physics'
import { ascentFrom, routeAt } from '../core/route'
import { settings } from '../core/settings'
import { clock, h } from './dom'
import { profileChart } from './freeRideChart'
import { diffSlider } from './freeRideFlat'
import type { FreeLayout, FreeParts } from './freeRideView'
import { riderList } from './riderList'
import { roadCards } from './roadCards'
import { strengthPct, strengthSlider } from './gearTile'
import { hudMenu, hudStat as stat, hudVal as val } from './hudParts'
import { powerPanel } from './hudPower'
import { UNIT } from './units'
import { segBoard } from './segBoard'
import { segPanel } from './segPanel'

const C = CFG.hud

/**
 * Free-ride HUD over the 3D world, laid out the way riders know from the big apps: power top left, speed and
 * totals top centre, minimap top right, a thin elevation strip along the bottom, and everything else on need.
 */
export function freeRideHud({ route, on, difficulty, mapBox, toggle, confirmEnd }: FreeParts) {
  const power = powerPanel()
  const spd = val('spd', UNIT.names().speed)
  const dist = h('span', {})
  const el = h('span', {})
  const up = h('span', { class: 'up' })
  const lap = h('span', { class: 'lap' })
  const place = h('div', { class: 'race-place' })
  const laps = !!route.lapOf

  const stats = {
    avg: stat('Avg power'),
    np: stat('Normalised'),
    togo: stat('To go'),
    upLeft: stat('Climb to go'),
    eta: stat('Finish in'),
    arrive: stat('Arrive'),
    trainer: stat('Trainer feels'),
    ...(laps ? { lastLap: stat('Last lap'), bestLap: stat('Best lap') } : {}),
    whole: stat(laps ? 'This lap' : 'This ride'),
    ...(settings.wind === 'off' ? {} : { wind: stat('Wind') }),
  }

  const board = segBoard()
  const whole = profileChart(route, undefined, true)
  const next = profileChart(route, { behind: C.climb.behindM, ahead: C.climb.aheadM }, true)
  const climbs = findClimbs(route)
  const grade = h('div', { class: 'glass grade off' })
  const climbHead = h('span', {})
  const toTop = val('', `${UNIT.names().dist} to top`)
  const gain = val('', UNIT.names().climb, '+')
  const topEta = val('', 'ETA')
  // The segment being timed: a column of the climb panel on a climb, a panel of its own for a sprint.
  const sp = segPanel()
  const [segName, segLines] = [sp.name, sp.lines]
  const segCol = h('div', { class: 'seg-col' }, segName, segLines)
  const segBox = h('div', { class: 'glass segbox' })
  const climb = h(
    'div',
    { class: 'glass climb' },
    h('div', { class: 'climb-txt' }, climbHead, toTop.el, gain.el, topEta.el),
    h('div', { class: 'climb-prof' }, next.el),
    segCol,
  )
  climb.hidden = segBox.hidden = true
  const gear = val('', `/${gearCount}`)
  const shiftPct = h('small', { class: 'shift' })
  const gearChip = h(
    'button',
    { class: 'glass gear', title: "Shift strength: tap for the slider, or ; and '" },
    h('span', {}, 'Gear'),
    gear.el,
    shiftPct,
  )
  gearChip.hidden = true
  const list = riderList()
  const crew = roadCards()
  const group = h('div', { class: 'glass gchip' })
  group.hidden = true

  const diff = diffSlider(on.difficulty, difficulty)
  const pauseBtn = h('button', {})
  const m = hudMenu()
  const { el: menu, item } = m
  pauseBtn.onclick = () => (m.close(), on.pause())
  gearChip.onclick = () => (menu.hidden = false)
  menu.append(
    h('h2', {}, route.name),
    route.approx ? h('span', { class: 'tag-approx' }, 'approximate profile') : '',
    h(
      'label',
      {
        title:
          'How much of the road gradient your trainer gets. Your speed always uses the real gradient.',
      },
      'Trainer difficulty',
      diff.el,
    ),
    strengthSlider(),
    m.grid(
      pauseBtn,
      item('End ride', 'Esc', confirmEnd, 'danger'),
      item('Stats', 'S', () => toggle('stats')),
      item('Map', 'M', () => toggle('map')),
      item('Riders', 'R', () => toggle('riders')),
      item('Clean view', 'H', () => toggle('clean')),
    ),
    m.size(),
  )

  const root = h(
    'div',
    { class: 'fhud rhud' },
    h(
      'div',
      { class: 'hud-tl' },
      power.el,
      h('div', { class: 'glass hstats' }, ...Object.values(stats).map((s) => s.el), board.el),
    ),
    h(
      'div',
      { class: 'hud-tc' },
      h(
        'div',
        { class: 'glass speed' },
        spd.el,
        h('div', { class: 'totals' }, ...(laps ? [lap] : []), dist, el, up),
        place,
      ),
    ),
    h('div', { class: 'hud-tr' }, h('div', { class: 'minimap' }, mapBox), list.el, crew.root),
    h(
      'div',
      { class: 'hud-bot' },
      h(
        'div',
        { class: 'dock' },
        h(
          'div',
          { class: 'dock-l' },
          menu,
          m.button,
          h('button', { class: 'glass', onclick: () => toggle('stats') }, 'Stats'),
        ),
        h('div', { class: 'dock-c' }, grade, climb, segBox),
        h('div', { class: 'dock-r' }, group, gearChip),
      ),
      h('div', { class: 'glass strip' }, whole.el),
    ),
  )

  const layout: FreeLayout = {
    el: root,
    setDifficulty: diff.set,
    frame(s) {
      const l = s.live
      power.set({ power: l.avg, ftp: s.ftp, weightKg: s.weightKg, cadence: l.cadence, hr: l.hr })
      spd.v.textContent = UNIT.speed(s.speed)
      const upLeft = ascentFrom(route, s.dist)
      dist.textContent = UNIT.dist(s.dist, s.dist < 10000 ? 2 : 1)
      el.textContent = clock(s.el)
      up.textContent = `+${UNIT.climb(route.ascent - upLeft)}`

      stats.avg.v.textContent = `${Math.round(s.avgPower)} W`
      stats.np.v.textContent = `${Math.round(s.np)} W`
      stats.togo.v.textContent = UNIT.dist(Math.max(0, route.distance - s.dist))
      stats.upLeft.v.textContent = UNIT.climb(upLeft)
      stats.eta.v.textContent = clock(s.etaS)
      stats.arrive.v.textContent = new Date(Date.now() + s.etaS * 1000).toLocaleTimeString(
        'en-AU',
        { hour: 'numeric', minute: '2-digit' },
      )
      stats.trainer.v.textContent = `${s.trainerGrade.toFixed(1)}%`
      if (stats.wind && s.wind !== undefined)
        stats.wind.v.textContent = windText(s.wind, settings.units)
      place.textContent = s.standing ?? ''
      place.hidden = !s.standing
      if (s.lap && stats.lastLap && stats.bestLap) {
        lap.textContent = `Lap ${s.lap.n} / ${s.lap.of}`
        stats.lastLap.v.textContent = s.lap.lastS === undefined ? '–' : clock(s.lap.lastS)
        stats.bestLap.v.textContent = s.lap.bestS === undefined ? '–' : clock(s.lap.bestS)
      }

      grade.textContent = `${s.grade > 0 ? '▲' : '▼'} ${Math.abs(s.grade).toFixed(1)}%`
      grade.style.color = gradeColour(s.grade)
      grade.classList.toggle('off', Math.abs(s.grade) < C.gradeShowPct)
      const c = climbAt(climbs, s.dist)
      climb.hidden = !c
      if (c) {
        const left = c.end - s.dist
        const rise = routeAt(route, c.end).ele - routeAt(route, s.dist).ele
        const v = steadySpeed(l.avg, (rise / left) * 100, totalMass(s.weightKg))
        climbHead.textContent =
          s.dist < c.start
            ? `Climb in ${Math.ceil((c.start - s.dist) / 10) * 10} m`
            : `Climb · ${c.avg.toFixed(1)}% avg`
        toTop.v.textContent = UNIT.distNum(left)
        gain.v.textContent = UNIT.climbNum(Math.max(0, rise))
        topEta.v.textContent = s.speed < C.etaMinMs || v < C.etaMinMs ? '–' : clock(left / v)
        next.set(s.dist)
      }
      // On a climb the segment rides in the climb panel; any other segment gets the small panel to itself.
      const sg = s.seg
      const inClimb = !!c && sg?.kind === 'climb'
      segCol.hidden = !inClimb
      segBox.hidden = !sg || !!c
      if (sg) {
        sp.set(sg, inClimb)
        const home = inClimb ? segCol : segBox
        if (segName.parentElement !== home) home.replaceChildren(segName, segLines)
      }
      board.set(s.board)
      stats.whole.el.hidden = !s.whole?.length
      stats.whole.v.textContent = s.whole?.join(' · ') ?? ''
      gearChip.hidden = !s.gears
      gear.v.textContent = String(s.gear)
      shiftPct.textContent = strengthPct()
      // A group ride shows the crew as cards; a solo ride keeps the list of ghosts nearby.
      crew.root.hidden = !s.group
      if (s.group) {
        const mine = s.riders.find((r) => r.id === s.me)
        const kj = (s.avgPower * s.el) / 1000
        const stats = {
          ftp: s.ftp,
          kg: mine?.kg ?? null,
          avg: s.avgPower,
          np: s.np,
          on: null,
          kj,
          falls: 0,
        }
        crew.set(s.riders, s.me, s.speed, stats)
      }
      list.set(s.group ? [] : riderRows(s.riders, s.me), s.speed)
      const g = s.group
      const pull = g ? Math.round((g.band - 1) * 100) : 0
      const saving = g && g.draftW >= CFG.road.showW
      group.hidden = !saving && !pull
      group.classList.toggle('on', !!saving)
      group.replaceChildren(
        saving ? h('span', {}, 'Drafting ', h('b', {}, `−${Math.round(g.draftW)} W`)) : '',
        pull ? h('span', {}, pull > 0 ? `Tow +${pull}%` : `Held ${pull}%`.replace('-', '−')) : '',
      )
      whole.set(s.dist)
      pauseBtn.replaceChildren(s.paused === 'manual' ? 'Resume' : 'Pause', h('kbd', {}, 'Space'))
    },
  }
  return layout
}
