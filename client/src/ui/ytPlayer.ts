import type { Local, Step } from '../core/watchSync'

// The bits of YouTube's IFrame Player API we use (https://developers.google.com/youtube/iframe_api_reference).
interface YtPlayer {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void
  cueVideoById(o: { videoId: string; startSeconds?: number }): void
  playVideo(): void
  pauseVideo(): void
  seekTo(s: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getPlayerState(): number
  getVideoData?(): { title?: string }
  destroy(): void
}
interface YtNs {
  Player: new (el: HTMLElement, o: Record<string, unknown>) => YtPlayer
}
declare global {
  interface Window {
    YT?: YtNs
    onYouTubeIframeAPIReady?: () => void
  }
}

let api: Promise<YtNs> | null = null
/** Loads YouTube's player script once. */
function loadApi(): Promise<YtNs> {
  api ??= new Promise((ok) => {
    if (window.YT?.Player) return ok(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => (prev?.(), ok(window.YT!))
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.append(s)
  })
  return api
}

/** Error codes 101 and 150: the owner does not allow the video to be played in other sites. */
export const NOT_EMBEDDABLE = [101, 150]

/**
 * A YouTube player in `host` that follows sync steps. `onError` gets YouTube's error code (2 bad id, 5 player error,
 * 100 removed or private, 101/150 embedding not allowed).
 */
export function ytPlayer(host: HTMLElement, onError: (code: number) => void = () => {}) {
  let p: YtPlayer | null = null
  let vid: string | null = null
  const slot = document.createElement('div')
  host.append(slot)
  void loadApi().then((YT) => {
    p = new YT.Player(slot, {
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onError: (e: { data: number }) => onError(e.data) },
    })
  })
  return {
    /** Null until the player is ready. */
    local(): Local | null {
      if (!p?.getPlayerState) return null
      return { vid, state: p.getPlayerState(), time: p.getCurrentTime() }
    },
    /** The loaded video's title, once YouTube knows it. */
    title: () => p?.getVideoData?.()?.title || null,
    apply(s: Step) {
      if (!p || !s) return
      if (s.k === 'load') {
        vid = s.vid
        const o = { videoId: s.vid, startSeconds: s.at }
        if (s.play) p.loadVideoById(o)
        else p.cueVideoById(o)
      } else if (s.k === 'seek') p.seekTo(s.at, true)
      else if (s.k === 'play') p.playVideo()
      else p.pauseVideo()
    },
    dispose() {
      p?.destroy()
      host.replaceChildren()
    },
  }
}
