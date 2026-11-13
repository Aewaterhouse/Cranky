import type * as THREE from 'three'
import { clamp } from '../math'
import { VIS } from '../params'
import type { HeightField } from './heightField'
import { newPose, type Pose } from './roadPath'

const R = VIS.route
/** How much of the rider's sideways offset the camera follows, eye height of the aim point, and the speed FOV kick. */
const SIDE_FOLLOW = 0.6
const AIM_UP = 1.1
const KICK_DEG = 5
const KICK_AT = 18
const JUMP_M = 60
/** The camera never trails its spot by more than this, however fast the rider or slow the frame rate. */
const LAG_MAX_M = 4

/**
 * Chase camera for the road: sits on the road behind the rider (so it is never inside a cut bank), aims part-way
 * to a point up the road so it looks into corners, and tilts with the gradient because that point rises or falls.
 */
export class RouteCam {
  private x = 0
  private y = 0
  private z = 0
  private lx = 0
  private ly = 0
  private lz = 0
  private fov = R.fov
  private back = newPose()
  private ahead = newPose()

  /** `me` is the rider's pose at `d`; `ox, oy, oz` is the floating origin taken off before drawing. */
  update(
    cam: THREE.PerspectiveCamera,
    field: HeightField,
    me: Pose,
    d: number,
    offset: number,
    speed: number,
    dt: number,
    ox: number,
    oy: number,
    oz: number,
  ) {
    const b = field.path.poseAt(d - R.camBack, this.back)
    const a = field.path.poseAt(d + R.camLook, this.ahead)
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
    this.y += (b.y + R.camHeight - this.y) * k
    this.z += (tz - this.z) * k
    const lag = Math.hypot(tx - this.x, tz - this.z)
    if (lag > LAG_MAX_M) {
      this.x = tx + ((this.x - tx) * LAG_MAX_M) / lag
      this.z = tz + ((this.z - tz) * LAG_MAX_M) / lag
    }
    this.lx += (rx + (a.x + a.rx * side - rx) * m - this.lx) * k
    this.ly += (me.y + (a.y - me.y) * m + AIM_UP - this.ly) * k
    this.lz += (rz + (a.z + a.rz * side - rz) * m - this.lz) * k
    this.y = Math.max(this.y, field.ground(this.x, this.z) + R.camClear)
    cam.position.set(this.x - ox, this.y - oy, this.z - oz)
    cam.lookAt(this.lx - ox, this.ly - oy, this.lz - oz)
    this.fov += (R.fov + clamp(speed / KICK_AT) * KICK_DEG - this.fov) * clamp(dt * 4)
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov
      cam.updateProjectionMatrix()
    }
  }
}
