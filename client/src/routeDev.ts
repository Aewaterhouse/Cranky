import { CFG } from './config'
import { buildRoute, routeAt, type Route } from './core/route'
import { ROUTE_INDEX, loadRoute } from './core/routeLibrary'
import { addFixture } from './routeDevFixture'
import { debugPanel } from './scene/debug'
import { VIS } from './scene/params'
import { CAM } from './scene/camVis'
import { runCamCheck } from './scene/camCheck'
import { nextThing, watchPerf } from './scene/route/worldDev'
import { perfOverlay } from './ui/perfOverlay'
import './perf.css'
import { RouteWorld, type RoadRider } from './scene/route/routeWorld'
import { rideSound } from './ui/rideSound'

/**
 * Route world dev harness. Open /route-dev.html with optional params:
 *   route=<bundled id> (default mount-coot-tha; `nomap` is a made-up climb with no coordinates)
 *   d=<metres along>  speed=<m/s, auto-rides>  cadence=rpm  offset=<metres right of the centreline>
 *   riders=N (extra riders strung out around you)  terrain=0 (ignore the pack's height grid)
 *   fixture=1 (made-up land cover, side streets, houses and landmarks, to try map features without real data)
 *   next=odd|sign|chalk|life (start just before the next oddity, funny sign, chalk or animal after d; kind=roos)  kind=couch (only that kind)  odd=couch (make every oddity a couch; odd=* cycles through every kind)  back=14 (metres before it)
 *   power=0 (coasting; left out, pedalling)  effort=1.5 (share of FTP)  cheer=1 (arms up)  calm=1 (calm camera)
 *   sound=1 (the ride sounds, after a click or key; q for a gear clunk)
 *   mood=routeDawn|route|routeGolden|routeDusk|routeMist|routeShower (default: by the clock, mist up high, showers)
 *   podium=PRIME|POINTS|none (the end-of-race podium at the finish with the first four riders; needs riders=3)
 *   debug=1  hud=0  gfx=potato|low|medium|high  vis.route.camBack=12 (any numeric VIS tunable, dotted path)
 * Keys: , . speed   [ ] jump 500 m back or on   n next oddity   g debug panel   c camera view   q clunk
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
  VIS.route.place.fun.odd.only = q.get('odd') ?? ''
  VIS.route.mood.pick = q.get('mood') ?? 'auto'
  VIS.route.feel.cam.calm = num('calm', 0)
  const id = q.get('route') ?? 'mount-coot-tha'
  const route: Route = id === 'nomap' ? noMap() : await loadRoute(id)
  if (q.get('terrain') === '0') delete route.terrain
  if (q.get('fixture') === '1') addFixture(route)
  const world = new RouteWorld(document.getElementById('stage')!, route)
  const st = { d: num('d', 0), speed: num('speed', 8) }
  const jump = (sort: string) => {
    const at = nextThing(world, sort, st.d + num('back', 14) + 1, q.get('kind') ?? undefined)
    if (at !== undefined) st.d = Math.max(0, at - num('back', 14))
  }
  if (q.has('next')) jump(q.get('next')!)
  const extra = num('riders', 0)
  const riders: RoadRider[] = Array.from({ length: extra + 1 }, (_, i) => ({
    id: `r${i}`,
    name: i ? ['Bec', 'Dazza', 'Mo', 'Kaz', 'Luke'][(i - 1) % 5] : 'Me',
    d: st.d,
    offset: num('offset', VIS.route.lane),
    speed: st.speed,
    cadence: num('cadence', 85) + i * 3,
    power: q.has('power') ? num('power', 0) : undefined,
    effort: q.has('effort') ? num('effort', 0) : undefined,
    cheer: q.get('cheer') === '1',
    look:
      i === 1
        ? { hat: 'hat-viking', outfit: 'outfit-purple' }
        : i
          ? {}
          : { outfit: 'outfit-hivis' },
  }))
  world.state = { me: 'r0', riders }
  Object.assign(window, { world, st, jump, VIS })
  if (q.has('podium')) {
    const sign = q.get('podium')!
    const award = sign === 'none' ? undefined : { who: riders[3] ?? riders[0], sign }
    const { startPodium } = await import('./scene/route/podium')
    startPodium(world, route.distance, riders.slice(0, 3), award, `CRIT · ${route.name}`, () => {})
  }
  if (q.has('camcheck')) setTimeout(() => runCamCheck(world.cam, CAM.route, world, 1800), 6000)

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

  // Sound needs a click or a key first; then it follows the harness.
  let sound: ReturnType<typeof rideSound>
  const hear = () => {
    if (!q.has('sound') || sound) return
    sound = rideSound()
    setInterval(() => {
      sound?.update({
        speed: st.speed,
        coasting: q.get('power') === '0',
        paused: false,
        headwind: num('wind', 0),
        place: world.place(CFG.sound.ride.coastM),
        mood: world.moodName,
      })
    }, 200)
    Object.assign(window, { sound })
  }
  addEventListener('pointerdown', hear)
  addEventListener('keydown', (e) => (hear(), e.key === 'q' && sound?.clunk()))

  const openPanel = () => void debugPanel(() => world.rebuild())
  if (q.has('debug')) openPanel()
  const help = document.getElementById('help')!
  const readPerf = watchPerf(world)
  if (q.get('hud') !== '0') document.body.append(perfOverlay(readPerf).el)
  Object.assign(window, { readPerf })
  if (q.get('hud') === '0') help.classList.add('hide')
  addEventListener('keydown', (e) => {
    if (e.key === ',') st.speed = Math.max(0, st.speed - 2)
    else if (e.key === '.') st.speed += 2
    else if (e.key === '[') st.d = Math.max(0, st.d - 500)
    else if (e.key === ']') st.d = Math.min(route.distance, st.d + 500)
    else if (e.key === 'n') jump(q.get('next') ?? 'odd')
    else if (e.key === 'g') openPanel()
    else if (e.key === 'c') world.cycleView()
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
