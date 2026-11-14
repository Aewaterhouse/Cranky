import * as THREE from 'three'
import type { Look } from '../core/cosmetics'
import { makeBus } from './bus'
import { CamRig } from './camRig'
import { Crew } from './crew'
import { busEmitters, hordeDust, smashBurst } from './emitters'
import { FxLayer } from './fxLayer'
import { Ground } from './ground'
import { Billboards, Servo } from './landmarks'
import { Mirror } from './mirror'
import { PlayerCam } from './playerCam'
import { CAM } from './camVis'
import { MoodBlend } from './moods'
import { Pack, type MadScene } from './pack'
import { Particles } from './particles'
import { VIS, type Mood } from './params'
import { Props } from './props'
import { Horde } from './horde'
import { Roadblock } from './roadblock'
import { Sky } from './sky'
import { Strikes } from './strikes'
import { Quality } from './quality'
import { clamp } from './util'

export { debugPanel } from './debug'

export interface SceneRider {
  id: string
  name: string
  c: number | null
  st: string
  cadence: number
  look?: Look
  /** Heart rate in bpm and as a fraction of max, when the rider has a strap. */
  hr?: number | null
  hrp?: number | null
  /** Power over target (about 1 on target); lights the rider's cable into the bus. */
  effort?: number
}
export interface SceneState {
  speed: number
  gap: number | null
  armour: number | null
  mood: Mood
  riders: SceneRider[]
  /** 0..1 progress towards a roadblock, or null. */
  roadblock: number | null
  /** The driver's bus cosmetics. */
  busLook?: Look
  /** The crew's gunship is up and firing on the horde. */
  gunship?: boolean
  /** VO2 Madness: no bus, the riders race along the road as a pack. */
  mad?: MadScene | null
}
const BUS_LIMITS = { near: CAM.nearBus, ground: () => 0, bus: true }
export type FxKind = 'hit' | 'shake' | 'slowmo' | 'smash' | 'drop' | 'airstrike'

/** Where the horde front sits (metres behind the bus origin) for a given gap. */
export const hordeZFor = (gap: number) => 5.5 + gap * VIS.gapScale + gap * gap * 0.002

/** The road world: bus, riders, props, horde, roadblock, moods and camera effects. */
export class World {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(VIS.fov, 1, 0.5, 700)
  state: SceneState = {
    speed: 0,
    gap: null,
    armour: null,
    mood: 'drill',
    riders: [],
    roadblock: null,
  }
  private mood = new MoodBlend()
  private sky = new Sky()
  private ground = new Ground()
  private props = new Props(0)
  private boards = new Billboards(0)
  private servo = new Servo()
  private mirror!: Mirror
  private bus = makeBus()
  private horde = new Horde()
  private block = new Roadblock()
  private strikes = new Strikes()
  private pack = new Pack()
  private crew = new Crew(this.scene, this.bus.shell)
  private smoke = new Particles(500)
  private sparks = new Particles(300, true)
  private fxl: FxLayer
  private key = new THREE.DirectionalLight('#fff', 1)
  private hemi = new THREE.HemisphereLight('#fff', '#443', 1)
  private fog = new THREE.Fog('#fff', 30, 200)
  private dist = 0
  private hordeZ = 40
  private t = 0
  private prevSpeed = 0
  private pitch = 0
  quality?: Quality
  private climb = 0
  private brake = 0
  private hit = 0
  private flash = 0
  private slow = 0
  private rig = new CamRig()
  private pc!: PlayerCam
  private busPivot = new THREE.Vector3(0, 2, 0)
  private last = performance.now()
  private raf = 0

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    host.prepend(this.renderer.domElement)
    this.fxl = new FxLayer(host)
    this.scene.fog = this.fog
    const k = this.key
    k.castShadow = true
    k.shadow.mapSize.set(1536, 1536)
    const c = k.shadow.camera
    c.left = -22
    c.right = 22
    c.top = 26
    c.bottom = -26
    c.near = 1
    c.far = 120
    k.shadow.bias = -0.0004
    k.shadow.normalBias = 0.06
    this.horde.group.visible = false
    this.scene.add(
      this.sky.group,
      this.ground.group,
      this.props.group,
      this.boards.group,
      this.servo.group,
      this.bus.group,
      this.horde.group,
      this.block.group,
      this.block.debris,
      this.strikes.group,
      this.pack.group,
      this.smoke.points,
      this.sparks.points,
      this.key,
      this.key.target,
      this.hemi,
      this.camera,
    )
    this.camera.add(this.fxl.lines)
    this.ground.group.children.forEach((o) => (o.receiveShadow = true))
    this.mirror = new Mirror(this.host)
    this.pc = new PlayerCam(this.renderer.domElement)
    addEventListener('resize', this.resize)
    this.quality = new Quality(this.renderer, () => this.resize())
    this.resize()
    this.loop()
  }

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.host
    this.renderer.setSize(w, h)
    this.camera.aspect = w / Math.max(1, h)
    // Shift the picture up so the bus and horde clear the HUD cockpit at the bottom.
    this.camera.setViewOffset(w, h, 0, h * VIS.viewShift, w, h)
    this.camera.updateProjectionMatrix()
  }

  fx(kind: FxKind) {
    if (kind === 'hit') {
      this.flash = 1
      this.rig.shake = Math.max(this.rig.shake, 1)
      this.hit = 1
      this.horde.launch()
    }
    if (kind === 'shake') this.rig.shake = Math.max(this.rig.shake, 1.6)
    if (kind === 'slowmo') this.slow = 1.8
    if (kind === 'drop' || kind === 'airstrike') this.strikes.fire(kind)
    if (kind === 'smash') {
      const at = this.block.smash()
      this.rig.shake = 2
      this.flash = Math.max(this.flash, 0.5)
      this.hit = 1.2
      smashBurst(this.sparks, this.smoke, at)
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    let dt = Math.min(0.1, (now - this.last) / 1000)
    this.quality?.frame(dt)
    this.last = now
    this.slow = Math.max(0, this.slow - dt)
    const sm = this.slow > 0 ? 0.28 : 1
    dt *= sm
    this.t += dt
    this.step(dt, sm)
    this.renderer.render(this.scene, this.camera)
    this.mirror.render(this.renderer, this.scene, this.state.gap !== null && !this.state.mad)
  }

  private step(dt: number, sm: number) {
    const s = this.state
    const env = this.mood.update(dt / sm, s.mood)
    const night = clamp(env.head * 1.1)
    this.fog.color.copy(env.fog)
    this.fog.near = VIS.fogNear
    this.fog.far = env.fogFar
    this.hemi.color.copy(env.hemi)
    this.hemi.groundColor.copy(env.ground).multiplyScalar(0.5)
    this.hemi.intensity = env.hemiI
    this.key.color.copy(env.light)
    this.key.intensity = env.sunI * VIS.sun
    this.key.castShadow = VIS.shadow > 0
    this.key.position.set(-14 - env.sunElev * 0.1, 14 + env.sunElev * 0.85, 22)
    this.key.target.position.set(0, 0, 4)

    // the bus parks at the servo, so the world (and the bus) slow with it while the riders keep pedalling
    const v = s.speed * this.servo.flow
    const dz = v * dt
    this.dist += dz
    this.ground.update(this.dist, env)
    this.props.update(dz, this.dist)
    this.boards.update(dz, this.dist)
    this.servo.update(dz, s.mood === 'servo', dt)
    this.sky.update(env, this.t, this.camera.position)

    // bus
    const acc = dt > 0 ? (v - this.prevSpeed) / dt : 0
    this.prevSpeed = v
    this.pitch += (clamp(-acc * 0.006, -0.05, 0.05) - this.pitch) * clamp(dt * 3)
    this.brake += ((acc < -0.6 ? 1 : 0) - this.brake) * clamp(dt * 8)
    this.hit = Math.max(0, this.hit - dt * 2.2)
    this.flash = Math.max(0, this.flash - dt * 2)
    this.bus.setLook(s.busLook ?? {})
    this.bus.update({
      t: this.t,
      speed: v,
      armour: s.armour,
      head: env.head,
      brake: this.brake,
      hit: this.hit,
      pitch: this.pitch,
      dz,
    })
    this.bus.group.visible = !s.mad
    this.pack.group.visible = !!s.mad
    if (!s.mad) busEmitters(this.smoke, this.sparks, dt, s, this.bus, env.fog)

    // horde
    const g = s.gap
    this.horde.group.visible = g !== null
    if (g !== null) {
      const target = hordeZFor(g)
      this.hordeZ += (target - this.hordeZ) * clamp(dt * 2)
      this.horde.group.position.z = this.hordeZ
      this.horde.update(this.t, dt, g)
      hordeDust(this.smoke, this.horde.dust, this.hordeZ, env.fog)
    }

    // roadblock
    this.block.update(this.t, dt, night, s.roadblock)
    if (s.mad) this.pack.update(s.riders, s.mad, this.t, dt, s.speed, this.smoke, this.sparks)
    else
      this.crew.update(s.riders, this.t, dt, g === null ? null : this.hordeZ, this.smoke, s.speed)
    const hz = g === null ? null : this.hordeZ
    if (this.strikes.update(this.t, dt, s, hz, this.horde, this.sparks, this.smoke))
      this.rig.shake = Math.max(this.rig.shake, 1.6)
    this.rig.update(this.camera, this.t, dt, {
      speed: v,
      gap: g,
      hit: this.hit,
      slow: sm < 1,
      pack: !!s.mad,
      climb: (this.climb += ((s.mood === 'rampup' ? 1 : 0) - this.climb) * clamp(dt * 0.8)),
    })
    this.pc.apply(this.camera, this.busPivot, this.rig.look, BUS_LIMITS)
    this.strikes.view(this.camera)
    const px = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360))
    this.smoke.update(dt, px)
    this.sparks.update(dt, px)
    this.fxl.lines.position.z = -1
    this.fxl.lines.scale.setScalar(Math.tan((this.camera.fov * Math.PI) / 360))
    this.fxl.update(this.t, v, this.camera.aspect, this.flash * 0.8, night)
    this.sparks.points.visible = true
  }

  /** PNG of the current view (render then read in the same frame). */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.resize)
    this.fxl.dispose()
    this.mirror.dispose()
    this.pc.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
