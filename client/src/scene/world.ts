import * as THREE from 'three'
import type { Look } from '../core/cosmetics'
import { makeBus } from './bus'
import { BusCam } from './busCam'
import { BigThings } from './bigThings'
import { Crew } from './crew'
import { busEmitters, hordeDust, smashBurst } from './emitters'
import { FxLayer } from './fxLayer'
import { Ground, ROAD_HALF, groundH } from './ground'
import { Billboards, Servo } from './landmarks'
import { Mirror } from './mirror'
import { MoodBlend, weatherEnv, type Env, type Weather } from './moods'
import { Rain } from './route/rain'
import { Particles } from './particles'
import { VIS, type Mood } from './params'
import { Props } from './props'
import { Horde, zedKind } from './horde'
import { Bosses, bossKind } from './bosses'
import { Roadblock } from './roadblock'
import { Sky } from './sky'
import { Strikes } from './strikes'
import { Quality } from './quality'
import { clamp } from './util'

export { debugPanel } from './debug'

export interface SceneRider {
  id: string
  /** This screen's own rider: no name tag (you know who you are). */
  me?: boolean
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
  /** LEGEND sprints the crew has ever ridden: trophies on the roof. */
  trophies?: number
  /** The bus ride's weather. Dust hides the mirror. */
  weather?: Weather
  /** The crew's gunship is up and firing on the horde. */
  gunship?: boolean
  /** A boss fight behind the bus, as the server names it, and its health, 1 to 0. */
  boss?: { name: string; left: number } | null
  /** The server's zombie-type tip (runners on long hauls, brutes on ramp-ups), or null. */
  zed?: string | null
}
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
  sky = new Sky()
  private ground = new Ground()
  private props = new Props(0)
  private boards = new Billboards(0)
  private servo = new Servo()
  private bigThings = new BigThings()
  private mirror!: Mirror
  private wenv = {} as Env
  private rain = new Rain()
  private bus = makeBus()
  private horde = new Horde()
  private bosses = new Bosses()
  private block = new Roadblock()
  private strikes = new Strikes()
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
  /** The chase rig, the player's camera and the streak cinematics. */
  cam!: BusCam
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
      this.bigThings.group,
      this.bus.group,
      this.horde.group,
      this.bosses.group,
      this.block.group,
      this.block.debris,
      this.strikes.group,
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
    this.scene.add(this.rain.lines)
    // The land under the camera, so no view or orbit goes inside a hill (the road is flat at 0).
    const land = (x: number, z: number) =>
      Math.abs(x) < ROAD_HALF + 0.5 ? 0 : Math.max(0, groundH(x, z - this.dist)) + 1.5
    this.cam = new BusCam(this.host, this.renderer.domElement, land)
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

  /** C or the camera button: skips a cinematic if one is showing, else the next view; returns its name. */
  cycleView = () => this.cam.cycle()

  fx(kind: FxKind) {
    if (kind === 'hit') {
      this.flash = 1
      this.cam.rig.shake = Math.max(this.cam.rig.shake, 1)
      this.hit = 1
      this.horde.launch()
    }
    if (kind === 'shake') this.cam.rig.shake = Math.max(this.cam.rig.shake, 1.6)
    if (kind === 'slowmo') this.slow = 1.8
    if (kind === 'drop' || kind === 'airstrike') {
      this.strikes.fire(kind)
      this.cam.cine.start(kind)
    }
    if (kind === 'smash') {
      const at = this.block.smash()
      this.cam.rig.shake = 2
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
    this.mirror.render(
      this.renderer,
      this.scene,
      this.state.gap !== null && this.state.weather !== 'dust',
    )
  }

  private step(dt: number, sm: number) {
    const s = this.state
    const env = weatherEnv(this.mood.update(dt / sm, s.mood), s.weather, this.wenv)
    this.rain.update(s.weather === 'rain', this.camera.position, this.t, dt)
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
    this.bigThings.update(dz, this.dist)
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
    this.bus.setTrophies(s.trophies ?? 0)
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
    busEmitters(this.smoke, this.sparks, dt, s, this.bus, env.fog)

    // horde
    const g = s.gap
    this.horde.group.visible = g !== null
    if (g !== null) {
      const target = hordeZFor(g)
      this.hordeZ += (target - this.hordeZ) * clamp(dt * 2)
      this.horde.group.position.z = this.hordeZ
      this.horde.update(this.t, dt, g, zedKind(s.zed))
      hordeDust(this.smoke, this.horde.dust, this.hordeZ, env.fog)
    }

    // roadblock
    this.block.update(this.t, dt, night, s.roadblock)
    this.crew.update(s.riders, this.t, dt, g === null ? null : this.hordeZ, this.smoke, s.speed)
    const hz = g === null ? null : this.hordeZ
    const boss = g === null || !s.boss ? null : { kind: bossKind(s.boss.name), left: s.boss.left }
    if (this.bosses.update(boss, this.hordeZ, this.t, dt, this.smoke, this.sparks))
      this.cam.rig.shake = Math.max(this.cam.rig.shake, VIS.boss.stomp)
    if (this.strikes.update(this.t, dt, s, hz, this.horde, this.sparks, this.smoke))
      this.cam.rig.shake = Math.max(this.cam.rig.shake, 1.6)
    const climb = (this.climb += ((s.mood === 'rampup' ? 1 : 0) - this.climb) * clamp(dt * 0.8))
    const tall = boss ? { roadtrain: 6, giant: VIS.boss.giantH, bridge: 10 }[boss.kind] : 0
    const o = {
      speed: v,
      gap: g,
      hit: this.hit,
      slow: sm < 1,
      climb,
      horde: hz,
      boss: tall,
    }
    this.cam.update(this.camera, this.t, dt, o, dt / sm, this.strikes, !!s.gunship, hz)
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
    this.cam.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
