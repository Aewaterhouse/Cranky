import { h } from './dom'

const KEY = 'cranky.media'

/** Turns a pasted YouTube link (video or playlist) or Twitch channel into an embeddable URL. */
export function embedUrl(input: string, host = location.hostname): string | null {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return null
  }
  const yt = 'https://www.youtube-nocookie.com/embed'
  const list = u.searchParams.get('list')
  if (u.hostname === 'youtu.be') return `${yt}/${u.pathname.slice(1)}?autoplay=1`
  if (/(^|\.)youtube\.com$/.test(u.hostname)) {
    const id =
      u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1]
    if (id) return `${yt}/${id}?autoplay=1${list ? `&list=${list}` : ''}`
    if (list) return `${yt}/videoseries?list=${list}&autoplay=1`
  }
  if (/(^|\.)twitch\.tv$/.test(u.hostname) && u.pathname.length > 1)
    return `https://player.twitch.tv/?channel=${u.pathname.split('/')[1]}&parent=${host}`
  return null
}

/** A small video corner for the solo player: paste a link, watch while you ride. */
export function mediaCorner() {
  const frame = h('div', { class: 'media-frame' })
  const url = h('input', {
    placeholder: 'Paste a YouTube or Twitch link',
    value: localStorage.getItem(KEY) ?? '',
  })
  const note = h('span', { class: 'dim' })
  const play = (e?: Event) => {
    e?.preventDefault()
    const src = embedUrl(url.value)
    note.textContent = src ? '' : 'That link is not one I can embed.'
    if (!src) return
    localStorage.setItem(KEY, url.value)
    frame.replaceChildren(
      h('iframe', {
        src,
        allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
        allowFullscreen: true,
      }),
    )
  }
  // Keys typed here must not pause or skip the workout.
  url.addEventListener('keydown', (e) => e.stopPropagation())
  const panel = h(
    'aside',
    { class: 'media', hidden: true },
    h(
      'form',
      { onsubmit: play },
      url,
      h('button', {}, 'Play'),
      h('button', { type: 'button', onclick: () => frame.replaceChildren() }, 'Stop'),
    ),
    note,
    frame,
  )
  const big = h('button', { type: 'button', onclick: () => panel.classList.toggle('big') }, 'Size')
  panel.firstElementChild!.append(big)
  const button = h('button', { onclick: () => (panel.hidden = !panel.hidden) }, 'Media')
  return { button, panel }
}
