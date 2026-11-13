import { PerfMon } from '../perfMon'
import type { RouteWorld } from './routeWorld'

/** Starts a world's frame-time monitor and returns a reader for the overlay: frame times, draw calls, triangles, builds. */
export function watchPerf(world: RouteWorld) {
  const perf = (world.perf ??= new PerfMon())
  world.chunks.onBuild = (ms) => perf.build(ms)
  return () => ({
    ...perf.stats(),
    calls: world.renderer.info.render.calls,
    triangles: world.renderer.info.render.triangles,
    level: world.quality.level,
    chunks: world.chunks.count,
  })
}

/** Where the next thing of a sort is after `d` metres (optionally of one kind), for the harness. */
export function nextThing(world: RouteWorld, sort: string, d: number, kind?: string) {
  if (sort === 'life') return world.lifePlan.next(d, kind)?.d
  const map = (world.things as Record<string, Map<number, { d: number }[]> | undefined>)[sort]
  if (map)
    return [...map.values()]
      .flat()
      .map((t) => t.d)
      .filter((t) => t > d)
      .sort((x, y) => x - y)[0]
  for (let at = d, n = 0; n < 400; n++) {
    const o = sort === 'odd' ? world.odd.next(at) : undefined
    if (!o || !kind || o.kind === kind) return o?.d
    at = o.d
  }
  return undefined
}
