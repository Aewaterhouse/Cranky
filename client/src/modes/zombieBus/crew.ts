import { setBack } from '../../ui/back'
import type { Profile } from '../../core/curve'
import { api } from '../../core/api'
import { saveProfile } from '../../core/profile'
import { saveSettings, settings } from '../../core/settings'
import { forgetBus, rememberBus } from '../../core/snapshot'
import type { Game, Lobby, ServerMsg } from '../../net/protocol'
import { WsClient } from '../../net/wsClient'
import { h, show } from '../../ui/dom'
import { lobbyView } from '../../ui/lobby'
import { finishRide } from '../../ui/results'
import { toast } from '../../ui/toast'
import type { Trainer } from '../../types'
import { groupRide } from '../freeRide/group'
import { startBusRide, type BusRide } from './zombieBus'

/** Crew session: lobby, ride and results over one WebSocket. */
export async function crew(
  code: string | null,
  profile: Profile,
  trainer: Trainer,
  home: (p?: Profile) => void,
  /** A new room's game, picked on the home screen; the host sets it on the first lobby. */
  game?: Game,
) {
  if (!code) {
    try {
      code = (await api<{ code: string }>('/api/rooms', { method: 'POST' })).code
    } catch {
      return toast('No game server reachable. Solo workout still works.', 'bad')
    }
  }
  sessionStorage.setItem('zombiebus.code', code)
  rememberBus(profile.id, code)
  const net = new WsClient(code)
  let lobby: Lobby | null = null
  let ride: BusRide | null = null
  let inResults = false
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
    net.send({ t: 'erg', on: settings.busErg })
  }
  const leave = () => {
    setBack(null)
    net.close()
    ride?.abort()
    sessionStorage.removeItem('zombiebus.code')
    forgetBus(profile.id)
    home(profile)
  }

  const view = lobbyView({
    profile: () => profile,
    status,
    setup: (plan, minutes) => net.send({ t: 'setup', plan, minutes }),
    erg: (on) => {
      saveSettings({ busErg: on })
      net.send({ t: 'erg', on })
    },
    tier: (tier) => {
      profile.tier = tier
      saveProfile(profile)
      net.send({ t: 'tier', tier })
    },
    bots: (n) => net.send({ t: 'bots', n }),
    difficulty: (level) => net.send({ t: 'difficulty', level }),
    trainers: (mode) => net.send({ t: 'trainers', mode }),
    game: (game) => net.send({ t: 'game', game }),
    start: () => net.send({ t: 'start' }),
    leave,
  })
  const renderLobby = (l: Lobby) => {
    view.update(l)
    if (view.isConnected) return
    show(view)
    setBack(backOut)
  }
  // Back in the lobby asks first, and keeps asking if the answer is no.
  const backOut = () => (confirm('Leave the lobby?') ? leave() : setBack(backOut))

  net.onMsg = (m: ServerMsg) => {
    if (m.t === 'lobby') {
      if (m.kind === 'road') {
        // The code is a group ride, not a bus: the free-ride flow takes it from here.
        net.close()
        sessionStorage.removeItem('zombiebus.code')
        return void groupRide(code, null, profile, trainer, home)
      }
      if (game && m.host === profile.id && m.game !== game) net.send({ t: 'game', game })
      game = undefined
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
          '↻ Ride again with this crew',
          undefined,
          undefined,
          (p) => ((profile = p), leave()),
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
