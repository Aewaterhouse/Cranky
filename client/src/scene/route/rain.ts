import * as THREE from 'three'
import { hash } from '../math'
import { MOOD } from './routeMoods'

/** `v` moved by whole boxes of side `b` until it is within half a box of `c`. */
const wrap = (v: number, c: number, b: number) => c + ((((v - c) % b) + b * 1.5) % b) - b / 2

/** A passing shower: a box of streaks that follows the camera, each falling and wrapping round. No allocation per frame. */
export class Rain {
  readonly lines: THREE.LineSegments
  private pos: Float32Array
  private amount = 0

  constructor() {
    this.pos = new Float32Array(MOOD.drops * 6)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    const mat = new THREE.LineBasicMaterial({ color: MOOD.rainTint, transparent: true, opacity: 0 })
    this.lines = new THREE.LineSegments(geo, mat)
    this.lines.frustumCulled = false
    this.lines.visible = false
  }

  /** `on` fades the rain in or out; `cam` is where the box is centred; `t` the scene clock. */
  update(on: boolean, cam: THREE.Vector3, t: number, dt: number) {
    this.amount = Math.min(1, Math.max(0, this.amount + (on ? dt : -dt) * 0.5))
    this.lines.visible = this.amount > 0
    if (!this.lines.visible) return
    const mat = this.lines.material as THREE.LineBasicMaterial
    mat.opacity = this.amount * 0.55
    mat.color.set(MOOD.rainTint)
    const B = MOOD.rainBox
    const p = this.pos
    for (let i = 0; i < MOOD.drops; i++) {
      const x = wrap(hash(i) * B, cam.x, B)
      const z = wrap(hash(i + 0.37) * B, cam.z, B)
      const y = wrap(hash(i + 0.71) * B - t * MOOD.rainMs * (0.8 + hash(i * 1.9) * 0.4), cam.y, B)
      p[i * 6] = x
      p[i * 6 + 1] = y
      p[i * 6 + 2] = p[i * 6 + 5] = z
      p[i * 6 + 3] = x + MOOD.rainLean * MOOD.rainLen
      p[i * 6 + 4] = y + MOOD.rainLen
    }
    this.lines.geometry.attributes.position.needsUpdate = true
  }

  dispose() {
    this.lines.geometry.dispose()
    ;(this.lines.material as THREE.Material).dispose()
  }
}
