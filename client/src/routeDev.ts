import { buildRoute, routeAt, type Route } from './core/route'
import { ROUTE_INDEX, loadRoute } from './core/routeLibrary'
import { debugPanel } from './scene/debug'
import { VIS } from './scene/params'
import { RouteWorld, type RoadRider } from './scene/route/routeWorld'

/**
 * Route world dev harness. Open /route-dev.html with optional params:
 *   route=<bundled id> (default mount-coot-tha; `nomap` is a made-up climb with no coordinates)
 *   d=<metres along>  speed=<m/s, auto-rides>  cadence=rpm  offset=<metres right of the centreline>
 *   riders=N (extra riders strung out around you)  terrain=0 (ignore the pack's height grid)
 *   debug=1  hud=0  gfx=potato|low|medium|high  vis.route.camBack=12 (any numeric VIS tunable, dotted path)
 * Keys: , . speed   [ ] jump 500 m back or on   g debug panel
 */
const q = new URLSearchParams(location.search)
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)

for (const [k, v] of q) {
  if (!k.startsWith('vis.')) continue
  const keys = k.slice(4).split('.')
  let o = VIS as unknown as Record<string, unknown>
  for (const key of keys.slice(0, -1)) o = o[key] as Record<string, unknown>
  o[keys[keys.length - 1]] = Number(v)
}

/** A climb with no coordinates, like a GPX exported without positions. */
const noMap = () =>
  buildRoute(
    'nomap',
    'No-map climb',
    Array.from({ length: 800 }, (_, i) => ({
      d: i * 10,
      ele: 200 + i * 0.6 + Math.sin(i / 25) * 30,
    })),
  )

async function start() {
  const id = q.get('route') ?? 'mount-coot-tha'
  const route: Route = id === 'nomap' ? noMap() : await loadRoute(id)
  if (q.get('terrain') === '0') delete route.terrain
  const world = new RouteWorld(document.getElementById('stage')!, route)
  const st = { d: num('d', 0), speed: num('speed', 8) }
  const extra = num('riders', 0)
  const riders: RoadRider[] = Array.from({ length: extra + 1 }, (_, i) => ({
    id: `r${i}`,
    name: i ? ['Bec', 'Dazza', 'Mo', 'Kaz', 'Luke'][(i - 1) % 5] : 'Me',
    d: st.d,
    offset: num('offset', VIS.route.lane),
    speed: st.speed,
    cadence: num('cadence', 85) + i * 3,
    look:
      i === 1
        ? { hat: 'hat-viking', outfit: 'outfit-purple' }
        : i
          ? {}
          : { outfit: 'outfit-hivis' },
  }))
  world.state = { me: 'r0', riders }
  Object.assign(window, { world, st })

  let last = performance.now()
  setInterval(() => {
    const now = performance.now()
    st.d = Math.min(route.distance, st.d + (st.speed * (now - last)) / 1000)
    last = now
    riders.forEach((r, i) => {
      // Extras alternate ahead and behind, a bike length or three apart, across the lane.
      const gap = Math.ceil(i / 2) * (i % 2 ? 5 : -2.5)
      r.d = st.d + gap
      r.speed = st.speed
      if (i) r.offset = VIS.route.lane + ((i * 0.9) % 2.5) - 0.6
    })
  }, 50)

  const openPanel = () => void debugPanel(() => world.rebuild())
  if (q.has('debug')) openPanel()
  const help = document.getElementById('help')!
  if (q.get('hud') === '0') help.classList.add('hide')
  addEventListener('keydown', (e) => {
    if (e.key === ',') st.speed = Math.max(0, st.speed - 2)
    else if (e.key === '.') st.speed += 2
    else if (e.key === '[') st.d = Math.max(0, st.d - 500)
    else if (e.key === ']') st.d = Math.min(route.distance, st.d + 500)
    else if (e.key === 'g') openPanel()
  })
  let frames = 0
  const count = () => (frames++, requestAnimationFrame(count))
  count()
  setInterval(() => {
    const p = routeAt(route, st.d)
    help.textContent = `${route.name} (${ROUTE_INDEX.map((r) => r.id).join(' ')} nomap) | d ${Math.round(st.d)} of ${route.distance} m | ${p.ele.toFixed(0)} m, ${p.grade.toFixed(1)}% | speed ${st.speed} m/s | ${frames * 2} fps, ${world.quality.level}, ${world.chunks.count} chunks, last built in ${world.chunks.lastMs.toFixed(1)} ms | terrain ${route.terrain ? 'grid' : 'made up'} | keys: , . speed  [ ] jump  g panel`
    frames = 0
  }, 500)
}
void start()
