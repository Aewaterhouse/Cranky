import { localBests, rideBests } from '../core/efforts'
import { mateGhost, myGhost, routeBoard, type GhostSpec } from '../core/ghost'
import type { Route } from '../core/route'
import { baseRoute, segClock, wholeId } from '../core/segments'
import { h } from './dom'

/**
 * The ghost choices on the free-ride setup: your own best on the picked route (on by default once there is
 * one) and one mate's best from the crew's times. Empty until the route has been ridden by someone.
 */
export function ghostPick(rider: string) {
  const el = h('span', { class: 'ghost-pick' })
  let route: Route | undefined
  let mine = true
  let mate = ''
  const paint = (board: Awaited<ReturnType<typeof routeBoard>>) => {
    if (!route) return el.replaceChildren()
    const pr = localBests(rider)[wholeId(route)] ?? board.find((r) => r.id === rider)
    const mates = board.filter((r) => r.id !== rider)
    if (!mates.some((r) => r.id === mate)) mate = ''
    const box = h('input', { type: 'checkbox', onchange: () => (mine = box.checked) })
    box.checked = mine
    const pick = h(
      'select',
      { 'aria-label': 'Ride against a mate', onchange: () => (mate = pick.value) },
      h('option', { value: '' }, 'No mate’s ghost'),
      ...mates.map((r) => h('option', { value: r.id }, `◌ ${r.name} ${segClock(r.secs)}`)),
    )
    pick.value = mate
    el.replaceChildren(
      pr
        ? h(
            'label',
            { title: 'Your best rides along as a ghost' },
            box,
            ` ◌ Your PR ${segClock(pr.secs)}`,
          )
        : '',
      mates.length ? pick : '',
    )
  }
  return {
    el,
    /** Shows the choices for `r`: this device's best at once, the crew's when the server answers. */
    set(r: Route | undefined) {
      if (r && route && wholeId(r) === wholeId(route)) return
      route = r
      paint([])
      if (!r) return
      // Reading the route's bests also brings a PR set on another device down to this one.
      rideBests(rider, baseRoute(r).id)
      void routeBoard(r).then((b) => route === r && paint(b))
    },
    /** The chosen ghosts, ready to ride; a mate's is fetched now and left out if it cannot be had. */
    async specs(): Promise<GhostSpec[]> {
      if (!route) return []
      const own = mine ? myGhost(rider, route) : undefined
      const other = mate ? await mateGhost(mate, route) : undefined
      return [own, other].filter((g): g is GhostSpec => !!g)
    },
  }
}
