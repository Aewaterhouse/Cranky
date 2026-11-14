import { syncStep, type Shared } from '../core/watchSync'
import type { WatchState } from '../net/protocol'
import { htmlPlayer } from '../ui/htmlPlayer'
import { ytPlayer, NOT_EMBEDDABLE } from '../ui/ytPlayer'
import type { SceneState } from './world'

/**
 * The watch party's stage: a YouTube player (or a video file, or a Twitch stream) filling the screen behind the HUD,
 * kept on the room's position. It takes the same state as the 3D world; times are ride time, carried forward between
 * ticks by the local clock. Twitch is live, so it is only shown, never synced.
 */
export function videoStage(
  host: HTMLElement,
  onError: (text: string) => void,
  onTitle: (vid: string, title: string) => void = () => {},
) {
  const box = document.createElement('div')
  box.className = 'video-stage'
  host.append(box)
  // Each source has its own wrapper, so hiding one hides whatever its player put inside (YouTube swaps in an iframe).
  const wrap = (cls: string) => {
    const d = document.createElement('div')
    d.className = cls
    box.append(d)
    return d
  }
  const ytBox = wrap('vs-yt')
  const fileBox = wrap('vs-file')
  const twBox = wrap('vs-tw')
  const yt = ytPlayer(ytBox, (c) =>
    onError(
      NOT_EMBEDDABLE.includes(c)
        ? 'That video’s owner does not allow it to be played outside YouTube. Try another.'
        : c === 100
          ? 'That video is private or has been removed.'
          : `YouTube could not play that video (error ${c}).`,
    ),
  )
  const file = htmlPlayer(fileBox, onError)
  const tw = document.createElement('iframe')
  tw.allow = 'autoplay; fullscreen'
  twBox.append(tw)
  // The room's source picks which player shows; the others sit hidden and idle.
  const kind = (vid: string | null) =>
    vid?.startsWith('tw:') ? 'tw' : vid?.startsWith('url:') ? 'url' : 'yt'
  const show = (k: string) => {
    ytBox.hidden = k !== 'yt'
    fileBox.hidden = k !== 'url'
    twBox.hidden = k !== 'tw'
  }
  show('yt')
  let room: Shared = { vid: null, playing: false, pos: 0, at: 0 }
  let el = 0
  let seen = performance.now()
  const now = () => el + (performance.now() - seen) / 1000
  // Browsers block a video starting with sound until the page has been tapped; after a few refused plays, ask.
  const tap = document.createElement('button')
  tap.className = 'video-tap primary'
  tap.textContent = '▶ Tap to start the video'
  tap.hidden = true
  tap.onclick = () => (player().apply({ k: 'play' }), (tap.hidden = true), (refused = 0))
  host.append(tap)
  let refused = 0
  const told = new Set<string>()
  const player = () => (kind(room.vid) === 'url' ? file : yt)
  const timer = setInterval(() => {
    const k = kind(room.vid)
    show(k)
    if (k === 'tw') {
      const want = `https://player.twitch.tv/?channel=${room.vid!.slice(3)}&parent=${location.hostname}`
      if (tw.src !== want) tw.src = want
      return
    }
    tw.removeAttribute('src')
    const p = player()
    const other = p === yt ? file : yt
    if (other.local()?.state === 1) other.apply({ k: 'pause' })
    const me = p.local()
    if (!me) return
    const step = syncStep(room, me, now())
    refused = step?.k === 'play' ? refused + 1 : me.state === 1 ? 0 : refused
    tap.hidden = refused < 6
    const t = me.vid && room.vid === me.vid && !told.has(me.vid) ? p.title() : null
    if (t && me.vid) {
      told.add(me.vid)
      onTitle(me.vid, t)
    }
    p.apply(step)
  }, 500)
  return {
    set state(s: SceneState & { el?: number }) {
      const g = s.game as unknown as WatchState | null | undefined
      if (g?.g !== 'watch') return
      room = { vid: g.vid, playing: g.playing, pos: g.pos, at: g.at }
      yt.duck(!!s.duck)
      file.duck(!!s.duck)
      if (s.el != null) {
        el = s.el
        seen = performance.now()
      }
    },
    fx() {},
    cycleView: () => null,
    snapshot: () => '',
    dispose() {
      clearInterval(timer)
      yt.dispose()
      file.dispose()
      box.remove()
      tap.remove()
    },
  }
}
