import { CFG } from '../config'
import type { Local, Step } from '../core/watchSync'

/** A plain video file in a `<video>` element, with the same face as the YouTube player so the room can sync it. */
export function htmlPlayer(host: HTMLElement, onError: (text: string) => void) {
  const v = document.createElement('video')
  v.playsInline = true
  v.style.cssText = 'width:100%;height:100%;background:#000'
  v.onerror = () =>
    onError('That video file would not play. It may need a different link or format.')
  host.append(v)
  let src: string | null = null
  let ducked = false
  let restore = 1
  const state = () => (v.ended ? 0 : v.readyState < 3 ? (src ? 3 : -1) : v.paused ? 2 : 1)
  return {
    el: v,
    local: (): Local => ({ vid: src, state: state(), time: v.currentTime }),
    apply(s: Step) {
      if (!s) return
      if (s.k === 'load') {
        src = s.vid
        v.src = s.vid.slice(4)
        v.currentTime = s.at
        if (s.play) void v.play().catch(() => {})
      } else if (s.k === 'seek') v.currentTime = s.at
      else if (s.k === 'play') void v.play().catch(() => {})
      else v.pause()
    },
    duck(on: boolean) {
      if (on === ducked) return
      if (on) restore = v.volume
      v.volume = on ? Math.min(restore, CFG.watch.duckVolume / 100) : restore
      ducked = on
    },
    title: () => null,
    dispose: () => v.remove(),
  }
}
