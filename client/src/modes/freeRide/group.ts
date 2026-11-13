import { api } from '../../core/api'
import type { Profile } from '../../core/curve'
import { withLaps } from '../../core/route'
import { loadRoute } from '../../core/routeLibrary'
import { forgetBus, rememberBus } from '../../core/snapshot'
import type { RoadLobby, RoadMsg } from '../../net/protocol'
import { WsClient } from '../../net/wsClient'
import { h, show } from '../../ui/dom'
import { roadLobbyView } from '../../ui/roadLobby'
import { toast } from '../../ui/toast'
import type { Trainer } from '../../types'
import { crew } from '../zombieBus/crew'
import { runFreeRide } from './freeRide'
import { RoadLink } from './roadLink'

/** What the host picked on the free-ride setup before making the room. */
export interface GroupSetup {
  route: string
  laps: number
}

/**
 * A group ride over one WebSocket: lobby, the ride (the ordinary free-ride loop with a `RoadLink`) and results.
 * `code` null makes a new room with `setup`. A code that turns out to be a bus is handed to the bus flow.
 */
export async function groupRide(
  code: string | null,
  setup: GroupSetup | null,
  profile: Profile,
  trainer: Trainer,
  home: (p?: Profile) => void,
) {
  if (!code) {
    try {
      const made = await api<{ code: string }>('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'road' }),
      })
      code = made.code
    } catch {
      return toast('No game server reachable. Solo free ride still works.', 'bad')
    }
  }
  const room = code
  rememberBus(profile.id, room)
  const net = new WsClient<RoadMsg>(room)
  const link = new RoadLink(profile.id, (m) => net.send(m))
  let lobby: RoadLobby | undefined
  let ride: ReturnType<typeof runFreeRide> | undefined
  let starting = false
  let inResults = false
  let pending = setup
  const status = h('span', { class: 'dim' }, 'connecting…')
  net.onStatus = (up) => (status.textContent = up ? '' : 'reconnecting…')
  net.onOpen = () => {
    net.send({
      t: 'join',
      name: profile.name,
      ftp: profile.ftp,
      tier: profile.tier,
      look: profile.look,
    })
    if (pending) net.send({ t: 'road', ...pending, style: 'social' })
    pending = null
  }
  const leave = (p: Profile = profile) => {
    net.close()
    forgetBus(profile.id)
    home(p)
  }
  const view = roadLobbyView({
    profile: () => profile,
    status,
    setup: (route, laps, style, together) => net.send({ t: 'road', route, laps, style, together }),
    bots: (n) => net.send({ t: 'bots', n }),
    start: () => net.send({ t: 'start' }),
    leave: () => leave(),
  })
  const renderLobby = (l: RoadLobby) => {
    view.update(l)
    if (!view.isConnected) show(view)
  }
  /** Results closed: back to the lobby after a full ride, home if the rider left one that is still going. */
  const afterResults = (p: Profile) => {
    profile = p
    ride = undefined
    if (!inResults) return leave(p)
    inResults = false
    if (lobby) renderLobby(lobby)
  }
  const begin = async (l: RoadLobby) => {
    starting = true
    link.clear()
    try {
      const lap = await loadRoute(l.route)
      ride = runFreeRide(withLaps(lap, l.laps), profile, trainer, afterResults, link)
    } catch (e) {
      toast(`Could not load the route: ${(e as Error).message}`, 'bad')
      leave()
    }
    starting = false
  }

  net.onMsg = (m) => {
    if (m.t === 'lobby') {
      if (m.kind !== 'road') {
        net.close()
        return void crew(room, profile, trainer, home)
      }
      lobby = m
      link.lobby(m)
      if (m.state === 'running' && !ride && !starting && !inResults) void begin(m)
      else if (!ride && !starting && !inResults) renderLobby(m)
    } else if (m.t === 'tick') link.tick(m)
    else if (m.t === 'end') {
      if (!ride) return
      inResults = true
      void ride.end(m.summary)
    } else if (m.t === 'error') {
      toast(m.msg, 'bad')
      if (/No bus|full/.test(m.msg)) leave()
    }
  }
}
