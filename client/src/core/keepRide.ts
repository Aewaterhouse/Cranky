import { CFG } from '../config'
import { dropEfforts, releaseEfforts } from './efforts'
import { dropRide, releaseRide } from './rideQueue'

interface Postable {
  test?: boolean
  noStrava?: boolean
  record: { secs: number }
  power?: number[]
}

/** Whether this ride would go up to Strava by itself once it is saved. */
export const autoPosts = (st: { connected: boolean; auto: boolean } | null, s: Postable) =>
  !!st?.connected &&
  st.auto &&
  !s.test &&
  !s.noStrava &&
  s.record.secs >= CFG.stravaMinSecs &&
  !!s.power?.length

/** What the end-ride confirm asked for, read once by the results screen. */
let onEnd: 'bin' | 'noPost' | null = null
export const endWith = (c: typeof onEnd) => (onEnd = c)
export const endChoice = () => onEnd
export const takeEndChoice = () => {
  const c = onEnd
  onEnd = null
  return c
}

/**
 * A finished ride on the results screen, held on this device until the rider keeps it (leaving the screen, or
 * the Strava countdown running out) or bins it. `countdown` starts when a kept ride would post by itself, and
 * `onTick` hears the seconds left. Kept, the ride and its efforts go to the server, with `noStrava` if the rider
 * said so. Binned, nothing goes anywhere and `restore` puts the profile back.
 */
export function rideKeeper(o: {
  rider: string
  date: string
  /** The ride went into the queue (long enough to save). */
  queued: boolean
  restore: () => void
  onTick?: (left: number) => void
  onKept?: () => void
}) {
  let state: 'open' | 'kept' | 'binned' = 'open'
  let noStrava = false
  let left = CFG.stravaPostDelayS
  let timer: ReturnType<typeof setInterval> | undefined
  const stop = () => (clearInterval(timer), globalThis.removeEventListener?.('pagehide', keep))
  function keep() {
    if (state !== 'open') return
    state = 'kept'
    stop()
    void releaseEfforts(o.rider, o.date)
    if (o.queued) void releaseRide(o.rider, o.date, noStrava ? { noStrava } : {})
    o.onKept?.()
  }
  // Closing the page keeps the ride (it would go up at the next login anyway).
  globalThis.addEventListener?.('pagehide', keep)
  return {
    keep,
    bin() {
      if (state !== 'open') return
      state = 'binned'
      stop()
      dropRide(o.rider, o.date)
      dropEfforts(o.rider, o.date)
      o.restore()
    },
    /** "Don't post to Strava": the countdown stops and the kept ride never uploads by itself. */
    noPost() {
      if (state !== 'open') return
      noStrava = true
      clearInterval(timer)
    },
    countdown() {
      if (state !== 'open' || noStrava || timer) return
      timer = setInterval(() => {
        o.onTick?.(--left)
        if (left <= 0) keep()
      }, 1000)
    },
    state: () => state,
    left: () => left,
  }
}
