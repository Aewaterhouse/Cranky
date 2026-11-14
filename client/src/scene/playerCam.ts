import * as THREE from 'three'
import { bindCamInput } from './camInput'
import { CamOrbit, keepClear, type OrbitLimits } from './camOrbit'
import { CamViews, type SubjectFrame } from './camViews'
import type { CAM } from './camVis'

/**
 * The player's say over a world's camera, laid on top of the game's own camera each frame: the chosen view
 * (Chase, High, Rear, Side), then orbit and zoom from the canvas, easing back after a while with no input.
 * The bus world and the free-ride world each own one.
 */
export class PlayerCam {
  orbit = new CamOrbit()
  views = new CamViews()
  private unbind: () => void
  private aim = new THREE.Vector3()
  private pivot = new THREE.Vector3()

  constructor(canvas: HTMLElement) {
    this.unbind = bindCamInput(canvas, this.orbit, () => false)
  }

  /**
   * Call after the game has placed the camera, aiming at `look`. `f` is the subject's frame, `up` the height
   * of the point the orbit turns round, `seats` the world's views.
   */
  apply(
    cam: THREE.PerspectiveCamera,
    dt: number,
    f: SubjectFrame,
    look: THREE.Vector3,
    lim: OrbitLimits,
    seats: typeof CAM.bus,
    up: number,
  ) {
    this.aim.copy(look)
    this.views.step(dt, seats)
    this.views.place(cam, this.aim, f, (p) => keepClear(p, lim))
    this.orbit.tick(dt)
    this.orbit.apply(cam, this.pivot.copy(f.at).setY(f.at.y + up), this.aim, lim)
  }

  /** The next view; returns its name. */
  cycle() {
    return this.views.cycle()
  }

  dispose() {
    this.unbind()
  }
}
