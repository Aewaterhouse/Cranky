import * as THREE from 'three'
import { CamRig } from './camRig'
import { CAM } from './camVis'
import { Cinema } from './cinema'
import { PlayerCam } from './playerCam'
import type { Strikes } from './strikes'

const LIMITS = { near: CAM.nearBus, ground: () => 0, bus: true }
/** The bus sits at the origin facing -z. */
const FRAME = {
  at: new THREE.Vector3(),
  right: new THREE.Vector3(1, 0, 0),
  back: new THREE.Vector3(0, 0, 1),
}

/**
 * The bus world's camera, in layers: the chase rig, the player's view, orbit and zoom, the gunship's seat, then
 * a streak cinematic over the lot.
 */
export class BusCam {
  rig = new CamRig()
  cine: Cinema
  private pc: PlayerCam
  private ship = false

  constructor(host: HTMLElement, canvas: HTMLElement) {
    this.cine = new Cinema(host)
    this.pc = new PlayerCam(canvas, this.cine.skip)
  }

  /** C or the camera button: skips a cinematic if one is showing, else the next view; returns its name. */
  cycle = () => (this.cine.skip() ? null : this.pc.cycle())

  update(
    cam: THREE.PerspectiveCamera,
    t: number,
    dt: number,
    o: Parameters<CamRig['update']>[3],
    realDt: number,
    strikes: Strikes,
    gunship: boolean,
    hz: number | null,
  ) {
    this.rig.update(cam, t, dt, o)
    this.pc.apply(cam, realDt, FRAME, this.rig.look, LIMITS, CAM.bus, 2)
    strikes.view(cam)
    if (gunship && !this.ship) this.cine.start('gunship')
    this.ship = gunship
    this.cine.apply(cam, realDt, strikes, hz ?? 40)
  }

  dispose() {
    this.pc.dispose()
    this.cine.dispose()
  }
}
