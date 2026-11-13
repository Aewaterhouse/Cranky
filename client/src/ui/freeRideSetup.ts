import type { Profile } from '../core/curve'
import { CFG } from '../config'
import { parseGpx, routeSeconds, routeStats, type Route } from '../core/route'
import { loadRoute } from '../core/routeLibrary'
import { myRoutes, removeMyRoute, saveMyRoute } from '../core/routeStore'
import { h } from './dom'
import type { HomeActions } from './home'
import { toast } from './toast'
import { routePicker } from './routePicker'
import { needTrainer } from './trainer'

const km = (m: number) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`

const hm = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.round((s % 3600) / 60) % 60).padStart(2, '0')}`

function routeCard(p: Profile, r: Route, selected: boolean, pick: () => void, del?: () => void) {
  const s = routeStats(r)
  return h(
    'div',
    { class: `route-card${selected ? ' on' : ''}`, onclick: pick },
    h('b', {}, r.name),
    h('span', { class: 'dim' }, `${km(r.distance)} · ${r.ascent} m up · avg ${s.avgGrade}%`),
    h(
      'span',
      { class: 'dim' },
      `About ${hm(routeSeconds(r, p.ftp * CFG.freeRide.ftpFrac, p.weightKg))} h at ${Math.round(CFG.freeRide.ftpFrac * 100)}% FTP`,
    ),
    del
      ? h(
          'button',
          {
            class: 'ghost del',
            title: 'Delete this route',
            onclick: (e: Event) => (e.stopPropagation(), del()),
          },
          'Delete',
        )
      : '',
  )
}

/** Free ride setup: pick a route (or import a GPX), then go. */
export function freeRideSetup(p: Profile, act: HomeActions, back: () => void) {
  let sel: Route | undefined = myRoutes()[0]
  const list = h('div', { class: 'route-grid' })
  const lib = routePicker(
    p,
    () => sel?.id,
    async (r) => {
      try {
        sel = await loadRoute(r.id)
        paint()
      } catch (e) {
        toast(`Could not load ${r.name}: ${(e as Error).message}`)
      }
    },
  )
  const startLabel = h('span', { class: 'sb-what' })
  const go = h(
    'button',
    { class: 'primary go', onclick: needTrainer(() => sel && act.freeRide(sel)) },
    'Start',
  )
  const paint = () => {
    const mine = myRoutes()
    if (!sel) sel = mine[0]
    lib.paint()
    list.replaceChildren(
      ...(mine.length
        ? mine.map((r) =>
            routeCard(
              p,
              r,
              r.id === sel?.id,
              () => ((sel = r), paint()),
              () => (removeMyRoute(r.id), r.id === sel?.id && (sel = undefined), paint()),
            ),
          )
        : [h('p', { class: 'dim' }, 'No routes yet. Import a GPX file to start.')]),
    )
    startLabel.replaceChildren(sel ? h('b', {}, sel.name) : 'Pick a route')
    go.disabled = !sel
  }
  const file = h('input', {
    type: 'file',
    accept: '.gpx,application/gpx+xml,text/xml',
    hidden: true,
    onchange: async () => {
      const f = file.files?.[0]
      if (!f) return
      try {
        const r = parseGpx(await f.text(), `my-${Date.now().toString(36)}`)
        if (!saveMyRoute(r)) throw new Error('This browser has no room left to store that route')
        sel = r
        paint()
      } catch (e) {
        toast((e as Error).message)
      }
      file.value = ''
    },
  })
  paint()
  return h(
    'div',
    { class: 'solo-setup' },
    h('button', { class: 'back', onclick: back }, '← Back'),
    h('h1', {}, 'Free ride'),
    h(
      'p',
      { class: 'lede' },
      'No ERG. Your power moves you along a real route and the trainer follows the gradient.',
    ),
    h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Routes'), lib.el),
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'label' }, 'My routes'),
      list,
      h('button', { onclick: () => file.click() }, 'Import GPX'),
      file,
    ),
    h(
      'p',
      { class: 'dim credit' },
      'Route data © OpenStreetMap contributors (ODbL); elevation from NASA SRTM',
    ),
    h('div', { class: 'startbar' }, startLabel, go),
  )
}
