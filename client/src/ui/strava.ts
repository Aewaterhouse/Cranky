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

/** Strava's own artwork, unchanged (their API brand guidelines; see public/assets/CREDITS.md). */
const ART = '/assets/strava'

/** "Compatible with Strava", wherever Strava is named or its data shows. */
export const stravaMark = () =>
  h('img', {
    class: 'strava-mark',
    src: `${ART}/api_logo_cptblWith_strava_horiz_white.svg`,
    alt: 'Compatible with Strava',
    width: 437,
    height: 37,
  })

/** Strava's Connect with Strava button at its own 48 px height. */
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
    h('img', {
      src: `${ART}/btn_strava_connect_with_orange.svg`,
      alt: 'Connect with Strava',
      width: 237,
      height: 48,
    }),
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
        stravaMark(),
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
      stravaMark(),
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
    'span',
    { class: 'strava-save', hidden: true },
    h('button', { onclick: async () => savePng(await card(), name) }, 'Save postcard for Strava'),
    stravaMark(),
  )
  stravaStatus().then(
    (st) => (b.hidden = !st.connected),
    () => {},
  )
  return b
}

/** My uploads by ride number, and whether I'm connected (History). */
export const stravaRides = () =>
  api<{ connected: boolean; rides: Record<string, StravaJob> }>('/api/strava/rides')

const activityLink = (id: string) =>
  h(
    'a',
    {
      class: 'strava-link',
      href: `https://www.strava.com/activities/${id}`,
      target: '_blank',
      rel: 'noopener',
    },
    'View on Strava',
  )

/** History list: a ride's Strava status in a word (the actions are in the ride itself). */
export function stravaTag(j?: StravaJob) {
  if (!j || j.status === 'none') return ''
  const [cls, text] =
    j.status === 'done'
      ? ['done', 'Strava']
      : j.status === 'failed'
        ? ['failed', 'Strava: retry']
        : ['busy', 'Uploading']
  return h('em', { class: `strava-tag ${cls}` }, text)
}

/**
 * One ride in History: on Strava with a link, uploading (checked again every few seconds), failed with Retry, or
 * Upload for a ride from before connecting. Nothing when Strava isn't connected.
 */
export function stravaRow(p: Profile, s: RideSummary, n: number) {
  const row = h('div', { class: 'strava-row' })
  const box = h('span')
  const send = () => {
    box.replaceChildren(h('span', { class: 'dim' }, 'Sending to Strava…'))
    sendToStrava(p, s, n).then(draw, (e: Error) => {
      toast(e.message || "Couldn't send that to Strava", 'bad')
      refresh()
    })
  }
  const draw = (j?: StravaJob) => {
    if (!j || j.status === 'none')
      return box.replaceChildren(
        s.record.secs >= CFG.stravaMinSecs && s.power?.length
          ? h('button', { onclick: send }, 'Upload to Strava')
          : '',
      )
    if (j.status === 'done')
      return box.replaceChildren(
        j.activity ? activityLink(j.activity) : h('span', { class: 'dim' }, 'On Strava'),
      )
    if (j.status === 'failed')
      return box.replaceChildren(
        h('span', { class: 'dim' }, `Strava upload failed${j.error ? `: ${j.error}` : ''}. `),
        h('button', { onclick: send }, 'Retry'),
      )
    box.replaceChildren(h('span', { class: 'dim' }, 'Uploading to Strava…'))
    setTimeout(() => box.isConnected && refresh(), CFG.stravaPollMs)
  }
  const refresh = () =>
    stravaRides().then(
      (r) =>
        r.connected
          ? (draw(r.rides[n]), row.replaceChildren(box, stravaMark()))
          : row.replaceChildren(),
      () => {},
    )
  refresh()
  return row
}
