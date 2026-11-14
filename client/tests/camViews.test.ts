import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSettings, settings } from '../src/core/settings'
import { CamViews, nextView } from '../src/scene/camViews'
import { CAM } from '../src/scene/camVis'
import { VIS } from '../src/scene/params'

const frame = {
  at: new THREE.Vector3(),
  right: new THREE.Vector3(1, 0, 0),
  back: new THREE.Vector3(0, 0, 1),
}
const run = (v: CamViews, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) v.step(1 / 60, CAM.bus)
}

describe('camera views', () => {
  // Settings are saved to the browser: stand in for its storage and the page.
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    })
    const el = { style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {} } }
    vi.stubGlobal('document', { documentElement: el })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })
  it('cycles Chase, High, Rear, Side and round again', () => {
    expect((['chase', 'high', 'rear', 'side'] as const).map(nextView)).toEqual([
      'high',
      'rear',
      'side',
      'chase',
    ])
    expect(nextView('side')).toBe('chase')
  })

  it('remembers the chosen view for the next ride', () => {
    saveSettings({ camView: 'chase' })
    const v = new CamViews()
    expect(v.cycle()).toBe('high')
    expect(settings.camView).toBe('high')
    expect(new CamViews().view).toBe('high')
    saveSettings({ camView: 'chase' })
  })

  it('blends in over the blend time and leaves the chase camera alone', () => {
    saveSettings({ camView: 'chase' })
    const v = new CamViews()
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(0, 7, 11)
    const look = new THREE.Vector3(0, 2, -8)
    v.place(cam, look, frame, () => {})
    expect(cam.position.toArray()).toEqual([0, 7, 11])
    v.cycle()
    run(v, CAM.blendS / 4)
    expect(v.w).toBeGreaterThan(0)
    expect(v.w).toBeLessThan(1)
    run(v, CAM.blendS * 3)
    expect(v.w).toBeGreaterThan(0.99)
    v.place(cam, look, frame, () => {})
    const s = CAM.bus.high
    expect(cam.position.distanceTo(new THREE.Vector3(s.ex, s.ey, s.ez))).toBeLessThan(1)
    saveSettings({ camView: 'chase' })
  })

  it('High keeps the bus and 60 m of road behind it in shot', () => {
    const s = CAM.bus.high
    const cam = new THREE.PerspectiveCamera(54, 16 / 9, 0.5, 2000)
    cam.position.set(s.ex, s.ey, s.ez)
    cam.lookAt(s.lx, s.ly, s.lz)
    // The bus world shifts its picture up to clear the HUD cockpit; the bus must clear the top too.
    cam.setViewOffset(1600, 900, 0, 900 * VIS.viewShift, 1600, 900)
    cam.updateMatrixWorld()
    const seen = (z: number) => {
      const p = new THREE.Vector3(0, 0, z).project(cam)
      return Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.85 && p.z < 1
    }
    for (const z of [-5, 0, 6, 30, 60]) expect(seen(z)).toBe(true)
  })
})
