import { World, debugPanel, type FxKind, type SceneRider } from './scene/world'
import { VIS } from './scene/params'
import { CAM } from './scene/camVis'
import { runCamCheck } from './scene/camCheck'

/**
 * Scene dev harness. Open /scene-dev.html with optional params:
 *   mood=drill|longhaul|surge|roadblock|servo|finish  gap=0..120 (or none)  armour=0..100 (or none)
 *   speed=m/s  roadblock=0..1  paint=paint-rust  bullbar=1  spikes=1  riders=1..6  debug=1  hud=0
 *   vis.camHeight=5 (any numeric VIS tunable)  gunship=1  mad=1 (VO2 Madness pack)  date=1 (Speed Dating couples)  ambo=1 siren=1 (ambulance)  fx=hit|shake|slowmo|smash|drop|airstrike (fires once after fxAt ms, default 1500)
 * Keys: 1-6 mood, [ ] gap, - = armour, , . speed, r roadblock (hold to approach), h hit, j shake,
 *       k slowmo, m smash, d supply drop, a air strike, u gunship, b bull bar, n spikes, p paint cycle, g toggle debug panel,
 *       c camera view (a, d and u also play the cinematics).
 */
const q = new URLSearchParams(location.search)
const num = (k: string, d: number | null) =>
  q.has(k) ? (q.get(k) === 'none' ? null : Number(q.get(k))) : d
const MOODS = ['drill', 'longhaul', 'surge', 'roadblock', 'servo', 'finish']
const PAINTS = ['', 'paint-rust', 'paint-teal', 'paint-camo', 'paint-black', 'paint-pink']

// vis.camHeight=4 style params override any numeric VIS tunable
for (const [k, v] of q)
  if (k.startsWith('vis.')) (VIS as unknown as Record<string, number>)[k.slice(4)] = Number(v)

const stage = document.getElementById('stage')!
const world = new World(stage)
;(window as unknown as { world: World }).world = world
const st = {
  mood: q.get('mood') ?? 'drill',
  gap: num('gap', 40) as number | null,
  armour: num('armour', 100) as number | null,
  speed: num('speed', 12) as number,
  roadblock: num('roadblock', null) as number | null,
  bullbar: q.get('bullbar') === '1',
  spikes: q.get('spikes') === '1',
  paint: q.get('paint') ?? '',
  riders: Number(q.get('riders') ?? 5),
  gunship: q.get('gunship') === '1',
}
let autoApproach = false

const CREW: SceneRider[] = [
  {
    id: 'a',
    name: 'Alex',
    c: 0.95,
    st: 'riding',
    cadence: 90,
    hr: 171,
    hrp: 0.95,
    look: { hat: q.get('hat1') ?? 'hat-cap', outfit: 'outfit-hivis' },
  },
  {
    id: 'b',
    name: 'Bec the Great',
    c: 0.7,
    st: 'riding',
    cadence: 82,
    hr: 128,
    hrp: 0.68,
    look: { hat: q.get('hat2') ?? 'hat-viking', outfit: 'outfit-purple' },
  },
  { id: 'c', name: 'Dazza', c: 0.35, st: 'fell', cadence: 0, look: { hat: 'hat-cone' } },
  {
    id: 'd',
    name: 'Mo',
    c: 0.9,
    st: 'riding',
    cadence: 100,
    hr: 158,
    hrp: 0.86,
    look: { hat: q.get('hat3') ?? 'hat-crown', outfit: 'outfit-gold' },
  },
  { id: 'e', name: 'Spec', c: null, st: 'spectator', cadence: 0, look: { outfit: 'outfit-black' } },
  { id: 'f', name: 'Kaz', c: 0.8, st: 'riding', cadence: 76 },
]

function apply() {
  const look = {
    paint: st.paint || undefined,
    bullbar: q.get('bullbarId') ?? (st.bullbar ? 'bullbar' : undefined),
    spikes: q.get('roofId') ?? (st.spikes ? 'spikes' : undefined),
  }
  world.state = {
    speed: st.speed,
    gap: st.gap,
    armour: st.armour,
    mood: st.mood,
    riders: CREW.slice(0, st.riders),
    roadblock: st.roadblock,
    busLook: look,
    gunship: st.gunship,
    mad: q.has('date')
      ? {
          pts: {},
          crown: null,
          lead: null,
          work: true,
          pairs: [
            ['a', 'b', 0.9],
            ['d', 'f', 0.25],
          ],
        }
      : q.has('mad')
        ? { pts: { a: 320, b: 140, c: 20, d: 260, f: 90 }, crown: 'a', lead: 'a', work: true }
        : null,
    ambo: q.has('ambo')
      ? { siren: q.get('siren') === '1', dist: num('dist', null), fell: q.has('fell') }
      : null,
  }
}
apply()

const fire = (k: FxKind) => world.fx(k)
if (q.has('camcheck')) setTimeout(() => runCamCheck(world.cam.pc, CAM.bus, world), 1500)
if (q.has('fx')) setTimeout(() => fire(q.get('fx') as FxKind), num('fxAt', 1500) ?? 1500)
if (q.has('debug')) void debugPanel()
const help = document.getElementById('help')!
if (q.get('hud') === '0') help.classList.add('hide')

addEventListener('keydown', (e) => {
  const n = Number(e.key)
  if (n >= 1 && n <= 6) st.mood = MOODS[n - 1]
  else if (e.key === '[') st.gap = Math.max(0, (st.gap ?? 0) - 5)
  else if (e.key === ']') st.gap = Math.min(120, (st.gap ?? 0) + 5)
  else if (e.key === '\\') st.gap = st.gap === null ? 30 : null
  else if (e.key === '-') st.armour = Math.max(0, (st.armour ?? 100) - 10)
  else if (e.key === '=') st.armour = Math.min(100, (st.armour ?? 100) + 10)
  else if (e.key === ',') st.speed = Math.max(0, st.speed - 2)
  else if (e.key === '.') st.speed += 2
  else if (e.key === 'r') {
    st.roadblock = st.roadblock === null ? 0 : null
    autoApproach = st.roadblock !== null
  } else if (e.key === 'h') fire('hit')
  else if (e.key === 'j') fire('shake')
  else if (e.key === 'k') fire('slowmo')
  else if (e.key === 'm') fire('smash')
  else if (e.key === 'd') fire('drop')
  else if (e.key === 'a') fire('airstrike')
  else if (e.key === 'u') st.gunship = !st.gunship
  else if (e.key === 'b') st.bullbar = !st.bullbar
  else if (e.key === 'n') st.spikes = !st.spikes
  else if (e.key === 'p') st.paint = PAINTS[(PAINTS.indexOf(st.paint) + 1) % PAINTS.length]
  else if (e.key === 'g') void debugPanel()
  else if (e.key === 'c') world.cycleView()
  else return
  apply()
})

setInterval(() => {
  if (autoApproach && st.roadblock !== null) {
    st.roadblock = Math.min(1, st.roadblock + 0.02)
    if (st.roadblock >= 1) autoApproach = false
    apply()
  }
}, 100)
setInterval(() => {
  help.textContent = `mood ${st.mood} | gap ${st.gap ?? 'none'} | armour ${st.armour ?? 'none'} | speed ${st.speed} | roadblock ${st.roadblock?.toFixed(2) ?? 'none'} | keys: 1-6 mood [ ] gap \\ horde - = armour , . speed r roadblock h hit j shake k slowmo m smash d drop a airstrike u gunship b bullbar n spikes p paint g panel (fog ${VIS.fogNear})`
}, 300)
