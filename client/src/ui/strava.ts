import { api } from '../core/api'
import { h } from './dom'
import { toast } from './toast'
import '../strava.css'

export interface StravaStatus {
  configured: boolean
  connected: boolean
  name: string | null
  auto: boolean
}

/** The rider's Strava connection (never a token), fetched fresh each time. */
export const stravaStatus = () => api<StravaStatus>('/api/strava')

/** Connect with Strava, styled after Strava's brand guidelines (their orange, white text, their words). */
const connectButton = () =>
  h(
    'button',
    {
      class: 'strava-connect',
      onclick: () =>
        api<{ url: string }>('/api/strava/connect', { method: 'POST' }).then(
          (r) => location.assign(r.url),
          (e: Error) => toast(e.message, 'bad'),
        ),
    },
    'Connect with Strava',
  )

/** Rider → Settings: connect once, then every finished ride goes up to Strava by itself. */
export function stravaPanel() {
  const box = h('div', {}, h('p', { class: 'dim' }, 'Loading…'))
  const draw = (s: StravaStatus) => {
    if (!s.configured)
      return box.replaceChildren(
        h('p', { class: 'dim' }, "Strava isn't set up on this server yet."),
      )
    if (!s.connected)
      return box.replaceChildren(
        connectButton(),
        h(
          'p',
          { class: 'dim' },
          'Connect once and every ride you finish goes to Strava as a Virtual Ride. Cranky only uploads; it reads nothing from Strava.',
        ),
        matchMedia('(pointer: coarse)').matches
          ? h(
              'p',
              { class: 'dim' },
              'On an iPad in Bluefy, Strava may open its own app and not come back here. If it does, connect once from Safari or a laptop: the connection is kept on the server, so uploads then work from any browser.',
            )
          : '',
      )
    const auto = h('input', {
      type: 'checkbox',
      checked: s.auto,
      onchange: () =>
        api<StravaStatus>('/api/strava/auto', {
          method: 'PUT',
          body: JSON.stringify({ on: auto.checked }),
        }).then(draw, () => toast("Couldn't change that. Try again.", 'bad')),
    })
    const off = () =>
      api<StravaStatus>('/api/strava/disconnect', { method: 'POST' }).then(
        (st) => (draw(st), toast('Strava disconnected', 'good')),
        () => toast("Couldn't disconnect. Try again.", 'bad'),
      )
    box.replaceChildren(
      h('p', {}, 'Connected as ', h('b', {}, s.name ?? 'your Strava account')),
      h('label', { class: 'strava-auto' }, auto, ' Upload rides automatically'),
      h('button', { class: 'ghost', onclick: off }, 'Disconnect'),
    )
  }
  stravaStatus().then(draw, () =>
    box.replaceChildren(h('p', { class: 'dim' }, "Couldn't reach the server.")),
  )
  return box
}

/** After Strava sends the rider back: a message, and a clean address bar. True if there was one. */
export function stravaReturn() {
  const q = new URLSearchParams(location.search)
  const how = q.get('strava')
  if (!how) return false
  if (how === 'connected') toast('Strava connected. Your rides will upload by themselves.', 'good')
  else toast(q.get('why') || "Strava wasn't connected.", 'bad')
  history.replaceState(null, '', `${location.pathname}#rider`)
  return true
}
