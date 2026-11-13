import * as THREE from 'three'
import type { Route } from '../../core/route'
import { MoodBlend } from '../moods'
import { VIS } from '../params'
import { Quality, type Level } from '../quality'
import { Sky } from '../sky'
import { Chunks } from './chunks'
import { Features } from './features'
import { planChalk, planFunSigns, type Chalk, type FunSign } from './funSigns'
import { planFurniture } from './furniture'
import { HeightField } from './heightField'
import { LandCover } from './landCover'
import { planLandmarks, type Landmark } from './landmarkPlan'
import { Life } from './life'
import { LifePlan } from './lifePlan'
import { Oddities } from './oddPlan'
import { Signs } from './signs'
import { seedOf } from './oddPlan'
import { Rain } from './rain'
import { RoadPath } from './roadPath'
import { pickMood } from './routeMoods'
import { RoadRiders, type RoadRider } from './roadRiders'
import { RouteCam } from './routeCam'
import { Skyline } from './skyline'
import { TerrainGrid } from './terrainGrid'

export type { RoadRider } from './roadRiders'

const R = VIS.route
const AHEAD: Record<Level, 'aheadPotato' | 'aheadLow' | 'aheadMedium' | 'aheadHigh'> = {
  potato: 'aheadPotato',
  low: 'aheadLow',
  medium: 'aheadMedium',
  high: 'aheadHigh',
}
/** Move the floating origin once the rider is this far from it; shadow box half-size and sun distance. */
const RECENTRE_M = 300
const SHADOW_HALF = 26
const SUN_DIST = 80

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
  quality: Quality
  readonly field: HeightField
  readonly chunks: Chunks
  readonly riders: RoadRiders
  readonly odd: Oddities
  private landmarks: Map<number, Landmark[]>
  private lifePlan: LifePlan
  private life: Life
  private things: { sign: Map<number, FunSign[]>; chalk: Map<number, Chalk[]> }
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
  private rain = new Rain()
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    host.prepend(this.renderer.domElement)
    const terrain = route.points[0].lat === undefined ? undefined : route.terrain
    this.seed = seedOf(route.id)
    const path = new RoadPath(route, terrain)
    this.field = new HeightField(path, terrain && new TerrainGrid(terrain))
    // Map features share the height grid's origin, so they are only usable alongside it.
    const cover = new LandCover(terrain, route.region)
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
    this.lifePlan = new LifePlan(route.id, this.field, cover, features)
    this.life = new Life(this.lifePlan, path, this.chunks.height)
    path.poseAt(0, this.riders.me)
    const k = this.key
    k.castShadow = true
    k.shadow.mapSize.set(1536, 1536)
    const c = k.shadow.camera
    c.left = c.bottom = -SHADOW_HALF
    c.right = c.top = SHADOW_HALF
    c.near = 1
    c.far = SUN_DIST * 2
    k.shadow.bias = -0.0004
    k.shadow.normalBias = 0.06
    this.scene.fog = this.fog
    this.root.add(this.chunks.group, this.riders.group, this.life.group, this.skyline.mesh)
    this.scene.add(this.root, this.sky.group, this.rain.lines, k, k.target, this.hemi, this.camera)
    addEventListener('resize', this.resize)
    this.quality = new Quality(this.renderer, () => this.resize())
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
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.quality.frame(dt)
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
    const me = this.riders.me
    const d = this.riders.meD
    this.chunks.update(d, ahead, this.quality.level, all)
    this.life.update(dt, this.t, d, me, this.quality.level)
    if (Math.hypot(me.x - this.ox, me.y - this.oy, me.z - this.oz) > RECENTRE_M) {
      this.ox = Math.round(me.x)
      this.oy = Math.round(me.y)
      this.oz = Math.round(me.z)
      this.root.position.set(-this.ox, -this.oy, -this.oz)
    }
    const { ox, oy, oz } = this
    const { meOffset, meSpeed } = this.riders
    this.rig.update(this.camera, this.field, me, d, meOffset, meSpeed, dt, ox, oy, oz)
    this.sky.update(env, this.t, this.camera.position)
    this.rain.update(mood === 'routeShower', this.camera.position, this.t, dt)
    this.skyline.update(this.field, me.x, me.y, me.z, env, dt)
    const el = THREE.MathUtils.degToRad(env.sunElev)
    const az = THREE.MathUtils.degToRad(env.sunAz)
    this.key.target.position.set(me.x - ox, me.y - oy, me.z - oz)
    this.key.position
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
      .multiplyScalar(SUN_DIST)
      .add(this.key.target.position)
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

  /** Where the next thing of a sort is after `d` metres (optionally of one kind), for the harness. */
  nextThing(sort: string, d: number, kind?: string): number | undefined {
    if (sort === 'life') return this.lifePlan.next(d, kind)?.d
    const map = (this.things as Record<string, Map<number, { d: number }[]> | undefined>)[sort]
    if (map)
      return [...map.values()]
        .flat()
        .map((t) => t.d)
        .filter((t) => t > d)
        .sort((a, b) => a - b)[0]
    for (let at = d, n = 0; n < 400; n++) {
      const o = sort === 'odd' ? this.odd.next(at) : undefined
      if (!o || !kind || o.kind === kind) return o?.d
      at = o.d
    }
    return undefined
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
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
