import type * as THREE from 'three'
import { bindCamInput } from './camInput'
import { CamOrbit, type OrbitLimits } from './camOrbit'

/**
 * The player's say over a world's camera, laid on top of the game's own camera each frame: orbit and zoom from
 * the canvas, easing back after a while with no input. The bus world and the free-ride world each own one.
 */
export class PlayerCam {
  orbit = new CamOrbit()
  private unbind: () => void

  constructor(canvas: HTMLElement) {
    this.unbind = bindCamInput(canvas, this.orbit, () => false)
  }

  /** Call after the game has placed the camera; `pivot` is the subject, `look` where the game aims. */
  apply(
    cam: THREE.PerspectiveCamera,
    dt: number,
    pivot: THREE.Vector3,
    look: THREE.Vector3,
    lim: OrbitLimits,
  ) {
    this.orbit.tick(dt)
    this.orbit.apply(cam, pivot, look, lim)
  }

  dispose() {
    this.unbind()
  }
}
