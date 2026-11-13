import '../../hud.css'
import '../../tv.css'
import '../../freeHud.css'
import '../../road.css'
import { riderRows } from '../../core/hud'
import { ROUTE_INDEX, loadRoute } from '../../core/routeLibrary'
import type { RoadLobby, RoadMsg } from '../../net/protocol'
import type { RouteWorld } from '../../scene/route/routeWorld'
import { clock, h, kmStr, show } from '../../ui/dom'
import { riderList } from '../../ui/riderList'
import { roadTvEnd, roadTvLobby } from '../../ui/roadResults'
import { toast } from '../../ui/toast'
import { WsClient } from '../../net/wsClient'
import { RoadLink } from './roadLink'

/**
 * TV / second-screen view of a group ride: the road world following the leader (or a rider picked with the
 * arrow keys), the rider list with gaps, and the crew results at the end. Sends only `watch`.
 */
export function roadSpectate(code: string, leaveTo: () => void) {
  const stage = h('div', { class: 'stage' })
  show(stage)
  const net = new WsClient<RoadMsg>(code)
  const link = new RoadLink('', () => {})
  const list = riderList()
  const head = h('div', { class: 'tv-head' })
  const slot = h('div', { class: 'tv-slot' })
  const status = h('span', { class: 'dim' })
  let lobby: RoadLobby | undefined
  let world: RouteWorld | undefined
  let worldFor = ''
  let lapDist = 0
  /** The rider the camera stays on; empty follows whoever leads. */
  let pick = ''
  const routeName = () => ROUTE_INDEX.find((r) => r.id === lobby?.route)?.name ?? lobby?.route ?? ''

  const leave = () => {
    clearInterval(timer)
    removeEventListener('keydown', onKey)
    net.close()
    world?.dispose()
    history.replaceState(null, '', location.pathname)
    leaveTo()
  }
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'f') {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    } else if (k === 'l') pick = ''
    else if (k === 'arrowleft' || k === 'arrowright') {
      const ids = link
        .others()
        .sort((a, b) => b.d - a.d)
        .map((r) => r.id)
      if (!ids.length) return
      const at = Math.max(0, ids.indexOf(pick))
      pick = ids[(at + (k === 'arrowright' ? 1 : -1) + ids.length) % ids.length]
    }
  }
  addEventListener('keydown', onKey)
  stage.append(
    h(
      'div',
      { class: 'hud tv tv-road' },
      head,
      list.el,
      slot,
      h(
        'div',
        { class: 'tv-ctl' },
        status,
        h('button', { class: 'ghost', onclick: leave }, 'Leave'),
        h('small', {}, 'F: fullscreen · ← →: follow a rider · L: leader'),
      ),
    ),
  )

  const frame = () => {
    if (!lobby || lobby.state !== 'running') return
    const riders = link.others()
    if (!riders.length) return
    const out = riders.filter((r) => r.st !== 'finished')
    const lead = (out.length ? out : riders).reduce((a, r) => (r.d > a.d ? r : a))
    const on = riders.find((r) => r.id === pick) ?? lead
    const lapM = lobby.laps > 1 ? lapDist : 0
    if (world)
      world.state = { me: on.id, riders: riders.map((r) => (lapM ? { ...r, d: r.d % lapM } : r)) }
    list.set(riderRows(riders, on.id), on.speed)
    const count = link.countdown()
    head.replaceChildren(
      h('b', {}, routeName()),
      count > 0
        ? `Starts in ${isFinite(count) ? Math.ceil(count) : '…'}`
        : `${clock(link.el)} · ${kmStr(lead.d)} of ${kmStr(lobby.distance)} km · on ${on.name}`,
    )
    link.takeNotes().forEach((n) => toast(n))
  }
  const timer = setInterval(frame, 200)

  /** Builds the road world for the lobby's route (again if the host changes it). */
  const build = async (l: RoadLobby) => {
    if (worldFor === l.route) return
    worldFor = l.route
    try {
      const [lap, m] = await Promise.all([
        loadRoute(l.route),
        import('../../scene/route/routeWorld'),
      ])
      if (worldFor !== l.route) return
      world?.dispose()
      world = new m.RouteWorld(stage, lap)
      lapDist = lap.distance
      world.state = { me: '', riders: [] }
    } catch {
      toast('This screen cannot draw the road. The rider list still works.', 'bad')
    }
  }

  net.onStatus = (up) => (status.textContent = up ? '' : 'reconnecting…')
  net.onOpen = () => net.send({ t: 'watch' })
  net.onMsg = (m) => {
    if (m.t === 'lobby') {
      lobby = m
      link.lobby(m)
      void build(m)
      if (m.state === 'lobby') {
        link.clear()
        list.set([], 0)
        head.replaceChildren()
        slot.replaceChildren(roadTvLobby(m, routeName()))
      } else if (m.state === 'running') slot.replaceChildren()
    } else if (m.t === 'tick') link.tick(m)
    else if (m.t === 'end') slot.replaceChildren(roadTvEnd(m.summary, leave))
    else if (m.t === 'error') {
      toast(m.msg, 'bad')
      leave()
    }
  }
}
