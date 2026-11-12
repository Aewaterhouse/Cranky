import { CFG } from '../config'
import { newProfile, type Profile } from './curve'

export function loadProfile(): Profile {
  try {
    const s = localStorage.getItem(CFG.localStorageKey)
    if (s) return { ...newProfile(''), ...JSON.parse(s) }
  } catch {
    /* fall through to a fresh profile */
  }
  return newProfile(crypto.randomUUID())
}

/** Saves locally and pushes to the server when there is one. */
export function saveProfile(p: Profile) {
  p.updated = Date.now()
  localStorage.setItem(CFG.localStorageKey, JSON.stringify(p))
  fetch(`/api/profile/${p.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(p),
  }).catch(() => {})
}

/** Pulls the server copy; newer wins. Works offline (static hosting) by returning the local copy. */
export async function syncProfile(p: Profile): Promise<Profile> {
  try {
    const r = await fetch(`/api/profile/${p.id}`)
    if (r.ok) {
      const s: Profile = await r.json()
      if (s.updated > p.updated) {
        localStorage.setItem(CFG.localStorageKey, JSON.stringify(s))
        return s
      }
      if (p.name) saveProfile(p)
    }
  } catch {
    /* offline */
  }
  return p
}

export function postRide(id: string, summary: unknown) {
  fetch('/api/rides', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, summary }),
  }).catch(() => {})
}
