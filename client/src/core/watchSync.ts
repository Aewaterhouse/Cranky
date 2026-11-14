import { CFG } from '../config'

/** What the server says the room's video is doing: `pos` seconds into `vid` at server time `at`. */
export interface Shared {
  vid: string | null
  playing: boolean
  pos: number
  at: number
}
/** What this rider's player is doing. `state` uses YouTube's numbers: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export interface Local {
  vid: string | null
  state: number
  time: number
}
export type Step =
  | { k: 'load'; vid: string; at: number; play: boolean }
  | { k: 'seek'; at: number }
  | { k: 'play' }
  | { k: 'pause' }
  | null

/** Where the room's video should be at server time `now`. */
export const sharedPos = (s: Shared, now: number) => (s.playing ? s.pos + (now - s.at) : s.pos)

/**
 * One correction for this rider's player, or null when it is close enough. The workout never waits for the video:
 * a player that fell behind (an ad, buffering, a late join) jumps to where everyone else is.
 */
export function syncStep(s: Shared, me: Local, now: number): Step {
  if (!s.vid) return me.vid && me.state === 1 ? { k: 'pause' } : null
  const at = Math.max(0, sharedPos(s, now))
  if (me.vid !== s.vid) return { k: 'load', vid: s.vid, at, play: s.playing }
  // Buffering, or an ad (the player reports buffering or unstarted and the time stands still): leave it be.
  if (me.state === 3 || me.state === -1) return null
  if (!s.playing) {
    if (me.state === 1) return { k: 'pause' }
    return Math.abs(me.time - at) > CFG.watch.driftS ? { k: 'seek', at } : null
  }
  if (me.state === 0) return null
  if (Math.abs(me.time - at) > CFG.watch.driftS) return { k: 'seek', at }
  return me.state === 1 ? null : { k: 'play' }
}

/** A YouTube video id from a pasted link or a bare id; null when it is neither. */
export function videoId(text: string): string | null {
  const t = text.trim()
  if (/^[\w-]{11}$/.test(t)) return t
  try {
    const u = new URL(t)
    if (u.hostname === 'youtu.be') return /^\/([\w-]{11})/.exec(u.pathname)?.[1] ?? null
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) return null
    return (
      u.searchParams.get('v') ??
      /\/(?:embed|shorts|live)\/([\w-]{11})/.exec(u.pathname)?.[1] ??
      null
    )
  } catch {
    return null
  }
}

/**
 * What a watch party can show from a pasted link: a YouTube video id, `tw:<channel>` for a Twitch stream (live, so
 * nobody syncs it) or `url:<link>` for a video file on the web. Null when it is none of these.
 */
export function videoSource(text: string): string | null {
  const yt = videoId(text)
  if (yt) return yt
  try {
    const u = new URL(text.trim())
    if (/(^|\.)twitch\.tv$/.test(u.hostname)) {
      const ch = u.pathname.split('/')[1]
      return /^\w{3,25}$/.test(ch ?? '') ? `tw:${ch}` : null
    }
    if (
      u.protocol === 'https:' &&
      /\.(mp4|webm|ogv|mov)$/i.test(u.pathname) &&
      u.href.length <= 250
    )
      return `url:${u.href}`
  } catch {
    /* not a link */
  }
  return null
}

/** A short name for a source until its title is known. */
export const sourceName = (src: string) =>
  src.startsWith('tw:')
    ? `📡 ${src.slice(3)} on Twitch`
    : src.startsWith('url:')
      ? decodeURIComponent(src.split('/').pop() ?? src)
      : src

/** Session storage key for the watch party's first video, pasted in the lobby and sent as the countdown starts. */
export const FIRST_VIDEO = 'cranky.firstVideo'
