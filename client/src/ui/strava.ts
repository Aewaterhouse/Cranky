import { CFG } from '../config'
import { api } from '../core/api'
import type { Profile } from '../core/curve'
import type { RideSummary } from '../core/ride'
import { postcardCanvas } from './historyDetail'
import type { GroupSummary } from './results'
import { fitBytes } from './rideExport'
import { busCard } from './resultsGroup'
import { ridePostcard, savePng } from './ridePostcard'
import { settings } from '../core/settings'
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

export interface StravaJob {
  status: 'none' | 'queued' | 'processing' | 'done' | 'failed'
  activity: string | null
  error: string | null
}

const base64 = (b: Uint8Array) => {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

const pngOf = async (c: HTMLCanvasElement) => {
  const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'))
  return b ? base64(new Uint8Array(await b.arrayBuffer())) : undefined
}

/**
 * Sends one of my saved rides (number `n` on the server) to Strava: the .fit built here as for a download, and the
 * postcard rebuilt as History rebuilds it, for the ride's public postcard page.
 */
export async function sendToStrava(
  p: Profile,
  s: RideSummary & { group?: GroupSummary },
  n: number,
) {
  const png = await postcardCanvas(p, s)
    .then(pngOf)
    .catch(() => undefined)
  return api<StravaJob>(`/api/strava/upload/${n}`, {
    method: 'POST',
    body: JSON.stringify({ fit: base64(await fitBytes(s)), png }),
  })
}

/** After the server saves a ride: up to Strava by itself when the rider is connected with auto-upload on. */
export async function autoStrava(p: Profile, s: RideSummary, n: number) {
  if (s.record.secs < CFG.stravaMinSecs || !s.power?.length) return
  const st = await stravaStatus().catch(() => null)
  if (st?.connected && st.auto) await sendToStrava(p, s, n).catch(() => {})
}

/**
 * Results screen, once connected: the postcard saved through the download link, so iOS's share sheet can add it
 * to the Strava activity by hand (Strava's API can't attach photos).
 */
export function stravaCardButton(p: Profile, s: RideSummary, group?: GroupSummary, still?: string) {
  const card = () =>
    group
      ? busCard(group, s.planName)
      : ridePostcard(s, p.weightKg || CFG.freeRide.defaultKg, still, settings.units)
  const name = `cranky-strava-${new Date(s.record.date).toLocaleDateString('en-CA')}`
  const b = h(
    'button',
    { hidden: true, onclick: async () => savePng(await card(), name) },
    'Save postcard for Strava',
  )
  stravaStatus().then(
    (st) => (b.hidden = !st.connected),
    () => {},
  )
  return b
}
