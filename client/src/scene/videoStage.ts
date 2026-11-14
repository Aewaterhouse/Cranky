import { syncStep, type Shared } from '../core/watchSync'
import type { WatchState } from '../net/protocol'
import { ytPlayer, NOT_EMBEDDABLE } from '../ui/ytPlayer'
import type { SceneState } from './world'

/**
 * The watch party's stage: a YouTube player filling the screen behind the HUD, kept on the room's position. It takes
 * the same state as the 3D world; times are ride time, carried forward between ticks by the local clock.
 */
export function videoStage(
  host: HTMLElement,
  onError: (text: string) => void,
  onTitle: (vid: string, title: string) => void = () => {},
) {
  const box = document.createElement('div')
  box.className = 'video-stage'
  host.append(box)
  const yt = ytPlayer(box, (c) =>
    onError(
      NOT_EMBEDDABLE.includes(c)
        ? 'That video’s owner does not allow it to be played outside YouTube. Try another.'
        : c === 100
          ? 'That video is private or has been removed.'
          : `YouTube could not play that video (error ${c}).`,
    ),
  )
  let room: Shared = { vid: null, playing: false, pos: 0, at: 0 }
  let el = 0
  let seen = performance.now()
  const now = () => el + (performance.now() - seen) / 1000
  // Browsers block a video starting with sound until the page has been tapped; after a few refused plays, ask.
  const tap = document.createElement('button')
  tap.className = 'video-tap primary'
  tap.textContent = '▶ Tap to start the video'
  tap.hidden = true
  tap.onclick = () => (yt.apply({ k: 'play' }), (tap.hidden = true), (refused = 0))
  host.append(tap)
  let refused = 0
  const told = new Set<string>()
  const timer = setInterval(() => {
    const me = yt.local()
    if (!me) return
    const step = syncStep(room, me, now())
    refused = step?.k === 'play' ? refused + 1 : me.state === 1 ? 0 : refused
    tap.hidden = refused < 6
    const t = me.vid && room.vid === me.vid && !told.has(me.vid) ? yt.title() : null
    if (t && me.vid) {
      told.add(me.vid)
      onTitle(me.vid, t)
    }
    yt.apply(step)
  }, 500)
  return {
    set state(s: SceneState & { el?: number }) {
      const g = s.game as unknown as WatchState | null | undefined
      if (g?.g !== 'watch') return
      room = { vid: g.vid, playing: g.playing, pos: g.pos, at: g.at }
      yt.duck(!!s.duck)
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
      box.remove()
      tap.remove()
    },
  }
}
