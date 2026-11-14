import * as THREE from 'three'
import type { Look } from '../../core/cosmetics'
import { VIS } from '../params'
import { makeRider } from '../riders'
import type { CamShot } from './camShots'
import type { HeightField } from './heightField'
import { newRoadPose } from './riderPose'
import { newPose } from './roadPath'
import type { RouteWorld } from './routeWorld'
import { Signs } from './signs'

const P = VIS.route.podium
const JERSEYS = ['#f2b705', '#c9ced6', '#c7783a', '#e85d9c']
const unit = new THREE.BoxGeometry(1, 1, 1)

export interface PodiumRider {
  id: string
  name: string
  look?: Look
}

/** What each spot does: 1st jumps and pedals the air, 2nd jogs, 3rd pulls a wheelie, the side box twirls. */
type Act = 'jump' | 'jog' | 'wheelie' | 'twirl'
interface Fig {
  r: ReturnType<typeof makeRider>
  act: Act
  y: number
  pose: ReturnType<typeof newRoadPose>
}

/**
 * The end of a race at the finish: the top three on the steps (1st in the middle and highest), the points or
 * prime winner on a box of their own beside them, champagne, confetti, and a camera swinging round the front.
 * Its own camera shot: the world calls `update` every frame until it says it is done.
 */
export class Podium implements CamShot {
  readonly group = new THREE.Group()
  private signs = new Signs()
  private figs: Fig[] = []
  private drops: THREE.Points
  private vel: Float32Array
  private c = new THREE.Vector3()
  private face = new THREE.Vector2()
  private side = new THREE.Vector2()
  private t = 0
  private last = 0
  private burst = 0

  constructor(
    field: HeightField,
    readonly d: number,
    top: PodiumRider[],
    award: { who: PodiumRider; sign: string } | undefined,
    title: string,
    private party: (x: number, y: number, z: number) => void,
  ) {
    const p = field.path.poseAt(d, newPose())
    // On the left verge, facing the road.
    const out = VIS.route.roadHalf + VIS.route.verge + P.setbackM
    this.face.set(p.rx, p.rz)
    this.side.set(p.fx, p.fz)
    this.c.set(p.x - p.rx * out, 0, p.z - p.rz * out)
    this.c.y = field.ground(this.c.x, this.c.z)
    this.group.position.copy(this.c)
    this.group.rotation.y = Math.atan2(-p.rx, -p.rz)
    // In the group, the figures face -z; seen from the road, +x is the viewer's left.
    const w = P.stepW
    const sideX = -(w * 1.5 + P.sideGapM + w / 2)
    const spots: [number, number, Act][] = [
      [0, P.firstH, 'jump'],
      [w, P.secondH, 'jog'],
      [-w, P.thirdH, 'wheelie'],
    ]
    spots.forEach(([x, h], k) => this.block(x, h, String(k + 1), P.step, w))
    top.forEach((who, k) => this.stand(who, spots[k][0], spots[k][1], spots[k][2], JERSEYS[k]))
    if (award) {
      this.block(sideX, P.sideH, '★', P.side, w)
      this.stand(award.who, sideX, P.sideH, 'twirl', JERSEYS[3])
      const board = this.signs.plate(award.sign, P.signW, P.signW * 0.4, P.side, '#1b1b1b')
      board.position.set(sideX - w * 0.9, P.signUpM, 0)
      board.rotation.z = 0.12
      const post = new THREE.Mesh(unit, new THREE.MeshLambertMaterial({ color: P.backdrop }))
      post.scale.set(0.08, P.signUpM, 0.08)
      post.position.set(sideX - w * 0.9, P.signUpM / 2, 0.06)
      this.group.add(board, post)
    }
    const back = this.signs.plate(title, w * 5, 1.1, P.backdrop, P.backdropText)
    back.position.set(0, P.firstH + 3.2, P.depthM / 2 + 0.6)
    const legs = [-1, 1].map((s) => {
      const m = new THREE.Mesh(unit, new THREE.MeshLambertMaterial({ color: P.backdrop }))
      m.scale.set(0.12, P.firstH + 3.2, 0.12)
      m.position.set(s * w * 2.4, (P.firstH + 3.2) / 2, P.depthM / 2 + 0.6)
      return m
    })
    this.group.add(back, ...legs)
    // Champagne: drops thrown from the winner's bottle in a loop, each on its own clock.
    this.vel = new Float32Array(P.drops * 4)
    for (let i = 0; i < P.drops; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * P.sprayCone
      const v = P.sprayMs * (0.7 + Math.random() * 0.3)
      this.vel.set([Math.cos(a) * r * v, v, -0.6 * v + Math.sin(a) * r * v, Math.random()], i * 4)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.drops * 3), 3))
    this.drops = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: P.fizz,
        size: P.dropSize,
        transparent: true,
        opacity: 0.85,
      }),
    )
    this.drops.frustumCulled = false
    this.group.add(this.drops)
  }

  private block(x: number, h: number, text: string, colour: string, w: number) {
    const m = new THREE.Mesh(unit, new THREE.MeshLambertMaterial({ color: colour }))
    m.scale.set(w, h, P.depthM)
    m.position.set(x, h / 2, 0)
    m.castShadow = m.receiveShadow = true
    const tall = h * 0.8
    const sign = this.signs.plate(text, Math.min(w * 0.9, tall * 0.8), tall, colour, '#1b1b1b')
    sign.position.set(x, h / 2, -P.depthM / 2 - 0.04)
    this.group.add(m, sign)
  }

  private stand(who: PodiumRider, x: number, y: number, act: Act, colour: string) {
    const r = makeRider(colour, who.id, true)
    r.setLook(who.look)
    r.label(who.name, null, 'riding')
    r.tag.scale.multiplyScalar(0.55)
    r.bike.group.visible = act === 'wheelie'
    r.root.position.set(x, y, 0)
    this.group.add(r.root)
    this.figs.push({ r, act, y, pose: newRoadPose() })
  }

  update(
    cam: THREE.PerspectiveCamera,
    field: HeightField,
    _who: unknown,
    ox: number,
    oy: number,
    oz: number,
  ) {
    const now = performance.now()
    const dt = this.last ? Math.min(VIS.route.fly.maxStepS, (now - this.last) / 1000) : 0
    this.last = now
    const t = (this.t += dt)
    this.pose(t)
    this.spray(t)
    if ((this.burst -= dt) <= 0) {
      this.burst = P.burstS
      this.party(this.c.x, this.c.y + P.firstH, this.c.z)
    }
    const a = Math.sin(t * P.swingHz * Math.PI * 2) * P.swingRad
    const { face, side, c } = this
    const x = c.x + (face.x * Math.cos(a) + side.x * Math.sin(a)) * P.camM
    const z = c.z + (face.y * Math.cos(a) + side.y * Math.sin(a)) * P.camM
    const y = Math.max(c.y + P.camUpM, field.ground(x, z) + VIS.route.camClear)
    cam.position.set(x - ox, y - oy, z - oz)
    cam.lookAt(c.x - ox, c.y + P.aimUpM - oy, c.z - oz)
    return t >= P.secs
  }

  /** The silly poses, every frame. */
  private pose(t: number) {
    for (const f of this.figs) {
      const { r, pose, act } = f
      const hop = Math.abs(Math.sin(t * P.jumpHz * Math.PI))
      r.root.position.y = f.y + (act === 'jump' ? hop * P.jumpM : 0)
      r.root.rotation.set(act === 'wheelie' ? 0.25 + 0.15 * Math.sin(t * 3) : 0, 0, 0)
      if (act === 'twirl') r.root.rotation.y = t * P.twirlRad
      if (act === 'jog') r.root.rotation.y = Math.sin(t * 2.2) * 0.6
      pose.cheer = act === 'wheelie' ? 0.5 + 0.5 * Math.sin(t * 2) : 1
      pose.stand = act === 'wheelie' ? 1 : 0
      r.pose(act === 'jog' ? 'run' : 'ride', t * (act === 'jog' ? 9 : P.spinRad), 0, pose)
    }
  }

  /** Each drop flies from the winner's raised hands on its own loop of `dropS` seconds. */
  private spray(t: number) {
    const win = this.figs[0]
    if (!win) return
    const pos = this.drops.geometry.getAttribute('position') as THREE.BufferAttribute
    const o = win.r.root.position
    const top = o.y + 2.1 * win.r.root.scale.y
    for (let i = 0; i < P.drops; i++) {
      const v = this.vel.subarray(i * 4, i * 4 + 4)
      const age = (t / P.dropS + v[3]) % 1
      const s = age * P.dropS
      pos.setXYZ(i, o.x + v[0] * s, top + v[1] * s - 4.9 * s * s, o.z + v[2] * s)
    }
    pos.needsUpdate = true
  }
}

/**
 * Puts a podium on the world just before the finish at `d` and hands it the camera; `done` is called when the shot is over (or when
 * `skip` is called). The riders on the road are hidden meanwhile: they are all up on the steps.
 */
export function startPodium(
  world: RouteWorld,
  d: number,
  top: PodiumRider[],
  award: { who: PodiumRider; sign: string } | undefined,
  title: string,
  done: () => void,
) {
  const p = new Podium(world.field, Math.max(0, d - P.lineM), top, award, title, (x, y, z) =>
    world.party({ x, y, z }),
  )
  world.show(p.group)
  world.riders.group.visible = false
  world.shot = p
  const end = () => {
    world.onShotEnd = undefined
    world.shot = undefined
    done()
  }
  world.onShotEnd = end
  return { skip: end }
}
