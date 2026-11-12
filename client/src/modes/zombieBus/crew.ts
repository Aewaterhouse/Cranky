import { PLANS } from '../../content'
import type { Profile } from '../../core/curve'
import { planTotal } from '../../core/plan'
import { saveProfile } from '../../core/profile'
import type { Lobby, ServerMsg } from '../../net/protocol'
import { WsClient } from '../../net/wsClient'
import { fmt, h, show } from '../../ui/dom'
import { DURATIONS } from '../../ui/home'
import { finishRide } from '../../ui/results'
import { TIERS, type Tier, type Trainer } from '../../types'
import { startBusRide, type BusRide } from './zombieBus'

/** Crew session: lobby, ride and results over one WebSocket. */
export async function crew(code: string | null, profile: Profile, trainer: Trainer, home: (p?: Profile) => void) {
  if (!code) {
    try {
      code = (await (await fetch('/api/rooms', { method: 'POST' })).json()).code as string
    } catch {
      return alert('No game server reachable. Solo drill still works.')
    }
  }
  sessionStorage.setItem('zombiebus.code', code)
  const net = new WsClient(code, profile.id)
  let lobby: Lobby | null = null
  let ride: BusRide | null = null
  let inResults = false
  const status = h('span', { class: 'dim' }, 'connecting…')
  net.onStatus = (up) => (status.textContent = up ? '' : 'reconnecting…')
  net.onOpen = () => net.send({ t: 'join', name: profile.name, ftp: profile.ftp, tier: profile.tier })
  const leave = () => {
    net.close()
    ride?.abort()
    sessionStorage.removeItem('zombiebus.code')
    home(profile)
  }

  net.onMsg = (m: ServerMsg) => {
    if (m.t === 'lobby') {
      lobby = m
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
      s.then((summary) =>
        finishRide(profile, summary, (p) => {
          profile = p
          inResults = false
          if (lobby) renderLobby(lobby)
        }, m.summary, 'Back to the bus'),
      )
    } else if (m.t === 'error') {
      if (/No bus/.test(m.msg)) {
        alert(m.msg)
        leave()
      } else ride ? ride.toast(m.msg) : alert(m.msg)
    }
  }

  function renderLobby(l: Lobby) {
    const isHost = l.host === profile.id
    const link = `${location.origin}/?join=${l.code}`
    const tier = h('select', { onchange: (e: Event) => {
      profile.tier = (e.target as HTMLSelectElement).value as Tier
      saveProfile(profile)
      net.send({ t: 'tier', tier: profile.tier })
    } }, ...TIERS.map((t) => h('option', { value: t, selected: t === profile.tier }, t)))
    const plan = h('select', {}, ...PLANS.map((p) => h('option', { value: p.id, selected: p.id === l.plan.id }, p.name)))
    const mins = h('select', {}, ...DURATIONS.map((m) => h('option', { value: m, selected: m === l.minutes }, m ? `${m} min` : 'As written')))
    const setup = () => net.send({ t: 'setup', plan: plan.value, minutes: +mins.value })
    plan.addEventListener('change', setup)
    mins.addEventListener('change', setup)
    const blocks = l.plan.blocks
    show(h('div', { class: 'page' },
      h('h1', {}, 'Bus lobby ', status),
      h('div', { class: 'card' }, h('div', { class: 'dim' }, 'Bus code'), h('div', { class: 'code' }, l.code),
        h('div', { class: 'row' }, h('input', { value: link, readOnly: true, style: 'flex:1', onclick: (e: Event) => (e.target as HTMLInputElement).select() }),
          h('button', { onclick: () => navigator.clipboard?.writeText(link) }, 'Copy link'))),
      h('div', { class: 'card' }, h('h2', {}, `Crew (${l.riders.length}/6)`),
        ...l.riders.map((r) => h('div', { class: 'rr' }, `${r.connected ? '🟢' : '⚪'} ${r.name}${r.id === l.host ? ' (driver)' : ''} · ${r.tier} · FTP ${r.ftp}`))),
      h('div', { class: 'card' }, h('h2', {}, 'The run'),
        isHost ? h('div', { class: 'row' }, plan, mins) : h('p', {}, `${l.plan.name}${l.minutes ? ` · ${l.minutes} min` : ''}`),
        h('p', { class: 'dim' }, `${l.plan.name} · ${fmt(planTotal(blocks))} · ${blocks.filter((b) => b.type === 'sprint').length} roadblocks · ${l.plan.desc ?? ''}`),
        h('div', { class: 'row' }, h('label', { class: 'field' }, 'Your tier', tier),
          isHost ? h('button', { class: 'primary', onclick: () => net.send({ t: 'start' }) }, 'Start the bus') : h('span', { class: 'dim' }, 'Waiting for the driver to start…'),
          h('button', { class: 'ghost', onclick: leave }, 'Leave'))),
    ))
  }
}
