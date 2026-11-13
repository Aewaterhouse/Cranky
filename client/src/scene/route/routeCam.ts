import type * as THREE from 'three'
import { clamp } from '../math'
import { VIS } from '../params'
import type { HeightField } from './heightField'
import { camRoll, fovKick, shakeAmount } from './riderPose'
import { newPose, type Pose } from './roadPath'

const R = VIS.route
const C = R.feel.cam
/** How much of the rider's sideways offset the camera follows, and the eye height of the aim point. */
const SIDE_FOLLOW = 0.6
const AIM_UP = 1.1
const JUMP_M = 60
/** The camera never trails its spot by more than this, however fast the rider or slow the frame rate. */
const LAG_MAX_M = 4

/** The rider the camera follows: pose at `d`, and what they are up to. */
export interface CamSubject {
  me: Pose
  meD: number
  meOffset: number
  meSpeed: number
  meLean: number
  meTuck: number
}

/**
 * Chase camera for the road: sits on the road behind the rider (so it is never inside a cut bank), aims part-way
 * to a point up the road so it looks into corners, and tilts with the gradient because that point rises or falls.
 * On top of that, unless `feel.cam.calm` is set: the view widens with speed, it drops in behind a tucked rider,
 * rolls a little into bends, shakes a touch on fast descents and takes gradient changes gently.
 */
export class RouteCam {
  /** The route is a closed circuit ridden lap after lap. */
  loop = false
  private x = 0
  private y = 0
  private z = 0
  private lx = 0
  private ly = 0
  private lz = 0
  private rise = 0
  private roll = 0
  private tuck = 0
  private fov = R.fov
  private back = newPose()
  private ahead = newPose()

  /** `t` is the scene clock; `ox, oy, oz` is the floating origin taken off before drawing. */
  update(
    cam: THREE.PerspectiveCamera,
    field: HeightField,
    who: CamSubject,
    dt: number,
    t: number,
    ox: number,
    oy: number,
    oz: number,
  ) {
    const { me, meD: d, meOffset: offset, meSpeed: speed } = who
    const fancy = C.calm ? 0 : 1
    this.tuck += (who.meTuck * fancy - this.tuck) * clamp(dt * 2)
    // On a circuit the road behind the start is the end of the lap, and the road past the end is the start.
    const len = field.path.length
    const on = (x: number) => (this.loop ? ((x % len) + len) % len : x)
    const b = field.path.poseAt(on(d - R.camBack * (1 - C.tuckIn * this.tuck)), this.back)
    const a = field.path.poseAt(on(d + R.camLook), this.ahead)
    const side = offset * SIDE_FOLLOW + R.camSide
    const rx = me.x + me.rx * offset
    const rz = me.z + me.rz * offset
    // Look less far up the road the more it doubles back, so a hairpin never swings the rider out of shot.
    const ux = rx - this.x
    const uz = rz - this.z
    const vx = a.x - rx
    const vz = a.z - rz
    const cos = (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1)
    const m = R.camAim * clamp((cos + 0.3) / 0.8)
    // Snap rather than fly when the rider has jumped (the first frame, a rejoin, the harness).
    const jumped = Math.hypot(b.x - this.x, b.y - this.y, b.z - this.z) > JUMP_M
    const k = jumped ? 1 : 1 - Math.exp(-dt * R.camStiff)
    const tx = b.x + b.rx * side
    const tz = b.z + b.rz * side
    this.x += (tx - this.x) * k
    this.y += (b.y + R.camHeight - C.tuckDown * this.tuck - this.y) * k
    this.z += (tz - this.z) * k
    const lag = Math.hypot(tx - this.x, tz - this.z)
    if (lag > LAG_MAX_M) {
      this.x = tx + ((this.x - tx) * LAG_MAX_M) / lag
      this.z = tz + ((this.z - tz) * LAG_MAX_M) / lag
    }
    // How far the aim rises or falls with the road ahead is eased on its own, so a ramp tips the view gently.
    this.rise += ((a.y - me.y) * m - this.rise) * (jumped || !fancy ? 1 : clamp(dt * C.pitchStiff))
    const ax = rx + (a.x + a.rx * side - rx) * m
    const az = rz + (a.z + a.rz * side - rz) * m
    this.lx += (ax - this.lx) * k
    this.ly += (me.y + this.rise + AIM_UP - this.ly) * k
    this.lz += (az - this.lz) * k
    // The aim is kept as close as the camera is, or a slow frame rate leaves it looking at the road behind.
    const off = Math.hypot(ax - this.lx, az - this.lz)
    if (off > LAG_MAX_M) {
      this.lx = ax + ((this.lx - ax) * LAG_MAX_M) / off
      this.lz = az + ((this.lz - az) * LAG_MAX_M) / off
    }
    this.y = Math.max(this.y, field.ground(this.x, this.z) + R.camClear)
    cam.position.set(this.x - ox, this.y - oy, this.z - oz)
    cam.lookAt(this.lx - ox, this.ly - oy, this.lz - oz)
    // Extras: roll with the rider into the bend, and a small two-tone shake that never moves the aim far.
    const shake = fancy * shakeAmount(speed, me.grade) * VIS.shake
    const w = t * Math.PI * 2 * C.shakeHz
    this.roll += (camRoll(who.meLean) * fancy - this.roll) * clamp(dt * C.leanRate)
    cam.rotateZ(-this.roll + shake * C.shakeRoll * Math.sin(w * 0.7 + 2))
    if (shake) {
      cam.translateX(shake * C.shake * 0.6 * Math.sin(w * 1.3 + 1))
      cam.translateY(shake * C.shake * (Math.sin(w) + 0.5 * Math.sin(w * 1.9 + 0.5)))
    }
    this.fov += (R.fov + fovKick(speed) * fancy - this.fov) * clamp(dt * 4)
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov
      cam.updateProjectionMatrix()
    }
  }
}
