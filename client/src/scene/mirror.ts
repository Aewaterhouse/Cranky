import * as THREE from 'three'
import { VIS } from './params'

/**
 * A rear-view mirror: a second camera on the back of the bus looking down the road behind, drawn into a strip at
 * the top of the screen with a DOM frame, so the horde stays in sight however far back it is.
 */
export class Mirror {
  readonly camera = new THREE.PerspectiveCamera(24, 3, 0.5, 700)
  private frame: HTMLElement

  constructor(host: HTMLElement) {
    this.frame = document.createElement('div')
    this.frame.style.cssText =
      'position:absolute;pointer-events:none;border:3px solid #26282e;border-radius:10px;' +
      'box-shadow:0 0 0 2px #0008,0 6px 18px #0008'
    this.frame.hidden = true
    host.append(this.frame)
  }

  /** Draws the mirror when `on`, else hides its frame. Call after the main render. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, on: boolean) {
    this.frame.hidden = !(on && VIS.mirror)
    if (this.frame.hidden) return
    const size = renderer.getSize(new THREE.Vector2())
    const w = Math.round(size.x * VIS.mirrorW)
    const h = Math.round(w / 3)
    const x = Math.round((size.x - w) / 2)
    const top = Math.round(size.y * VIS.mirrorY)
    Object.assign(this.frame.style, {
      left: `${x}px`,
      top: `${top}px`,
      width: `${w}px`,
      height: `${h}px`,
    })
    this.camera.position.set(0, VIS.mirrorHeight, 6)
    this.camera.lookAt(0, 1.2, 40)
    renderer.setScissorTest(true)
    renderer.setScissor(x, size.y - top - h, w, h)
    renderer.setViewport(x, size.y - top - h, w, h)
    renderer.render(scene, this.camera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, size.x, size.y)
  }

  dispose() {
    this.frame.remove()
  }
}
