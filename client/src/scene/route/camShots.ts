import type * as THREE from 'three'
import { clamp, lerp } from '../math'
import { VIS } from '../params'
import { hairpins } from './furniture'
import type { HeightField } from './heightField'
import { newPose } from './roadPath'
import type { CamSubject } from './routeCam'

const R = VIS.route

/** A camera move that takes over from the chase camera until it is over (the flyover, a summit flourish). */
export interface CamShot {
  /** Metres along the road the shot is about: the world builds and lights around here. */
  d: number
  /** Places the camera (`ox, oy, oz` is the floating origin); true once the shot is over. */
  update(
    cam: THREE.PerspectiveCamera,
    field: HeightField,
    who: CamSubject,
    ox: number,
    oy: number,
    oz: number,
  ): boolean
}

const ease = (k: number) => k * k * (3 - 2 * k)

/**
 * A shot's own clock, 0..1 over `secs`. It starts on the second frame (the first one builds the scenery) and
 * a slow frame counts for at most `maxStepS`, so a struggling device sees the whole move, only slower.
 */
class ShotClock {
  private t = 0
  private last = 0
  constructor(
    private secs: number,
    private onStart?: () => void,
  ) {}
  step() {
    const now = performance.now()
    if (this.last) this.t += Math.min(R.fly.maxStepS, (now - this.last) / 1000)
    else setTimeout(() => this.onStart?.())
    this.last = now
    return clamp(this.t / this.secs)
  }
}

/** The pre-ride flyover: a sweep along `from`..`to`, starting high and wide and coming down to the road. */
export class FlyShot implements CamShot {
  d: number
  private clock: ShotClock
  private at = newPose()
  private look = newPose()

  /** `onStart` is called once the first frame of the stretch has been drawn. */
  constructor(
    private from: number,
    private to: number,
    secs: number,
    onStart?: () => void,
  ) {
    this.d = from
    this.clock = new ShotClock(secs, onStart)
  }

  update(
    cam: THREE.PerspectiveCamera,
    field: HeightField,
    _who: CamSubject,
    ox: number,
    oy: number,
    oz: number,
  ) {
    const F = R.fly
    const k = this.clock.step()
    const e = ease(k)
    const len = field.path.length
    this.d = lerp(this.from, this.to, e)
    const p = field.path.poseAt(clamp(this.d - F.backM, 0, len), this.at)
    const a = field.path.poseAt(clamp(this.d + F.lookM, 0, len), this.look)
    const side = lerp(F.sideM, F.sideEndM, e)
    const x = p.x + p.rx * side
    const z = p.z + p.rz * side
    const y = Math.max(p.y + lerp(F.highM, F.lowM, e), field.ground(x, z) + F.clearM)
    cam.position.set(x - ox, y - oy, z - oz)
    cam.lookAt(a.x - ox, a.y + 1 - oy, a.z - oz)
    return k >= 1
  }
}

/** A flourish at the summit or the finish: once round the rider and back in behind. */
export class OrbitShot implements CamShot {
  d = 0
  private clock: ShotClock

  constructor(secs: number) {
    this.clock = new ShotClock(secs)
  }

  update(
    cam: THREE.PerspectiveCamera,
    field: HeightField,
    who: CamSubject,
    ox: number,
    oy: number,
    oz: number,
  ) {
    const O = R.orbit
    const k = this.clock.step()
    const me = who.me
    this.d = who.meD
    // Starts and ends where the chase camera sits, so neither cut is seen; widest in front of the rider.
    const ang = ease(k) * Math.PI * 2
    const r = O.radiusM + O.swellM * Math.sin(k * Math.PI)
    const mx = me.x + me.rx * who.meOffset
    const mz = me.z + me.rz * who.meOffset
    const x = mx + (-me.fx * Math.cos(ang) + me.rx * Math.sin(ang)) * r
    const z = mz + (-me.fz * Math.cos(ang) + me.rz * Math.sin(ang)) * r
    const y = Math.max(me.y + O.heightM, field.ground(x, z) + R.camClear)
    cam.position.set(x - ox, y - oy, z - oz)
    cam.lookAt(mx - ox, me.y + O.aimUpM - oy, mz - oz)
    return k >= 1
  }
}

/** Where the hairpins are, in metres along the road, for choosing what the flyover shows. */
export const hairpinsOf = (world: { field: HeightField }) =>
  hairpins(world.field.path).map((h) => h.d)
