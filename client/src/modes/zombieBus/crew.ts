import type { Profile } from '../../core/curve'
import { api } from '../../core/api'
import { saveProfile } from '../../core/profile'
import type { Lobby, ServerMsg } from '../../net/protocol'
import { WsClient } from '../../net/wsClient'
import { h, show } from '../../ui/dom'
import { lobbyView } from '../../ui/lobby'
import { finishRide } from '../../ui/results'
import { toast } from '../../ui/toast'
import type { Trainer } from '../../types'
import { startBusRide, type BusRide } from './zombieBus'

/** Crew session: lobby, ride and results over one WebSocket. */
export async function crew(
  code: string | null,
  profile: Profile,
  trainer: Trainer,
  home: (p?: Profile) => void,
) {
  if (!code) {
    try {
      code = (await api<{ code: string }>('/api/rooms', { method: 'POST' })).code
    } catch {
      return toast('No game server reachable. Solo workout still works.', 'bad')
    }
  }
  sessionStorage.setItem('zombiebus.code', code)
  const net = new WsClient(code)
  let lobby: Lobby | null = null
  let ride: BusRide | null = null
  let inResults = false
  const status = h('span', { class: 'dim' }, 'connecting…')
  net.onStatus = (up) => (status.textContent = up ? '' : 'reconnecting…')
  net.onOpen = () =>
    net.send({
      t: 'join',
      name: profile.name,
      ftp: profile.ftp,
      tier: profile.tier,
      look: profile.look,
    })
  const leave = () => {
    net.close()
    ride?.abort()
    sessionStorage.removeItem('zombiebus.code')
    home(profile)
  }

  const view = lobbyView({
    profile: () => profile,
    status,
    setup: (plan, minutes) => net.send({ t: 'setup', plan, minutes }),
    tier: (tier) => {
      profile.tier = tier
      saveProfile(profile)
      net.send({ t: 'tier', tier })
    },
    start: () => net.send({ t: 'start' }),
    leave,
  })
  const renderLobby = (l: Lobby) => {
    view.update(l)
    if (!view.isConnected) show(view)
  }

  net.onMsg = (m: ServerMsg) => {
    if (m.t === 'lobby') {
      lobby = m
      ride?.lobby(m)
      if (m.state === 'running' && !ride) {
        inResults = false
        ride = startBusRide(m, profile, trainer, net, leave)
      } else if (!ride && !inResults) renderLobby(m)
    } else if (m.t === 'tick') ride?.tick(m)
    else if (m.t === 'end') {
      if (!ride) return
      const s = ride.finish()
      ride = null
      inResults = true
      s.then(({ summary, postcard }) =>
        finishRide(
          profile,
          summary,
          (p) => {
            profile = p
            inResults = false
            if (lobby) renderLobby(lobby)
          },
          { ...m.summary, postcard },
          'Back to the bus',
        ),
      )
    } else if (m.t === 'error') {
      if (/No bus|Bus full/.test(m.msg)) {
        toast(m.msg, 'bad')
        leave()
      } else ride ? ride.toast(m.msg) : toast(m.msg, 'bad')
    }
  }
}
