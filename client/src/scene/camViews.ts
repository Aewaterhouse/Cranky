import * as THREE from 'three'
import { saveSettings, settings } from '../core/settings'
import { CAM, CAM_VIEWS, type CamView, type ViewPoint } from './camVis'

/** The view after `v` in Chase, High, Rear, Side order. */
export const nextView = (v: CamView): CamView =>
  CAM_VIEWS[(CAM_VIEWS.indexOf(v) + 1) % CAM_VIEWS.length]
export const VIEW_NAMES: Record<CamView, string> = {
  chase: 'Chase',
  high: 'High',
  rear: 'Rear',
  side: 'Side',
}

/** The subject's frame this frame: its position and its right and backward directions (flat). */
export interface SubjectFrame {
  at: THREE.Vector3
  right: THREE.Vector3
  back: THREE.Vector3
}

const eye = new THREE.Vector3()
const aim = new THREE.Vector3()
const toWorld = (f: SubjectFrame, x: number, y: number, z: number, out: THREE.Vector3) =>
  out
    .copy(f.at)
    .addScaledVector(f.right, x)
    .addScaledVector(f.back, z)
    .setY(f.at.y + y)

/**
 * Chase, High, Rear and Side. Chase is the game's own camera; the others are fixed seats in the subject's frame,
 * blended in and out over `CAM.blendS`. The choice is kept per device in the settings.
 */
export class CamViews {
  view: CamView = CAM_VIEWS.includes(settings.camView) ? settings.camView : 'chase'
  /** 0 is the game's own camera, 1 is fully on the chosen seat. */
  w = this.view === 'chase' ? 0 : 1
  private seat: ViewPoint = { ex: 0, ey: 0, ez: 0, lx: 0, ly: 0, lz: 0 }
  private primed = false

  /** Moves on to the next view and remembers it. */
  cycle() {
    this.view = nextView(this.view)
    saveSettings({ camView: this.view })
    return this.view
  }

  /** Eases the blend and the seat towards the chosen view; `seats` are the world's own (bus or road). */
  step(dt: number, seats: typeof CAM.bus) {
    const k = 1 - Math.exp((-dt * 4) / CAM.blendS)
    this.w += ((this.view === 'chase' ? 0 : 1) - this.w) * k
    if (this.w < 1e-3) this.w = 0
    if (this.view === 'chase') return
    const to = seats[this.view]
    for (const key of Object.keys(to) as (keyof ViewPoint)[])
      this.seat[key] = this.primed ? this.seat[key] + (to[key] - this.seat[key]) * k : to[key]
    this.primed = true
  }

  /**
   * Blends the camera (placed by the game, aiming at `look`) towards the seat, keeping it `clear` above the ground.
   * Updates `look` to the new aim so the orbit turns round the right point.
   */
  place(
    cam: THREE.PerspectiveCamera,
    look: THREE.Vector3,
    f: SubjectFrame,
    clear: (p: THREE.Vector3) => void,
  ) {
    if (this.w <= 0) return
    const s = this.seat
    toWorld(f, s.ex, s.ey, s.ez, eye)
    clear(eye)
    toWorld(f, s.lx, s.ly, s.lz, aim)
    cam.position.lerp(eye, this.w)
    look.lerp(aim, this.w)
    cam.lookAt(look)
  }
}
