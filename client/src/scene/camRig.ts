import * as THREE from 'three'
import { VIS } from './params'
import { clamp, smooth } from './util'

/** Chase camera: sway, shake, speed FOV kick, and a pull-back when the horde is close. */
export class CamRig {
  pull = 0
  shake = 0
  private fov = VIS.fov

  update(
    cam: THREE.PerspectiveCamera,
    t: number,
    dt: number,
    o: { speed: number; gap: number | null; hit: number; slow: boolean },
  ) {
    const want = o.gap === null ? 0 : 1 - smooth(5, 45, o.gap)
    this.pull += (want - this.pull) * clamp(dt * 1.5)
    const sway = VIS.sway
    this.shake = Math.max(0, this.shake - dt * 1.6)
    const sh = this.shake * this.shake * VIS.shake
    const nx = Math.sin(t * 47) * 0.6 + Math.sin(t * 83 + 1) * 0.4
    const ny = Math.sin(t * 59 + 2) * 0.6 + Math.sin(t * 97) * 0.4
    cam.position.set(
      VIS.camSide +
        Math.sin(t * 0.25) * 1.6 * sway +
        nx * sh * 0.35 +
        Math.sin(t * 0.13) * 0.8 * sway,
      VIS.camHeight + this.pull * 4 + Math.sin(t * 0.4) * 0.25 * sway + ny * sh * 0.3,
      VIS.camDist + this.pull * 7 + Math.sin(t * 0.17) * 0.6 * sway - o.hit * 0.8,
    )
    cam.lookAt(0, 2.6 - this.pull * 0.4, VIS.camLook + this.pull * 6)
    cam.rotateZ(nx * sh * 0.012 + Math.sin(t * 0.3) * 0.012 * sway)
    const fov = VIS.fov + clamp(o.speed / 20) * VIS.fovKick * 20 + o.hit * 3 + (o.slow ? -4 : 0)
    this.fov += (fov - this.fov) * clamp(dt * 4)
    cam.fov = this.fov
    cam.updateProjectionMatrix()
  }
}
