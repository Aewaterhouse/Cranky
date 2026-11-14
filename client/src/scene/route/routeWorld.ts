import * as THREE from 'three'
import type { Route } from '../../core/route'
import type { Place } from '../../core/soundMix'
import { MoodBlend } from '../moods'
import type { PerfMon } from '../perfMon'
import { VIS } from '../params'
import { LEVELS, Quality, startLevel, type Level } from '../quality'
import { Sky } from '../sky'
import type { CamShot } from './camShots'
import { Chunks } from './chunks'
import { Confetti } from './confetti'
import { Features } from './features'
import { planChalk, planFunSigns, type Chalk, type FunSign } from './funSigns'
import { planFurniture } from './furniture'
import { HeightField } from './heightField'
import { LandCover } from './landCover'
import { planLandmarks, type Landmark } from './landmarkPlan'
import { Life } from './life'
import { LifePlan } from './lifePlan'
import { Oddities, jokeCover, seedOf } from './oddPlan'
import { Signs } from './signs'
import { Rain } from './rain'
import { RoadPath, newPose } from './roadPath'
import { pickMood } from './routeMoods'
import { RoadRiders, type RoadRider } from './roadRiders'
import { RouteCam } from './routeCam'
import { PlayerCam } from '../playerCam'
import { CAM } from '../camVis'
import { Skyline } from './skyline'
import { aimSun, setUpSun } from './sun'
import { TerrainGrid } from './terrainGrid'

export type { RoadRider } from './roadRiders'

const R = VIS.route
const AHEAD = {
  lowpower: 'aheadLowpower',
  potato: 'aheadPotato',
  low: 'aheadLow',
  medium: 'aheadMedium',
  high: 'aheadHigh',
} as const satisfies Record<Level, string>
/** Move the floating origin once the rider is this far from it. */
const RECENTRE_M = 300

/** What any road game hands the scene: everyone on the road, and which one the camera follows. */
export interface RoadState {
  me: string
  riders: RoadRider[]
}

/** The 3D road world for a route: real bends and gradients, terrain around it, riders and a chase camera. */
export class RouteWorld {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(R.fov, 1, 0.5, 8000)
  state: RoadState = { me: '', riders: [] }
  /** A set piece that has the camera until it is over; `onShotEnd` is told when it ends by itself. */
  shot?: CamShot
  onShotEnd?: () => void
  private focus = newPose()
  /** The frame-time monitor, when asked for (`watchPerf` in worldDev.ts). */
  perf?: PerfMon
  quality: Quality
  readonly field: HeightField
  readonly chunks: Chunks
  readonly riders: RoadRiders
  readonly odd: Oddities
  private landmarks: Map<number, Landmark[]>
  readonly lifePlan: LifePlan
  private cover: Pick<LandCover, 'at'>
  private life: Life
  readonly things: { sign: Map<number, FunSign[]>; chalk: Map<number, Chalk[]> }
  /** Works out the funny signs and chalk again, for when their tunables change. */
  private replan: () => void
  /** Everything placed in route metres lives here, shifted so the rider is always near (0, 0, 0). */
  private root = new THREE.Group()
  private ox = 0
  private oy = 0
  private oz = 0
  private mood = new MoodBlend()
  /** The sky right now (a key of the route moods), for the wind and the sounds of the place. */
  moodName = 'route'
  private sky = new Sky(true)
  private skyline = new Skyline()
  private rig = new RouteCam()
  /** The player's orbit and zoom on top of the chase camera. */
  cam!: PlayerCam
  private pivot = new THREE.Vector3()
  private rain = new Rain()
  private confetti = new Confetti()
  private seed: number
  private hour = 12
  private hourAt = -Infinity
  private key = new THREE.DirectionalLight('#fff', 1)
  private hemi = new THREE.HemisphereLight('#fff', '#443', 1)
  private fog = new THREE.Fog('#fff', 30, 200)
  private t = 0
  private last = performance.now()
  private raf = 0

  /** Throws when the browser has no WebGL. */
  constructor(
    private host: HTMLElement,
    route: Route,
  ) {
    // Smoothing edges is the dearest thing a weak device does, so a world that starts low goes without.
    const smooth = R.antialias > 0 && LEVELS.indexOf(startLevel()) >= LEVELS.indexOf('medium')
    this.renderer = new THREE.WebGLRenderer({ antialias: smooth })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    host.prepend(this.renderer.domElement)
    this.cam = new PlayerCam(this.renderer.domElement)
    const terrain = route.points[0].lat === undefined ? undefined : route.terrain
    this.seed = seedOf(route.id)
    const path = new RoadPath(route, terrain)
    this.field = new HeightField(path, terrain && new TerrainGrid(terrain))
    // Map features share the height grid's origin, so they are only usable alongside it.
    const cover = new LandCover(terrain, route.region)
    this.cover = jokeCover(route.id, cover)
    const features = new Features(terrain && route.features, this.field)
    const furniture = planFurniture(path)
    const taken = [...furniture.values()].flat().map((f) => f.d)
    this.things = { sign: new Map(), chalk: new Map() }
    this.replan = () => {
      this.things.sign.clear()
      this.things.chalk.clear()
      for (const [k, v] of planFunSigns(route.id, this.field, cover, features, taken))
        this.things.sign.set(k, v)
      for (const [k, v] of planChalk(route.id, path)) this.things.chalk.set(k, v)
    }
    this.replan()
    this.chunks = new Chunks({
      field: this.field,
      cover,
      features,
      signs: new Signs(),
      furniture,
      funSigns: this.things.sign,
      chalk: this.things.chalk,
      landmarks: (this.landmarks = planLandmarks(route.id, terrain, this.field, cover, features)),
      odd: (this.odd = new Oddities(route.id, this.field, cover, features)),
    })
    this.riders = new RoadRiders(path)
    this.rig.loop = !!route.loop
    this.lifePlan = new LifePlan(route.id, this.field, cover, features)
    this.life = new Life(this.lifePlan, path, this.chunks.height)
    path.poseAt(0, this.riders.me)
    const k = setUpSun(this.key)
    this.scene.fog = this.fog
    this.root.add(
      this.chunks.group,
      this.riders.group,
      this.life.group,
      this.skyline.mesh,
      this.confetti.mesh,
    )
    this.scene.add(this.root, this.sky.group, this.rain.lines, k, k.target, this.hemi, this.camera)
    addEventListener('resize', this.resize)
    let was: number = LEVELS.indexOf(startLevel())
    this.quality = new Quality(this.renderer, () => {
      // Scenery built for a better level is what was too slow: a drop rebuilds it thinner straight away.
      const now = this.quality ? LEVELS.indexOf(this.quality.level) : was
      if (now < was) this.chunks.clear()
      was = now
      this.resize()
    })
    this.resize()
    this.loop()
  }

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.host
    this.renderer.setSize(w, h)
    this.camera.aspect = w / Math.max(1, h)
    // Shift the picture up a little so the rider clears the elevation strip at the bottom.
    this.camera.setViewOffset(w, h, 0, h * R.viewShift, w, h)
    this.camera.updateProjectionMatrix()
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    // A hidden tab that still gets frames (some browsers, a covered window) draws once a second at most.
    if (document.hidden && now - this.last < R.hiddenFrameMs) return
    const real = (now - this.last) / 1000
    this.perf?.frame(real)
    const dt = Math.min(0.1, real)
    this.last = now
    // The quality steps on the real frame time: capped, a crawl of two frames a second read as ten.
    this.quality.frame(real)
    this.t += dt
    this.step(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private step(dt: number, all = false) {
    // The clock on the wall sets the time of day; looked at once a minute.
    if (this.t - this.hourAt > 60) {
      const now = new Date()
      this.hour = now.getHours() + now.getMinutes() / 60
      this.hourAt = this.t
    }
    const day = Math.floor(Date.now() / 86400000)
    const mood = pickMood(this.hour, this.riders.me.y, this.t, this.seed, day)
    this.moodName = mood
    this.life.dusk = mood === 'routeDawn' || mood === 'routeDusk'
    const env = this.mood.update(dt, mood)
    const ahead = R[AHEAD[this.quality.level]]
    this.fog.color.copy(env.fog)
    this.fog.far = Math.min(env.fogFar, ahead * 1.3)
    this.fog.near = Math.min(R.fogNear, this.fog.far * 0.3)
    this.hemi.color.copy(env.hemi)
    this.hemi.groundColor.copy(env.ground).multiplyScalar(0.5)
    this.hemi.intensity = env.hemiI
    this.key.color.copy(env.light)
    this.key.intensity = env.sunI * VIS.sun
    this.key.castShadow = VIS.shadow > 0

    this.riders.update(this.state.riders, this.state.me, dt)
    // During a set piece the world is built and lit around what the camera is looking at, not the rider.
    const shot = this.shot
    const d = shot?.d ?? this.riders.meD
    const me = shot ? this.field.path.poseAt(d, this.focus) : this.riders.me
    this.chunks.update(d, ahead, this.quality.level, all)
    this.life.update(dt, this.t, d, me, this.quality.level)
    if (Math.hypot(me.x - this.ox, me.y - this.oy, me.z - this.oz) > RECENTRE_M) {
      this.ox = Math.round(me.x)
      this.oy = Math.round(me.y)
      this.oz = Math.round(me.z)
      this.root.position.set(-this.ox, -this.oy, -this.oz)
    }
    const { ox, oy, oz } = this
    if (!shot) {
      this.rig.update(this.camera, this.field, this.riders, dt, this.t, ox, oy, oz)
      this.pivot.copy(this.rig.subject).y += 1.1
      this.cam.apply(this.camera, dt, this.pivot, this.rig.look, {
        near: CAM.nearRider,
        ground: (x, z) => this.field.ground(x + ox, z + oz) - oy,
      })
    } else if (shot.update(this.camera, this.field, this.riders, ox, oy, oz)) {
      this.shot = undefined
      this.onShotEnd?.()
    }
    this.sky.update(env, this.t, this.camera.position)
    this.rain.update(mood === 'routeShower', this.camera.position, this.t, dt)
    this.confetti.update(dt)
    this.skyline.update(this.field, me.x, me.y, me.z, env, dt)
    aimSun(this.key, env, me.x - ox, me.y - oy, me.z - oz)
  }

  /** The kind of oddity, landmark or animal the rider is passing right now, for the commentator. */
  near(): string | undefined {
    const F = R.place.fun
    const d = this.riders.meD
    if (this.life.event) return this.life.event
    const o = this.odd.next(d - 5, F.nearM + 5)
    if (o && o.d - d < F.nearM && o.rank < F.odd.share[this.quality.level]) return o.kind
    const { x, z } = this.riders.me
    for (const k of [-1, 0, 1])
      for (const l of this.landmarks.get(Math.floor(d / R.chunk) + k) ?? [])
        if (Math.hypot(l.x - x, l.z - z) < F.landmarkM) return l.kind
    return undefined
  }

  /** The ground the rider is passing, for the sounds of the place: `coastM` either side is searched for sand or water. */
  place(coastM: number): Place {
    const { x, y, z, rx, rz } = this.riders.me
    const at = (o: number) =>
      this.cover.at(x + rx * o, z + rz * o, this.field.ground(x + rx * o, z + rz * o))
    const coast = [0.25, 0.5, 0.75, 1].some((k) => /[aw]/.test(at(k * coastM) + at(-k * coastM)))
    return { cover: at(R.roadHalf + R.verge + 6), y, coast }
  }

  /** Confetti and streamers over the rider: a summit, the finish. */
  party() {
    const { x, y, z } = this.riders.me
    this.confetti.burst(x, y, z)
  }

  /** Drops the built chunks so visual settings changed in the debug panel show up. */
  rebuild() {
    this.replan()
    this.odd.clear()
    this.lifePlan.clear()
    this.chunks.clear()
  }

  /** PNG of the current view with every chunk in range built (render then read in the same frame). */
  snapshot(): string {
    this.step(0, true)
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.resize)
    this.chunks.clear()
    this.life.dispose()
    this.rain.dispose()
    this.confetti.dispose()
    this.cam.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
