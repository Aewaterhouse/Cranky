import * as THREE from 'three'
import { CAM } from './camVis'

const RAD = Math.PI / 180
const smooth = (k: number) => k * k * (3 - 2 * k)
const v = new THREE.Vector3()
const r = new THREE.Vector3()
const u = new THREE.Vector3()

/** Where the orbit may put the camera: no nearer than `near`, never under `ground`, and (on the bus) not inside it. */
export interface OrbitLimits {
  near: number
  ground: (x: number, z: number) => number
  bus?: boolean
}

/**
 * The player's own turn of the camera on top of whatever the game is showing: a yaw and pitch round the subject,
 * a zoom, and (in photo mode) a pan. With no input for `CAM.returnS` it eases back to nothing, unless `free`.
 */
export class CamOrbit {
  yaw = 0
  pitch = 0
  zoom = 1
  panX = 0
  panY = 0
  /** Seconds since the last camera input. */
  idle = Infinity
  /** Photo mode: no auto-return, and panning allowed. */
  free = false
  private from: number[] | null = null
  private back = 0

  get active() {
    return (
      this.yaw !== 0 || this.pitch !== 0 || this.zoom !== 1 || this.panX !== 0 || this.panY !== 0
    )
  }
  private touch() {
    this.idle = 0
    this.from = null
  }
  /** A drag of `dx, dy` pixels: right turns the camera round to the left, down lifts it. */
  drag(dx: number, dy: number) {
    this.yaw -= dx * CAM.dragDeg
    this.pitch = Math.max(-90, Math.min(90, this.pitch + dy * CAM.dragDeg))
    this.touch()
  }
  /** Multiplies the distance by `f`, inside the zoom limits. */
  zoomBy(f: number) {
    this.zoom = Math.min(CAM.zoomMax, Math.max(CAM.zoomMin, this.zoom * f))
    this.touch()
  }
  /** Photo mode only: slides the subject point `dx` right and `dy` up, in metres. */
  pan(dx: number, dy: number) {
    if (!this.free) return
    this.panX += dx
    this.panY += dy
    this.touch()
  }
  /** Straight back to the game's own view. */
  snap() {
    this.yaw = this.pitch = this.panX = this.panY = 0
    this.zoom = 1
    this.from = null
  }
  /** Counts idle time and, after `CAM.returnS`, eases the offsets back to nothing over `CAM.returnEaseS`. */
  tick(dt: number) {
    this.idle += dt
    if (this.free || this.idle < CAM.returnS || !this.active) return
    if (!this.from) {
      this.from = [this.yaw, this.pitch, this.zoom, this.panX, this.panY]
      this.back = 0
    }
    this.back = Math.min(1, this.back + dt / CAM.returnEaseS)
    const k = 1 - smooth(this.back)
    const [y, p, z, x, h] = this.from
    if (this.back >= 1) return this.snap()
    this.yaw = y * k
    this.pitch = p * k
    this.zoom = 1 + (z - 1) * k
    this.panX = x * k
    this.panY = h * k
  }

  /**
   * Turns the camera (placed by the game, aiming at `look`) round `pivot` by the offsets, inside the limits.
   * Does nothing while there are no offsets, so the game's camera is untouched.
   */
  apply(cam: THREE.PerspectiveCamera, pivot: THREE.Vector3, look: THREE.Vector3, lim: OrbitLimits) {
    if (!this.active) return
    cam.updateMatrixWorld()
    r.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize()
    u.set(0, 1, 0)
    const p = pivot.clone().addScaledVector(r, this.panX).addScaledVector(u, this.panY)
    v.copy(cam.position).sub(pivot)
    const flat = Math.hypot(v.x, v.z)
    const elev = Math.atan2(v.y, flat) / RAD
    const az = Math.atan2(v.x, v.z) + this.yaw * RAD
    const el = Math.min(CAM.pitchMax, Math.max(CAM.pitchMin, elev + this.pitch)) * RAD
    const dist = Math.max(lim.near, v.length() * this.zoom)
    cam.position.set(
      p.x + Math.sin(az) * Math.cos(el) * dist,
      p.y + Math.sin(el) * dist,
      p.z + Math.cos(az) * Math.cos(el) * dist,
    )
    keepClear(cam.position, lim)
    const a = look
      .clone()
      .sub(pivot)
      .applyAxisAngle(u, this.yaw * RAD)
      .add(p)
    cam.lookAt(a)
  }
}

/** Lifts `pos` clear of the ground, and on the bus out of the bus's box onto its roof. */
export function keepClear(pos: THREE.Vector3, lim: OrbitLimits) {
  pos.y = Math.max(pos.y, lim.ground(pos.x, pos.z) + CAM.groundClear)
  const [hx, hy, hz] = CAM.busHalf
  if (lim.bus && Math.abs(pos.x) < hx && Math.abs(pos.z) < hz && pos.y < hy) pos.y = hy
}
