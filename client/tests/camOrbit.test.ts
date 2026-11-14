import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CamOrbit, keepClear } from '../src/scene/camOrbit'
import { CAM } from '../src/scene/camVis'

const flat = { near: CAM.nearBus, ground: () => 0, bus: true }
const pivot = new THREE.Vector3(0, 2, 0)
const look = new THREE.Vector3(0, 2.6, -8)
/** A chase camera behind the bus, as the game leaves it. */
const chase = () => {
  const cam = new THREE.PerspectiveCamera(54, 16 / 9, 0.5, 2000)
  cam.position.set(0, 7.2, 11.5)
  cam.lookAt(look)
  return cam
}
const elev = (c: THREE.Camera) =>
  (Math.atan2(c.position.y - pivot.y, Math.hypot(c.position.x, c.position.z)) * 180) / Math.PI

describe('camera orbit and zoom', () => {
  it('leaves the game camera alone until the player moves it', () => {
    const o = new CamOrbit()
    const cam = chase()
    const before = cam.position.clone()
    o.apply(cam, pivot, look, flat)
    expect(cam.position.equals(before)).toBe(true)
    expect(o.active).toBe(false)
  })

  it('turns round the bus and keeps its distance', () => {
    const o = new CamOrbit()
    const cam = chase()
    const d0 = cam.position.distanceTo(pivot)
    o.drag(300, 0) // 90 degrees
    o.apply(cam, pivot, look, flat)
    expect(cam.position.distanceTo(pivot)).toBeCloseTo(d0, 5)
    expect(Math.abs(cam.position.z)).toBeLessThan(1)
    expect(Math.abs(cam.position.x)).toBeGreaterThan(10)
  })

  it('never goes under the ground or over the top, however far it is dragged', () => {
    for (const dy of [-5000, 5000]) {
      const o = new CamOrbit()
      const cam = chase()
      o.drag(0, dy)
      o.apply(cam, pivot, look, flat)
      expect(elev(cam)).toBeGreaterThanOrEqual(CAM.pitchMin - 1e-6)
      expect(elev(cam)).toBeLessThanOrEqual(CAM.pitchMax + 1e-6)
      expect(cam.position.y).toBeGreaterThanOrEqual(CAM.groundClear)
    }
  })

  it('zooms inside its limits and never closer than the nearest distance', () => {
    const o = new CamOrbit()
    for (let i = 0; i < 50; i++) o.zoomBy(0.5)
    expect(o.zoom).toBe(CAM.zoomMin)
    const cam = chase()
    o.apply(cam, pivot, look, flat)
    expect(cam.position.distanceTo(pivot)).toBeGreaterThanOrEqual(CAM.nearBus - 1e-6)
    for (let i = 0; i < 50; i++) o.zoomBy(2)
    expect(o.zoom).toBe(CAM.zoomMax)
  })

  it('stays out of the bus and above uneven ground', () => {
    const inBus = new THREE.Vector3(0.5, 1, 2)
    keepClear(inBus, flat)
    expect(inBus.y).toBe(CAM.busHalf[1])
    const hill = new THREE.Vector3(3, 0, 3)
    keepClear(hill, { near: 2, ground: () => 12 })
    expect(hill.y).toBe(12 + CAM.groundClear)
  })

  it('pans only in photo mode', () => {
    const o = new CamOrbit()
    o.pan(2, 1)
    expect(o.active).toBe(false)
    o.free = true
    o.pan(2, 1)
    expect([o.panX, o.panY]).toEqual([2, 1])
    o.snap()
    expect(o.active).toBe(false)
  })
})
