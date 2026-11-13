import { hash } from '../math'
import { VIS } from '../params'
import type { Level } from '../quality'
import { FUN } from './funVis'
import { TRAFFIC, member, type Herd, type LifePlan } from './lifePlan'
import { LifePool } from './lifePool'
import { newPose, type Pose, type RoadPath } from './roadPath'

const R = VIS.route
const L = FUN.life
const BIRDS: readonly string[] = ['cockatoos', 'galahs', 'seagulls', 'magpie']
const tmp = [0, 0, 0]
const pose = newPose()

/** A herd in view: its plan, when it was set off (-1 not yet, -2 over), and each member's [dx, dz, yaw, y]. */
interface Live {
  h: Herd
  n: number
  t0: number
  /** Traffic: metres along the road. Flocks: how high they perch. */
  at: number
  m: Float32Array
  /** The road where it crosses or stands, worked out once. */
  road: Pose
}

/**
 * The animals and traffic of the road world, laid out from the plan for the chunks around the rider and moved
 * every frame without allocating. Mobs hop away, flocks burst into the air, a wombat ambles across, a magpie
 * has a go, and now and then something drives past the other way.
 */
export class Life {
  /** What the rider is in the middle of or passing right now, for the commentator. */
  event: string | undefined
  /** More kangaroos about at dawn and dusk. */
  dusk = false
  private pool = new LifePool()
  readonly group = this.pool.group
  private live: Live[] = []
  private kc = NaN
  private laid = -Infinity

  constructor(
    private plan: LifePlan,
    private path: RoadPath,
    private height: (x: number, z: number) => number,
  ) {}

  /** Lays out the herds of the chunks around the rider, keeping the state of those already in view. */
  private layout(kc: number, level: Level) {
    const was = this.live
    this.live = []
    for (let k = kc - 1; k <= kc + L.chunksAhead; k++)
      for (const h of this.plan.chunk(k)) {
        if (h.rank >= L.share[level]) continue
        let l = was.find((w) => w.h === h)
        if (!l) {
          const n = Math.round(h.n * (h.kind === 'roos' && this.dusk ? L.duskMobs : 1))
          const at = hash(h.seed) < L.perchShare ? L.perch : 0
          const road = this.path.poseAt(h.d, newPose())
          l = { h, n, t0: -1, at, m: new Float32Array(n * 4), road }
          for (let i = 0; i < n; i++) l.m.set(member(h, i, tmp), i * 4)
        }
        for (let i = 0; i < l.n; i++)
          l.m[i * 4 + 3] = this.height(h.x + l.m[i * 4], h.z + l.m[i * 4 + 1])
        this.live.push(l)
      }
  }

  /** True when the rider is in the right place to set a herd off. */
  private triggers(h: Herd, gap: number, ahead: number) {
    const k = h.kind
    if (k === 'roos') return gap < L.spook
    if (k === 'cockatoos' || k === 'galahs') return gap < L.burst
    if (k === 'wombat' || k === 'lyrebird') return ahead < L.cross && ahead > 0
    if (k === 'magpie') return Math.abs(ahead) < L.swoop
    return TRAFFIC.includes(k) && ahead < L.trafficSee && ahead > -R.chunk
  }

  /** Call every frame: `d` and `me` are where the rider is, `t` the scene clock. */
  update(dt: number, t: number, d: number, me: Pose, level: Level) {
    const kc = Math.floor(d / R.chunk)
    if (kc !== this.kc || t - this.laid > L.relayS) {
      this.layout(kc, level)
      this.kc = kc
      this.laid = t
    }
    this.pool.begin()
    this.event = undefined
    for (const l of this.live) {
      const { h } = l
      const k = h.kind
      const road = TRAFFIC.includes(k)
      const gap = Math.hypot(h.x - me.x, h.z - me.z)
      if (l.t0 === -1 && this.triggers(h, gap, h.d - d)) {
        l.t0 = t
        if (road) {
          l.at = Math.min(this.path.length - 20, d + L.trafficSee)
          this.pool.paint(
            k,
            k === 'ute' ? L.utes[Math.floor(hash(h.seed) * L.utes.length)] : '#fff',
          )
        }
      }
      const tt = l.t0 >= 0 ? t - l.t0 : -1
      if (road) this.traffic(l, dt, d)
      else if (k === 'magpie') this.magpie(l, tt, me, t)
      else if (k === 'wombat' || k === 'lyrebird') this.crossing(l, tt, t)
      else this.mob(l, tt, t, me)
      // Something happening beats something merely standing there.
      const busy = l.t0 >= 0 && tt < L.eventS
      const standing = !this.event && l.t0 !== -2 && gap < L.noticeM && !road && k !== 'magpie'
      if (busy || standing) this.event = k === 'ute' || k === 'caravan' ? 'traffic' : k
    }
    this.pool.end()
  }

  /** Roos, cattle, sheep and flocks: each member at its own spot until the rider sets them off. */
  private mob(l: Live, tt: number, t: number, me: Pose) {
    const { h, m } = l
    const k = h.kind
    const fly = BIRDS.includes(k)
    const { rx, rz, fx, fz } = l.road
    for (let i = 0; i < l.n; i++) {
      const x = h.x + m[i * 4]
      const z = h.z + m[i * 4 + 1]
      const y = m[i * 4 + 3]
      const u = hash(h.seed + i * 3.7)
      if (k === 'seagulls') {
        // Wheeling round the middle of the flock.
        const r = L.gullR * (0.5 + u)
        const a = (t * L.gullMs) / r + u * 40
        const up = y + L.gullH * (0.6 + 0.8 * hash(u * 9)) + Math.sin(t * 0.7 + i) * 0.8
        const beat = Math.sin(t * 4 + i) * 0.4
        this.pool.bird(k, h.x + Math.cos(a) * r, up, h.z + Math.sin(a) * r, -a, 0, beat)
        continue
      }
      const go = tt - i * (fly ? 0.12 : 0.22)
      const watching = k !== 'sheep' && Math.hypot(me.x - x, me.z - z) < L.watch
      const yaw = watching ? Math.atan2(me.x - x, me.z - z) : m[i * 4 + 2]
      if (go < 0 || k === 'cows' || k === 'sheep') {
        // Flocks peck at the ground, or sit tight up in the branches.
        const peck = l.at ? 0 : Math.max(0, Math.sin(t * 3 + i * 2)) * 0.7
        if (fly) this.pool.bird(k, x, y + l.at + 0.2, z, m[i * 4 + 2], peck, -1.35)
        else this.pool.put(k, x, y, z, yaw)
        continue
      }
      // Roos make for the scrub; birds go up and over the road ahead, where they can be seen. Each on its own line.
      const a = (u - 0.5) * 1.6
      const out = fly ? -h.side : h.side
      const on = fly ? 0.9 + a * 0.6 : 0.35 + a * 0.5
      const ox = rx * out + fx * on
      const oz = rz * out + fz * on
      const len = Math.hypot(ox, oz)
      const dx = ox / len
      const dz = oz / len
      if (fly) {
        if (go > L.flyS) continue
        const s = go * L.flyMs * (0.8 + u * 0.5)
        const up = y + l.at + 0.5 + go * L.riseMs * (0.8 + u * 0.6) + Math.sin(go * 3 + i) * 0.5
        const beat = Math.sin(go * 20 + i) * 0.9
        this.pool.bird(k, x + dx * s, up, z + dz * s, Math.atan2(dx, dz), -0.25, beat)
        continue
      }
      const far = L.fleeM * (0.7 + u * 0.5)
      const s = Math.min(far, go * L.hopMs)
      const nx = x + dx * s
      const nz = z + dz * s
      const hop = s < far ? Math.sin(Math.PI * ((s / L.hopLen) % 1)) : 0
      const facing = s < far ? Math.atan2(dx, dz) : Math.atan2(me.x - nx, me.z - nz)
      const lean = s < far ? 0.45 - hop * 0.3 : 0
      this.pool.put(k, nx, this.height(nx, nz) + hop * L.hopH, nz, facing, lean)
    }
  }

  /** A wombat or lyrebird that sets off across the road as the rider comes up. */
  private crossing(l: Live, tt: number, t: number) {
    const { h, road } = l
    const wombat = h.kind === 'wombat'
    const edge = R.roadHalf + R.verge
    const o0 = edge + L.kinds[h.kind].near
    const o = Math.max(-L.crossTo, o0 - Math.max(0, tt) * (wombat ? L.wombatMs : L.lyreMs))
    const x = road.x + road.rx * h.side * o
    const z = road.z + road.rz * h.side * o
    const y = Math.abs(o) < edge ? road.y : this.height(x, z)
    const wob = tt >= 0 && o > -L.crossTo ? Math.sin(t * (wombat ? 9 : 14)) : 0
    const yaw = Math.atan2(-road.rx * h.side, -road.rz * h.side)
    this.pool.put(h.kind, x, y, z, yaw, wombat ? 0 : wob * 0.12, wombat ? wob * 0.1 : 0)
  }

  /** The magpie: out of nowhere, low over the helmet from behind, round and back again, then gone. */
  private magpie(l: Live, tt: number, me: Pose, t: number) {
    if (tt < 0) return
    const over = Math.max(0, tt - L.swoopS)
    if (over > 4) return void (l.t0 = -2)
    const a = (Math.min(tt, L.swoopS) / L.swoopS) * L.swoopPasses * Math.PI - Math.PI / 2
    const along = Math.sin(a) * L.swoopM + over * 9
    const side = Math.sin(2 * a) * 1.2
    const up = L.swoopLow + Math.sin(a) ** 2 * L.swoopHigh + over * 4
    const dir = Math.cos(a) >= 0 || over > 0 ? 1 : -1
    const x = me.x + me.fx * along + me.rx * side
    const z = me.z + me.fz * along + me.rz * side
    const dive = Math.sin(2 * a) * 0.5 * dir
    const yaw = Math.atan2(me.fx * dir, me.fz * dir)
    this.pool.bird('magpie', x, me.y + up, z, yaw, dive, Math.sin(t * 22) * 0.9)
  }

  /** Something coming the other way: it appears up the road, drives past in the far lane and is gone. */
  private traffic(l: Live, dt: number, d: number) {
    if (l.t0 < 0) return
    l.at -= L.trafficMs * dt
    if (l.at < Math.max(5, d - L.trafficGone)) return void (l.t0 = -2)
    this.drive(l.h.kind, l.at)
    if (l.h.kind === 'caravan') this.drive('caravanTow', l.at + L.towGap)
  }

  private drive(name: string, at: number) {
    const p = this.path.poseAt(Math.min(this.path.length, at), pose)
    const x = p.x + p.rx * L.trafficLane
    const z = p.z + p.rz * L.trafficLane
    const y = p.y - L.trafficLane * Math.sin(p.bank)
    this.pool.put(name, x, y, z, Math.atan2(p.fx, p.fz), -Math.atan(p.grade))
  }

  dispose() {
    this.pool.dispose()
  }
}
