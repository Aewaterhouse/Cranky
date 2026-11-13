import { CFG } from '../config'
import { api, type Me } from './api'
import { newProfile, type Profile } from './curve'

const key = (id: string) => `${CFG.localStorageKey}.${id}`

/** Local cache for this account, falling back to a fresh profile. */
export function loadProfile(u: Me): Profile {
  try {
    const s = localStorage.getItem(key(u.id))
    if (s) return { ...newProfile(u.id), ...JSON.parse(s), id: u.id, name: u.name }
  } catch {
    /* fall through */
  }
  return newProfile(u.id, u.name)
}

/** Saves locally and pushes to the server. */
export function saveProfile(p: Profile) {
  p.updated = Date.now()
  localStorage.setItem(key(p.id), JSON.stringify(p))
  api(`/api/profile/${p.id}`, { method: 'PUT', body: JSON.stringify(p) }).catch(() => {})
}

/** Pulls the server copy; newer wins. */
export async function syncProfile(p: Profile): Promise<Profile> {
  try {
    const s = await api<Profile>(`/api/profile/${p.id}`)
    if (s.updated > p.updated) {
      const merged = { ...newProfile(p.id), ...s, name: p.name }
      localStorage.setItem(key(p.id), JSON.stringify(merged))
      return merged
    }
    saveProfile(p)
  } catch (e) {
    if ((e as { status?: number }).status === 404) saveProfile(p)
  }
  return p
}
