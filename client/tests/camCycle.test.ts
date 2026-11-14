import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/core/settings', () => ({ settings: { camView: 'chase' }, saveSettings: () => {} }))
const { PlayerCam } = await import('../src/scene/playerCam')
const { CAM, CAM_VIEWS } = await import('../src/scene/camVis')

const fakeCanvas = () =>
  ({
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as HTMLElement

/** A world with a moving subject and a chase camera the game places each frame, under one PlayerCam. */
function rig(seats: typeof CAM.bus) {
  const pc = new PlayerCam(fakeCanvas())
  const cam = new THREE.PerspectiveCamera()
  const f = {
    at: new THREE.Vector3(),
    right: new THREE.Vector3(1, 0, 0),
    back: new THREE.Vector3(0, 0, 1),
  }
  const lim = { near: 2, far: 70, ground: () => 0 }
  const look = new THREE.Vector3()
  let x = 0
  /** One frame: the camera's offset from the subject and the way it faces. */
  const frame = () => {
    x += 0.5
    f.at.set(x, 0, 0)
    cam.position.set(x - 1, 3, 9)
    look.set(x, 1.5, -10)
    cam.lookAt(look)
    pc.apply(cam, 1 / 60, f, look, lim, seats, 1.5)
    return {
      off: cam.position.clone().sub(f.at),
      aim: new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion),
    }
  }
  const settle = () => {
    for (let k = 0; k < 240; k++) frame()
    return frame()
  }
  return { pc, frame, settle }
}

type Shot = { off: THREE.Vector3; aim: THREE.Vector3 }
const same = (a: Shot, b: Shot, what: string) => {
  expect(a.off.distanceTo(b.off), what).toBeLessThan(1e-3)
  expect(a.aim.distanceTo(b.aim), what).toBeLessThan(1e-3)
}

describe.each([
  ['free ride', CAM.route],
  ['bus', CAM.bus],
])('camera views (%s)', (_, seats) => {
  it('frame the subject the same way after 20 cycles as on the first', () => {
    const { pc, settle } = rig(seats)
    const first: Record<string, Shot> = {}
    for (let i = 0; i < 20 * CAM_VIEWS.length; i++) {
      const shot = settle()
      if (first[pc.views.view]) same(shot, first[pc.views.view], `${pc.views.view} cycle ${i}`)
      else first[pc.views.view] = shot
      pc.cycle()
    }
    expect(Object.keys(first).sort()).toEqual([...CAM_VIEWS].sort())
  })

  it('come back clean from a turn and zoom, by double tap or by waiting', () => {
    const { pc, frame, settle } = rig(seats)
    const clean: Shot[] = []
    for (let v = 0; v < CAM_VIEWS.length; v++) {
      clean.push(settle())
      pc.orbit.drag(120, -40)
      pc.orbit.zoomBy(1.8)
      frame()
      pc.orbit.snap() // a double tap
      same(frame(), clean.at(-1)!, `${pc.views.view} after a double tap`)
      pc.orbit.drag(-200, 60)
      for (let k = 0; k < (CAM.returnS + CAM.returnEaseS + 1) * 60; k++) frame()
      same(frame(), clean.at(-1)!, `${pc.views.view} after auto-return`)
      pc.cycle()
    }
  })
})
