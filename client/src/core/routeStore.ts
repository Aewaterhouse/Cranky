import type { Route } from './route'

const KEY = 'cranky.myRoutes'

/** Imported routes live in this browser only. */
export function myRoutes(): Route[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Saves an imported route; returns false when the browser refuses (storage full). */
export function saveMyRoute(r: Route): boolean {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([...myRoutes().filter((x) => x.id !== r.id), { ...r, terrain: undefined }]),
    )
    return true
  } catch {
    return false
  }
}

export function removeMyRoute(id: string) {
  localStorage.setItem(KEY, JSON.stringify(myRoutes().filter((x) => x.id !== id)))
}
