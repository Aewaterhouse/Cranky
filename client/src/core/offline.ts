/**
 * Which bundled routes this device can ride with no network. The service worker (public/sw.js, production
 * builds only) keeps a copy of everything the app fetches, so a route is available offline once its pack and
 * the 3D world's code have been fetched through it. This file only remembers which routes that is true for.
 */
const KEY = 'cranky.offlineRoutes'

interface Marks {
  /** The app build the marks were made under: a new build may load different files, so its marks start empty. */
  build: string
  ids: string[]
}
type Store = Pick<Storage, 'getItem' | 'setItem'>

/** The route ids marked as saved under this build. */
export function offlineMarks(store: Store, build: string): string[] {
  try {
    const m = JSON.parse(store.getItem(KEY) ?? 'null') as Marks | null
    if (m?.build === build && Array.isArray(m.ids)) return m.ids
  } catch {
    /* fall through */
  }
  return []
}

/** Adds a route to the marks for this build (dropping marks from any other build). */
export function markOffline(store: Store, build: string, id: string) {
  const ids = offlineMarks(store, build)
  if (ids.includes(id)) return
  try {
    store.setItem(KEY, JSON.stringify({ build, ids: [...ids, id] }))
  } catch {
    /* storage full: the route still works offline, it just is not marked */
  }
}

/** This build, as far as the marks care: the address of the app's own script. */
const BUILD = import.meta.url

/** True when a service worker is keeping copies for this page (never in the dev server). */
export const offlineCapable = () =>
  import.meta.env.PROD && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller

export const offlineRoutes = () => (offlineCapable() ? offlineMarks(localStorage, BUILD) : [])

/** Called when a pack has loaded: with the service worker in charge, that fetch has just been kept. */
export function packLoaded(id: string) {
  if (offlineCapable()) markOffline(localStorage, BUILD, id)
}

/**
 * Fetches again, through the service worker, everything this page has already loaded from its own site. The
 * first visit loads the app before the worker is in charge, so without this the shell itself is not kept.
 */
export async function keepShell() {
  const mine = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => u.startsWith(location.origin) && !/\/(api|ws)\//.test(u))
  await Promise.all(
    [location.origin + '/', ...new Set(mine)].map((u) => fetch(u).catch(() => undefined)),
  )
}
