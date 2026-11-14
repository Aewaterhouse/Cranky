import * as THREE from 'three'
import { settings } from '../core/settings'
import { CAM } from './camVis'
import { CineClock, type CineKind } from './cineClock'
import type { Strikes } from './strikes'
import './cinema.css'

const eye = new THREE.Vector3()
const aim = new THREE.Vector3()
const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const up = new THREE.Vector3(0, 1, 0)

/**
 * Streak-reward cinematics on the bus: the camera follows the air strike's jet in and holds on the blast, or
 * watches the supply crate fall onto the road from low at the roadside; letterbox bars and a title over the
 * picture (under the HUD, so the power cockpit stays in view). The gunship keeps its own view and gets only the
 * bars and title. A press on the 3D view or C skips; the Cinematics setting turns them off.
 */
export class Cinema {
  clock = new CineClock()
  private el: HTMLElement
  private title: HTMLElement
  private boom = -1
  private last = new THREE.Vector3()
  private look = new THREE.Vector3()

  constructor(host: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'cine'
    this.el.innerHTML = '<i></i><i></i><b></b>'
    this.title = this.el.querySelector('b')!
    host.append(this.el)
  }

  start(kind: CineKind) {
    if (this.clock.start(kind, settings.cinematics)) this.boom = -1
  }
  /** Skips the shot showing; false when there was none. */
  skip = () => this.clock.skip()

  /** Call last, after every other camera move; `hz` is where the horde is. */
  apply(cam: THREE.PerspectiveCamera, dt: number, strikes: Strikes, hz: number) {
    const kind = this.clock.kind
    const s = this.clock.step(dt)
    this.el.style.setProperty('--bars', String(s.bars * CAM.barH * 100))
    this.el.classList.toggle('on', s.bars > 0)
    if (this.title.textContent !== s.title) this.title.textContent = s.title
    if (!s.cam || !kind) return
    if (kind === 'airstrike') this.strike(strikes.jetAt, hz)
    else this.drop(strikes.crateAt)
    cam.position.lerp(eye, s.cam)
    q.setFromRotationMatrix(m.lookAt(eye, aim, up))
    cam.quaternion.slerp(q, s.cam)
  }

  /** Ride behind the jet until it reaches the horde, then hold off to the side on the blast. */
  private strike(jet: THREE.Vector3 | null, hz: number) {
    if (jet && jet.z < hz - 10) {
      const [x, y, z] = CAM.jetSeat
      eye.set(jet.x + x, jet.y + y, jet.z + z)
      aim.set(jet.x, jet.y - 0.5, jet.z + 25)
      this.last.copy(eye)
      this.look.copy(aim)
      return
    }
    if (this.boom < 0) this.boom = this.clock.t
    const k = Math.min(1, (this.clock.t - this.boom) / 0.8)
    const [x, y, z] = CAM.blastSeat
    eye.set(x, y, hz + z).lerp(this.last, 1 - k * k * (3 - 2 * k))
    aim.set(0, 2, hz + 4).lerp(this.look, 1 - k)
  }

  /** Low at the roadside ahead of the bus, watching the crate down and the bus through it. */
  private drop(crate: THREE.Vector3 | null) {
    const [x, y, z] = CAM.dropSeat
    eye.set(x, y, z)
    if (crate) this.look.copy(crate)
    else this.look.lerp(aim.set(0, 1.5, -5), 0.1)
    aim.copy(this.look)
  }

  dispose() {
    this.el.remove()
  }
}
