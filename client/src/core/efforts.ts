import { CFG } from '../config'
import { api } from './api'
import type { Effort } from './segmentTracker'

/** A rider's best go at a segment. */
export interface Best {
  secs: number
  date: string
  watts?: number
  wkg?: number
  /** Its pace (see `Effort.trace`), for live splits and for riding again as a ghost. */
  trace?: number[]
}
/** A row of a segment's crew leaderboard: one rider's best. */
export interface CrewRow extends Best {
  id: string
  name: string
}
/** What a ride knows about a segment before it starts: my best and the best of anyone else. */
export interface SegBest {
  pr?: Best
  crew?: CrewRow
  /** The segment's crew board, fastest first, me included. */
  top?: CrewRow[]
}
export type Bests = Record<string, SegBest>
interface Saved {
  bests: Record<string, Best>
  queue: Effort[]
}

const key = (rider: string) => `${CFG.localStorageKey}.efforts.${rider}`

function load(rider: string): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(key(rider)) ?? 'null') as Saved | null
    if (s?.bests && Array.isArray(s.queue)) return s
  } catch {
    /* fall through */
  }
  return { bests: {}, queue: [] }
}
const save = (rider: string, s: Saved) => {
  try {
    localStorage.setItem(key(rider), JSON.stringify(s))
  } catch {
    /* storage full: the server copy will do */
  }
}

/** This device's copy of the rider's bests, by segment id. */
export const localBests = (rider: string) => load(rider).bests

/** Keeps the efforts on this device (bests, and a queue for the server), then tries to send the queue. */
export function saveEfforts(rider: string, efforts: Effort[]) {
  const s = load(rider)
  for (const e of efforts) {
    const b = s.bests[e.segment]
    const undo = e.rideDate ? held.get(e.rideDate) : undefined
    if (undo && !(e.segment in undo)) undo[e.segment] = b
    if (!b || e.secs < b.secs)
      s.bests[e.segment] = {
        secs: e.secs,
        date: e.date,
        watts: e.watts,
        wkg: e.wkg,
        trace: e.trace,
      }
  }
  s.queue = [...s.queue, ...efforts].slice(-CFG.segments.queueMax)
  save(rider, s)
  return flushEfforts(rider)
}

/** Sends queued efforts; whatever fails stays queued for the next ride or login. The server ignores repeats. */
/** Rides whose efforts stay on this device until the rider keeps the ride, with the bests from before them. */
const held = new Map<string, Record<string, Best | undefined>>()

/** Keeps a ride's efforts from the server until `releaseEfforts` (or `dropEfforts` if the ride is binned). */
export const holdEfforts = (rideDate: string) => void (held.has(rideDate) || held.set(rideDate, {}))

export function releaseEfforts(rider: string, rideDate: string) {
  held.delete(rideDate)
  return flushEfforts(rider)
}

/** Forgets a binned ride's efforts and puts back the bests it beat. */
export function dropEfforts(rider: string, rideDate: string) {
  const undo = held.get(rideDate) ?? {}
  held.delete(rideDate)
  const s = load(rider)
  s.queue = s.queue.filter((e) => e.rideDate !== rideDate)
  for (const [seg, b] of Object.entries(undo))
    if (b) s.bests[seg] = b
    else delete s.bests[seg]
  save(rider, s)
}

export async function flushEfforts(rider: string) {
  const sent = load(rider).queue.filter((e) => !e.rideDate || !held.has(e.rideDate))
  if (!sent.length) return
  try {
    await api('/api/efforts', { method: 'POST', body: JSON.stringify({ efforts: sent }) })
  } catch (e) {
    // A rejected batch (4xx) would never go through, so it is dropped; anything else waits.
    const status = (e as { status?: number }).status ?? 0
    // Not logged in, or still to set a password: keep it for after, never drop it.
    if (status < 400 || status >= 500 || status === 401 || status === 403) return
  }
  const s = load(rider)
  const gone = new Set(sent.map((e) => e.segment + e.date))
  s.queue = s.queue.filter((e) => !gone.has(e.segment + e.date))
  save(rider, s)
}

/**
 * A route's bests for a ride: this device's at once, with the server's (and the crew's) merged in when it
 * answers. A best set during the ride is never replaced by a slower one from the server.
 */
export function rideBests(rider: string, route: string): Bests {
  const out: Bests = {}
  const merge = () => {
    for (const [seg, b] of Object.entries(load(rider).bests)) {
      const o = (out[seg] ??= {})
      if (seg.startsWith(`${route}:`) && (!o.pr || b.secs < o.pr.secs)) o.pr = b
    }
  }
  merge()
  api<{ mine: Record<string, Best>; crew: Record<string, CrewRow[]> }>(
    `/api/efforts?route=${encodeURIComponent(route)}`,
  )
    .then((r) => {
      const s = load(rider)
      for (const [seg, b] of Object.entries(r.mine))
        if (!s.bests[seg] || b.secs < s.bests[seg].secs) s.bests[seg] = b
      save(rider, s)
      merge()
      for (const [seg, rows] of Object.entries(r.crew))
        Object.assign((out[seg] ??= {}), { crew: rows.find((x) => x.id !== rider), top: rows })
    })
    .catch(() => {})
  return out
}
