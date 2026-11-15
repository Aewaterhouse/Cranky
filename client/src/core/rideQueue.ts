import { CFG } from '../config'
import { api } from './api'

/** A finished ride as the server stores it; `record.date` (its start time) is what makes it one ride. */
interface Queued {
  record: { date: string }
}

let onSaved: ((ride: Queued, id: number) => void) | undefined
/** Called with each ride the server has just taken from the queue, and its number there (Strava uploads). */
export const onRideSaved = <T extends Queued>(f: (ride: T, id: number) => void) =>
  (onSaved = f as (ride: Queued, id: number) => void)

const key = (rider: string) => `${CFG.localStorageKey}.rides.${rider}`

function load(rider: string): Queued[] {
  try {
    const q = JSON.parse(localStorage.getItem(key(rider)) ?? '[]') as unknown
    if (Array.isArray(q)) return q as Queued[]
  } catch {
    /* fall through */
  }
  return []
}

/** Writes the queue, dropping the oldest rides until it fits in what storage is left. */
function save(rider: string, q: Queued[]) {
  for (let from = 0; from <= q.length; from++)
    try {
      return localStorage.setItem(key(rider), JSON.stringify(q.slice(from)))
    } catch {
      /* storage full: try again without the oldest */
    }
}

/** Rides waiting for the server on this device. */
export const queuedRides = (rider: string) => load(rider).length

/** The rides themselves, oldest first. */
export const queuedList = <T extends Queued>(rider: string) => load(rider) as T[]

/**
 * Keeps a finished ride on this device until the server has it, then tries to send. A ride finished offline
 * goes up at the next login or when the network comes back (see `flushRides`).
 */
export function postRide<T extends Queued>(rider: string, summary: T, hold = false) {
  if (hold) held.add(summary.record.date)
  save(rider, [...load(rider), summary].slice(-CFG.rideQueueMax))
  return flushRides(rider)
}

/**
 * Rides kept on this device but not sent yet (the results screen, until the rider keeps or bins it). Held in memory
 * only, so a ride whose page closed goes up at the next flush.
 */
const held = new Set<string>()

/** Lets a held ride go to the server, with `patch` (such as `noStrava`) applied first. */
export function releaseRide(rider: string, date: string, patch: object = {}) {
  held.delete(date)
  save(
    rider,
    load(rider).map((r) => (r.record.date === date ? { ...r, ...patch } : r)),
  )
  return flushRides(rider)
}

/** Forgets a held ride for good: it never reaches the server. */
export function dropRide(rider: string, date: string) {
  held.delete(date)
  save(
    rider,
    load(rider).filter((r) => r.record.date !== date),
  )
}

/**
 * Sends queued rides, oldest first. One the server takes (or refuses for good, a 4xx) leaves the queue; the
 * rest wait. The server ignores a ride it already has, so a reply lost on the way does no harm.
 */
export async function flushRides(rider: string) {
  for (const ride of load(rider)) {
    if (held.has(ride.record.date)) continue
    try {
      const r = await api<{ id?: number }>('/api/rides', {
        method: 'POST',
        body: JSON.stringify({ summary: ride }),
      })
      if (r.id) onSaved?.(ride, r.id)
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0
      // Not logged in, or still to set a password: keep it for after, never drop it.
      if (status < 400 || status >= 500 || status === 401 || status === 403) return
    }
    save(
      rider,
      load(rider).filter((r) => r.record.date !== ride.record.date),
    )
  }
}
