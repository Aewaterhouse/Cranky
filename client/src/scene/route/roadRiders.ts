import * as THREE from 'three'
import type { Look } from '../../core/cosmetics'
import { clamp } from '../math'
import { makeRider } from '../riders'
import { VIS } from '../params'
import { bendLean, levelPhase, newRoadPose, poseWants, type RoadPose } from './riderPose'
import { newPose, type Pose, type RoadPath } from './roadPath'

const COLOURS = ['#e94f37', '#3f88c5', '#44bba4', '#f6ae2d', '#9b5de5', '#f15bb5']
/** A reported position this far from where we drew the rider is a jump, not drift. */
const SNAP_M = 60
const P = VIS.route.feel.rider
/** Name tags are sized for the bus roof; on the road riders are nearer the camera. */
const TAG_SCALE = 0.55

/** One rider on the road, as every road game reports it. */
export interface RoadRider {
  id: string
  name: string
  /** Metres along the route. */
  d: number
  /** Metres right of the centreline (negative is left). */
  offset: number
  /** m/s */
  speed: number
  cadence: number
  look?: Look
  /** Watts now; left out, the rider is taken to be pedalling. */
  power?: number
  /** Power as a share of the rider's FTP, for getting out of the saddle on hard efforts. */
  effort?: number
  /** Arms up: over the top or at the finish. */
  cheer?: boolean
}

interface Entry {
  id: string
  look?: Look
  r: ReturnType<typeof makeRider>
  d: number
  /** The last reported distance, and how far off it we still are. */
  told: number
  err: number
  phase: number
  seen: boolean
  /** What the rider is heading for (0 or 1 each) and where the pose has eased to. */
  want: RoadPose
  now: RoadPose
}

/** Rider figures placed on the road. Positions arrive a few times a second and are smoothed in between. */
export class RoadRiders {
  group = new THREE.Group()
  /** Where "me" was drawn last frame. */
  readonly me = newPose()
  meD = 0
  meOffset = 0
  meSpeed = 0
  /** How far "me" leans into the bend (positive right) and is tucked (0..1), for the camera. */
  meLean = 0
  meTuck = 0
  private map = new Map<string, Entry>()
  private list: Entry[] = []
  private pose: Pose = newPose()

  constructor(private path: RoadPath) {}

  update(riders: RoadRider[], me: string, dt: number) {
    for (let i = 0; i < this.list.length; i++) this.list[i].seen = false
    for (let i = 0; i < riders.length; i++) {
      const s = riders[i]
      let e = this.map.get(s.id)
      if (!e) {
        const r = makeRider(COLOURS[this.map.size % COLOURS.length], this.map.size, true)
        e = { id: s.id, r, d: s.d, told: s.d, err: 0, phase: this.map.size, seen: true } as Entry
        e.want = newRoadPose()
        e.now = newRoadPose()
        r.tag.visible = s.id !== me
        r.tag.scale.multiplyScalar(TAG_SCALE)
        r.label(s.name, null, 'riding')
        this.group.add(r.root)
        this.map.set(s.id, e)
        this.list.push(e)
      }
      e.seen = true
      // Dead reckoning at the reported speed; each new report's error is paid off smoothly.
      if (s.d !== e.told) {
        e.told = s.d
        e.err = s.d - e.d
      }
      const fix = e.err * (Math.abs(e.err) > SNAP_M ? 1 : clamp(dt * 3))
      e.err -= fix
      e.d += s.speed * dt + fix
      const p = this.path.poseAt(e.d, this.pose)
      const { r, want, now } = e
      poseWants({ ...s, grade: p.grade }, want, want)
      const k = clamp(dt * P.ease)
      now.stand += (want.stand - now.stand) * k
      now.tuck += (want.tuck - now.tuck) * k
      now.cheer += (want.cheer - now.cheer) * k
      // Coasting: the cranks stop and settle level. Otherwise they turn at the cadence.
      if (want.coast) e.phase += (levelPhase(e.phase) - e.phase) * clamp(dt * P.levelRate)
      else e.phase += (s.cadence / 60) * Math.PI * 2 * dt
      if (e.look !== s.look) r.setLook((e.look = s.look))
      r.pose('ride', e.phase, 0, now)
      r.bike.roll(e.d)
      r.root.position.set(
        p.x + p.rx * s.offset,
        p.y - s.offset * Math.sin(p.bank),
        p.z + p.rz * s.offset,
      )
      const lean = bendLean(s.speed, p.curv)
      r.root.rotation.set(Math.atan(p.grade), Math.atan2(-p.fx, -p.fz), -lean - p.bank, 'YXZ')
      if (s.id === me) {
        Object.assign(this.me, p)
        this.meD = e.d
        this.meOffset = s.offset
        this.meSpeed = s.speed
        this.meLean = lean
        this.meTuck = now.tuck
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]
      if (e.seen) continue
      this.group.remove(e.r.root)
      this.map.delete(e.id)
      this.list.splice(i, 1)
    }
  }
}
