import type GUI from 'lil-gui'
import { VIS } from './params'
import { ROUTE_MOODS } from './route/routeMoods'

/** `onRoute` is called when a route-world setting that is baked into the chunks changes. */
export async function debugPanel(onRoute?: () => void) {
  const { default: GUI } = await import('lil-gui')
  const gui = new GUI({ title: 'Visual debug' })
  if (onRoute) routeFolder(gui.addFolder('Route world'), onRoute)
  const cam = gui.addFolder('Camera')
  cam.add(VIS, 'camHeight', 2, 40)
  cam.add(VIS, 'camDist', 5, 60)
  cam.add(VIS, 'camLook', -40, 10)
  cam.add(VIS, 'camSide', -30, 30)
  cam.add(VIS, 'fov', 30, 100)
  cam.add(VIS, 'fovKick', 0, 1)
  cam.add(VIS, 'sway', 0, 3)
  cam.add(VIS, 'shake', 0, 3)
  const air = gui.addFolder('Atmosphere')
  air.add(VIS, 'fogNear', 0, 200)
  air.add(VIS, 'sun', 0, 3)
  air.add(VIS, 'shadow', 0, 1, 1)
  air.add(VIS, 'vignette', 0, 1)
  air.add(VIS, 'moodBlend', 0.2, 6)
  air.add(VIS, 'speedLines', 0, 2)
  gui.add(VIS, 'gapScale', 0.1, 2)
  gui.addColor(VIS, 'busColour')
  for (const [k, m] of Object.entries(VIS.moods)) {
    const f = gui.addFolder(`Mood: ${k}`).close()
    for (const c of ['sky', 'fog', 'light', 'hemi', 'ground', 'hill'] as const) f.addColor(m, c)
    f.add(m, 'sunI', 0, 5)
    f.add(m, 'hemiI', 0, 3)
    f.add(m, 'sunElev', -5, 80)
    f.add(m, 'sunAz', -90, 90)
    f.add(m, 'sunSize', 0.01, 0.2)
    f.add(m, 'head', 0, 1)
    f.add(m, 'stars', 0, 1)
    f.add(m, 'fogFar', 60, 500)
  }
  return gui
}

function routeFolder(f: GUI, rebuild: () => void) {
  const R = VIS.route
  const cam = f.addFolder('Camera')
  cam.add(R, 'camBack', 3, 30)
  cam.add(R, 'camHeight', 1, 15)
  cam.add(R, 'camSide', -6, 6)
  cam.add(R, 'camLook', 5, 60)
  cam.add(R, 'camAim', 0, 1)
  cam.add(R, 'camStiff', 0.5, 12)
  cam.add(R, 'fov', 30, 100)
  f.add(R, 'fogNear', 0, 600)
  f.add(R.mood, 'pick', ['auto', ...ROUTE_MOODS]).name('mood')
  addAll(f.addFolder('weather').close(), R.mood)
  f.add(R, 'skyR', 600, 4000)
  f.add(R, 'skyJag', 0, 300)
  const built = f.addFolder('Road and ground (rebuilds)')
  built.add(R, 'roadHalf', 1, 8)
  built.add(R, 'verge', 0, 6)
  built.add(R, 'lineW', 0.05, 1)
  built.add(R, 'shoulder', 2, 30)
  built.add(R, 'blend', 5, 150)
  built.add(R, 'hillAmp', 0, 300)
  built.add(R, 'hillScale', 50, 800)
  built.add(R, 'snowLine', 0, 2500)
  built.add(R, 'seaLevel', -1, 5)
  built.add(R, 'rockSlope', 0.3, 1)
  for (const k of ['aheadPotato', 'aheadLow', 'aheadMedium', 'aheadHigh'] as const)
    built.add(R, k, 200, 2000, 50)
  for (const k of ['treeline', 'treelineTas', 'alpineBand'] as const) built.add(R, k, 0, 2500, 10)
  for (const k of ['coverJitter', 'waterLift', 'streetLift', 'streetHalf', 'mainHalf'] as const)
    built.add(R, k, 0, 6)
  built.add(R, 'coverNoise', 5, 200)
  built.add(R, 'waterShine', 1, 200)
  built.add(R, 'streetBias', 0, 20)
  for (const k of [
    'tarmac',
    'line',
    'gravel',
    'snow',
    'sea',
    'waterTint',
    'waterGlint',
    'street',
    'mainStreet',
  ] as const)
    built.addColor(R, k)
  for (const k of ['ground', 'signs', 'place'] as const)
    addAll(built.addFolder(k).close(), R[k] as Record<string, unknown>)
  built.onChange(rebuild)
}

/** Every colour, number and nested group of `o`, so new tunables show up without being listed here. */
function addAll(f: GUI, o: Record<string, unknown>) {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.startsWith('#')) f.addColor(o, k)
    else if (typeof v === 'number') f.add(o, k, Math.min(0, v * 4), Math.max(1, Math.abs(v) * 4))
    else if (v && typeof v === 'object' && !Array.isArray(v))
      addAll(f.addFolder(k).close(), v as Record<string, unknown>)
  }
}
