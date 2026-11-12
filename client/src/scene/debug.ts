import { VIS } from './params'

export async function debugPanel() {
  const { default: GUI } = await import('lil-gui')
  const gui = new GUI({ title: 'Visual debug' })
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
