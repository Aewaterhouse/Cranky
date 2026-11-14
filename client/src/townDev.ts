import GUI from 'lil-gui'
import { TOWN, TownWorld } from './scene/town/townWorld'
import type { Fuel } from './scene/town/townGeo'

/**
 * Dev page for the Climate Lawsuit town. Params: `level=0..1` sea level, `walls=n`, `riders=1..6`,
 * `fuels=coal,gas,solar,wind` (one per rider, repeating), `debug=1` for the tunables panel.
 */
const q = new URLSearchParams(location.search)
const fuels = (q.get('fuels') ?? 'coal,gas,solar,wind').split(',') as Fuel[]
const world = new TownWorld(document.getElementById('stage')!)
const st = { level: Number(q.get('level') ?? 0), walls: Number(q.get('walls') ?? 0) }
const names = ['Alex', 'Mo', 'Kat', 'Baz', 'Shaz', 'Dazza']
const apply = () =>
  (world.state = {
    ...st,
    riders: names.slice(0, Number(q.get('riders') ?? 4)).map((name, i) => ({
      id: `r${i}`,
      name,
      fuel: fuels[i % fuels.length],
      cadence: 80 + i * 5,
    })),
  })
apply()
if (q.has('debug')) {
  const gui = new GUI()
  gui.add(st, 'level', 0, 1).onChange(apply)
  gui.add(st, 'walls', 0, 3, 1).onChange(apply)
  for (const k of [
    'camHeight',
    'camDist',
    'camSway',
    'fov',
    'seaOpacity',
    'rise',
    'wallStep',
  ] as const)
    gui.add(TOWN, k)
  for (const k of ['sea', 'sky', 'storm'] as const) gui.addColor(TOWN, k)
}
