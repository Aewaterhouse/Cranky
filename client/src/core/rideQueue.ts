import { CFG } from '../config'
import { api } from './api'

/** A finished ride as the server stores it; `record.date` (its start time) is what makes it one ride. */
interface Queued {
  record: { date: string }
}

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

/**
 * Keeps a finished ride on this device until the server has it, then tries to send. A ride finished offline
 * goes up at the next login or when the network comes back (see `flushRides`).
 */
export function postRide<T extends Queued>(rider: string, summary: T) {
  save(rider, [...load(rider), summary].slice(-CFG.rideQueueMax))
  return flushRides(rider)
}

/**
 * Sends queued rides, oldest first. One the server takes (or refuses for good, a 4xx) leaves the queue; the
 * rest wait. The server ignores a ride it already has, so a reply lost on the way does no harm.
 */
export async function flushRides(rider: string) {
  for (const ride of load(rider)) {
    try {
      await api('/api/rides', { method: 'POST', body: JSON.stringify({ summary: ride }) })
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0
      if (status < 400 || status >= 500) return
    }
    save(
      rider,
      load(rider).filter((r) => r.record.date !== ride.record.date),
    )
  }
}
