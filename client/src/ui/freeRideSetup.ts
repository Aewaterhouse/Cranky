import type { Profile } from '../core/curve'
import { CFG } from '../config'
import {
  lapsDefault,
  lapsMax,
  parseGpx,
  routeSeconds,
  routeStats,
  withLaps,
  type Route,
} from '../core/route'
import { ROUTE_INDEX, loadRoute } from '../core/routeLibrary'
import { myRoutes, removeMyRoute, saveMyRoute } from '../core/routeStore'
import { h } from './dom'
import { ghostPick } from './ghostPick'
import { openLeaderboards } from './leaderboards'
import type { HomeActions } from './home'
import { toast } from './toast'
import { routePicker } from './routePicker'
import { needTrainer } from './trainer'
import { UNIT } from './units'
import { weekCard } from './weekCard'
import '../passport.css'

const km = (m: number) => UNIT.dist(m, m < 10000 ? 1 : 0)

const hm = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.round((s % 3600) / 60) % 60).padStart(2, '0')}`

function routeCard(p: Profile, r: Route, selected: boolean, pick: () => void, del?: () => void) {
  const s = routeStats(r)
  return h(
    'div',
    { class: `route-card${selected ? ' on' : ''}`, onclick: pick },
    h('b', {}, r.name),
    h(
      'span',
      { class: 'dim' },
      `${km(r.distance)} · ${UNIT.climb(r.ascent)} up · avg ${s.avgGrade}%`,
    ),
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
/** `start` picks a bundled route as it opens (home's route of the week). */
export function freeRideSetup(
  p: Profile,
  act: HomeActions,
  back: () => void,
  start?: { id: string; name: string },
) {
  let sel: Route | undefined = myRoutes()[0]
  const list = h('div', { class: 'route-grid' })
  const pickBundled = async (r: { id: string; name: string }) => {
    try {
      sel = await loadRoute(r.id)
      laps = lapsDefault(sel)
      paint()
    } catch (e) {
      toast(`Could not load ${r.name}: ${(e as Error).message}`)
    }
  }
  const lib = routePicker(p, () => sel?.id, pickBundled)
  const startLabel = h('span', { class: 'sb-what' })
  const ghosts = ghostPick(p.id)
  let laps = 1
  const lapsBox = h('span', { class: 'laps' })
  const lapsFor = (r: Route) => {
    const step = (by: number) => () => {
      laps = Math.max(1, Math.min(lapsMax(r), laps + by))
      paint()
    }
    lapsBox.replaceChildren(
      h('button', { class: 'ghost', title: 'One lap fewer', onclick: step(-1) }, '−'),
      h('b', {}, `${laps} ${laps === 1 ? 'lap' : 'laps'}`),
      h('button', { class: 'ghost', title: 'One lap more', onclick: step(1) }, '+'),
      h('span', { class: 'dim' }, `${km(r.distance * laps)} · end the ride whenever you like`),
    )
  }
  const go = h(
    'button',
    {
      class: 'primary go',
      onclick: needTrainer(async () => {
        const r = sel && (sel.loop ? withLaps(sel, laps) : sel)
        if (r) act.freeRide(r, await ghosts.specs())
      }),
    },
    'Start',
  )
  const bundled = () => !!sel && ROUTE_INDEX.some((r) => r.id === sel!.id)
  const group = h(
    'button',
    {
      class: 'go',
      title: 'Ride this route with the crew: make a room, share the code, add bots',
      onclick: needTrainer(() => sel && act.groupRide(sel.id, sel.loop ? laps : 1)),
    },
    'Group ride',
  )
  const codeIn = h('input', { maxlength: 4, placeholder: 'CODE', 'aria-label': 'Ride code' })
  const joinForm = h(
    'form',
    {
      class: 'by-code',
      onsubmit: (e: Event) => {
        e.preventDefault()
        const code = codeIn.value.trim().toUpperCase()
        if (code.length === 4) needTrainer(() => act.join(code))()
        else toast('A ride code is four letters')
      },
    },
    h('span', {}, 'Have a ride code?'),
    codeIn,
    h('button', { class: 'ghost' }, 'Join'),
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
    ghosts.set(sel)
    lapsBox.hidden = !sel?.loop
    if (sel?.loop) lapsFor(sel)
    go.disabled = !sel
    group.disabled = !bundled()
    group.title =
      bundled() || !sel ? 'Ride this route with the crew' : 'Group rides use the bundled routes'
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
  if (start) void pickBundled(start)
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
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'label' }, 'Routes'),
      h(
        'button',
        {
          class: 'lb-open',
          title: 'Crew times on every segment of the picked route',
          onclick: () => openLeaderboards(p.id, sel?.id),
        },
        '🏆 Leaderboards',
      ),
      lib.el,
    ),
    weekCard(p, pickBundled),
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
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'label' }, 'Ride together'),
      h(
        'p',
        { class: 'dim' },
        'Pick a bundled route and press Group ride to make a room, or join a mate with their code.',
      ),
      joinForm,
    ),
    h('div', { class: 'startbar' }, startLabel, lapsBox, ghosts.el, group, go),
  )
}
