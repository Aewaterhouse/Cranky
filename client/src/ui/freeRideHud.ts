import { CFG } from '../config'
import { climbAt, findClimbs } from '../core/climbs'
import { gearCount } from '../core/gears'
import { gradeColour, powerZone, riderRows, windText } from '../core/hud'
import { steadySpeed, totalMass } from '../core/physics'
import { ascentFrom, routeAt } from '../core/route'
import { settings } from '../core/settings'
import { clock, h, kmStr } from './dom'
import { profileChart } from './freeRideChart'
import { diffSlider } from './freeRideFlat'
import type { FreeLayout, FreeParts } from './freeRideView'
import { ZONE_COLOURS } from './planGraph'
import { riderList } from './riderList'
import { segBoard } from './segBoard'
import { segPanel } from './segPanel'

const C = CFG.hud

/**
 * Free-ride HUD over the 3D world, laid out the way riders know from the big apps: power top left, speed and
 * totals top centre, minimap top right, a thin elevation strip along the bottom, and everything else on need.
 */
export function freeRideHud({ route, on, difficulty, mapBox, toggle, confirmEnd }: FreeParts) {
  /** A number with its unit small after it. */
  const val = (cls: string, unit: string, lead = '') => {
    const v = h('b', {}, '–')
    return { v, el: h('span', { class: `hv ${cls}` }, lead, v, h('small', {}, unit)) }
  }
  const pw = val('hpw', 'W')
  const wkg = val('wkg', 'W/kg')
  const zone = h('span', { class: 'zone' })
  const bar = h('i', { class: 'pw-bar' })
  const cad = val('sub off', 'rpm')
  const hr = val('sub off', 'bpm', '♥ ')
  const spd = val('spd', 'km/h')
  const dist = h('span', {})
  const el = h('span', {})
  const up = h('span', { class: 'up' })
  const lap = h('span', { class: 'lap' })
  const laps = !!route.lapOf

  const stat = (label: string) => {
    const v = h('b', {}, '–')
    return { v, el: h('div', {}, h('span', {}, label), v) }
  }
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
  const toTop = val('', 'km to top')
  const gain = val('', 'm', '+')
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
  const gearChip = h('div', { class: 'glass gear' }, h('span', {}, 'Gear'), gear.el)
  gearChip.hidden = true
  const list = riderList()
  const group = h('div', { class: 'glass gchip' })
  group.hidden = true

  const diff = diffSlider(on.difficulty, difficulty)
  const pauseBtn = h('button', {})
  const menu = h('div', { class: 'glass hmenu' })
  menu.hidden = true
  const item = (label: string | Node, key: string, act: () => void, cls = '') =>
    h(
      'button',
      { class: cls, onclick: () => ((menu.hidden = true), act()) },
      label,
      h('kbd', {}, key),
    )
  pauseBtn.onclick = () => ((menu.hidden = true), on.pause())
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
    h(
      'div',
      { class: 'menu-grid' },
      pauseBtn,
      item('End ride', 'Esc', confirmEnd, 'danger'),
      item('Stats', 'S', () => toggle('stats')),
      item('Map', 'M', () => toggle('map')),
      item('Riders', 'R', () => toggle('riders')),
      item('Clean view', 'H', () => toggle('clean')),
    ),
  )

  const root = h(
    'div',
    { class: 'fhud' },
    h(
      'div',
      { class: 'hud-tl' },
      h(
        'div',
        { class: 'glass power' },
        h('div', { class: 'pw-row' }, pw.el, h('div', { class: 'pw-side' }, zone, wkg.el)),
        bar,
        h('div', { class: 'pw-sub' }, cad.el, hr.el),
      ),
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
      ),
    ),
    h('div', { class: 'hud-tr' }, h('div', { class: 'minimap' }, mapBox), list.el),
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
          h(
            'button',
            {
              class: 'glass',
              'aria-label': 'Menu',
              onclick: () => (menu.hidden = !menu.hidden),
            },
            '☰',
          ),
          h('button', { class: 'glass', onclick: () => toggle('stats') }, 'Stats'),
        ),
        h('div', { class: 'dock-c' }, grade, climb, segBox),
        h('div', { class: 'dock-r' }, group, gearChip),
      ),
      h('div', { class: 'glass strip' }, whole.el),
    ),
  )

  let hadCadence = false
  const layout: FreeLayout = {
    el: root,
    setDifficulty: diff.set,
    frame(s) {
      const l = s.live
      const z = powerZone(l.avg / s.ftp)
      pw.v.textContent = String(Math.round(l.avg))
      wkg.v.textContent = (l.avg / s.weightKg).toFixed(1)
      zone.textContent = `Z${z}`
      bar.style.background = ZONE_COLOURS[z - 1]
      // Each sensor keeps its slot, so nothing shuffles when one drops out.
      hadCadence ||= l.cadence > 0
      cad.v.textContent = String(Math.round(l.cadence))
      cad.el.classList.toggle('off', !hadCadence)
      hr.v.textContent = String(l.hr ?? '')
      hr.el.classList.toggle('off', l.hr == null)
      spd.v.textContent = (s.speed * 3.6).toFixed(1)
      const upLeft = ascentFrom(route, s.dist)
      dist.textContent = `${kmStr(s.dist)} km`
      el.textContent = clock(s.el)
      up.textContent = `+${Math.round(route.ascent - upLeft)} m`

      stats.avg.v.textContent = `${Math.round(s.avgPower)} W`
      stats.np.v.textContent = `${Math.round(s.np)} W`
      stats.togo.v.textContent = `${kmStr(Math.max(0, route.distance - s.dist))} km`
      stats.upLeft.v.textContent = `${Math.round(upLeft)} m`
      stats.eta.v.textContent = clock(s.etaS)
      stats.arrive.v.textContent = new Date(Date.now() + s.etaS * 1000).toLocaleTimeString(
        'en-AU',
        { hour: 'numeric', minute: '2-digit' },
      )
      stats.trainer.v.textContent = `${s.trainerGrade.toFixed(1)}%`
      if (stats.wind && s.wind !== undefined) stats.wind.v.textContent = windText(s.wind)
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
        toTop.v.textContent = kmStr(left)
        gain.v.textContent = String(Math.max(0, Math.round(rise)))
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
      list.set(riderRows(s.riders, s.me), s.speed)
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
