import * as THREE from 'three'
import type { Look } from '../../core/cosmetics'
import type { ClimateState } from '../../net/protocol'
import type { SceneState } from '../world'
import { makeRider } from '../riders'
import { clamp, lerp } from '../util'
import { TOPS, seawall, station, townLand, type Fuel } from './townGeo'
import { TownWater } from './townWater'

/** Tunables for the Climate Lawsuit town (debug panel on /town-dev.html?debug=1). */
export const TOWN = {
  /** Sea level 0..1 at which each flood stage starts: beach, surf club, Main Street, everything. */
  stages: [0.15, 0.4, 0.65, 1],
  /** Water height (m) at level 0 and at each stage. */
  heights: [0.2, 1.5, 3.1, 5.1, 8.9],
  camHeight: 34,
  camDist: 86,
  camSway: 26,
  fov: 42,
  sea: '#2f7fb8',
  seaOpacity: 0.86,
  sky: '#9fd8ff',
  storm: '#59656f',
  rise: 0.6,
  wallStep: 1.3,
  shiftX: 0.1,
}

export interface TownRider {
  id: string
  name: string
  fuel: Fuel
  cadence: number
  look?: Look
}
export interface TownState {
  /** Shared sea level, 0 (1980) to 1 (everything under). */
  level: number
  /** Seawalls bought so far. */
  walls: number
  riders: TownRider[]
}

const COLOURS = ['#e94f37', '#3f88c5', '#44bba4', '#f6ae2d', '#9b5de5', '#f15bb5']
const SMOKE = 5

/** Water height in metres for a sea level, piecewise between the stage heights. */
export function waterY(level: number) {
  const xs = [0, ...TOWN.stages]
  const l = clamp(level)
  const i = Math.min(xs.findIndex((x, k) => k > 0 && l <= x) - 1, xs.length - 2)
  return lerp(TOWN.heights[i], TOWN.heights[i + 1], (l - xs[i]) / (xs[i + 1] - xs[i]))
}

interface Plant {
  root: THREE.Group
  rider: ReturnType<typeof makeRider>
  fuel?: Fuel
  built?: ReturnType<typeof station>
  smoke: THREE.Mesh[]
  seed: number
}

/** The coastal town diorama: a power station and rider per company, and a sea that rises with emissions. */
export class TownWorld {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(TOWN.fov, 1, 1, 600)
  town: TownState = { level: 0, walls: 0, riders: [] }
  private water = new TownWater()
  private wall = seawall()
  private plants = new Map<string, Plant>()
  private y = TOWN.heights[0]
  private t = 0
  private last = performance.now()
  private raf = 0
  private bg = new THREE.Color()
  private ro: ResizeObserver

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.shadowMap.enabled = true
    host.append(this.renderer.domElement)
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6a7a5a', 1.5))
    const sun = new THREE.DirectionalLight('#fff2d8', 2.2)
    sun.position.set(40, 70, 60)
    sun.castShadow = true
    sun.shadow.camera.left = sun.shadow.camera.bottom = -70
    sun.shadow.camera.right = sun.shadow.camera.top = 70
    sun.shadow.camera.far = 220
    sun.shadow.mapSize.set(2048, 2048)
    this.scene.add(sun, townLand())
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: '#c8b98a' }),
    )
    bed.rotation.x = -Math.PI / 2
    bed.position.y = -0.6
    this.wall.group.position.set(0, 0, 36.5)
    this.scene.add(bed, this.water.group, this.wall.group)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      const now = performance.now()
      this.update(Math.min(0.1, (now - this.last) / 1000))
      this.last = now
    }
    loop()
  }

  private resize() {
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    // Slide the town right of centre, clear of the game panel on the left.
    this.camera.setViewOffset(w, h, -w * TOWN.shiftX, 0, w, h)
  }

  private plant(r: TownRider, i: number, n: number) {
    let p = this.plants.get(r.id)
    if (!p) {
      const root = new THREE.Group()
      const rider = makeRider(COLOURS[this.plants.size % COLOURS.length], r.id)
      rider.root.position.set(0, 0, 5.5)
      rider.root.scale.setScalar(1.5)
      rider.root.rotation.y = Math.PI
      const mat = new THREE.MeshLambertMaterial({ color: '#2a2624', transparent: true })
      const smoke = Array.from({ length: SMOKE }, () => {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat.clone())
        root.add(s)
        return s
      })
      root.add(rider.root)
      this.scene.add(root)
      p = { root, rider, smoke, seed: Math.random() * 6.28 }
      this.plants.set(r.id, p)
    }
    p.root.position.set((i - (n - 1) / 2) * Math.min(22, 88 / n), TOPS.ridge, -44)
    p.root.scale.setScalar(1.7)
    if (p.fuel !== r.fuel) {
      if (p.built) p.root.remove(p.built.group)
      p.built = station(r.fuel)
      p.fuel = r.fuel
      p.root.add(p.built.group)
    }
    return p
  }

  private update(dt: number) {
    this.t += dt
    const s = this.town
    const t = this.t
    this.y = lerp(this.y, waterY(s.level), clamp(dt * TOWN.rise))
    this.water.mat.color.set(TOWN.sea)
    this.water.mat.opacity = TOWN.seaOpacity
    this.water.update(t, this.y, s.level, s.walls)
    this.wall.group.visible = s.walls > 0
    // A wall is a delay, not a fix: it always stands just proud of whatever the sea has got to.
    const wh = Math.max(s.walls * TOWN.wallStep, this.y + 0.7)
    this.wall.wall.scale.y = wh
    this.wall.top.position.y = wh - 1
    this.scene.background = this.bg.set(TOWN.sky).lerp(new THREE.Color(TOWN.storm), clamp(s.level))
    const ids = new Set(s.riders.map((r) => r.id))
    for (const [id, p] of this.plants)
      if (!ids.has(id)) {
        this.scene.remove(p.root)
        this.plants.delete(id)
      }
    s.riders.forEach((r, i) => {
      const p = this.plant(r, i, s.riders.length)
      p.rider.label(r.name, 1, 'riding', null, null)
      p.rider.setLook(r.look)
      p.rider.pose('ride', t * (r.cadence / 60) * Math.PI * 2 + p.seed, 0)
      const coal = r.fuel === 'coal'
      p.smoke.forEach((m, k) => {
        const u = (t * 0.25 + k / SMOKE + p.seed) % 1
        m.visible = coal
        m.position.set(1 + (k % 2) * 2.2 + u * 5, 9 + u * 11, u * 2)
        m.scale.setScalar(0.8 + u * 2.6)
        ;(m.material as THREE.Material).opacity = 0.85 * (1 - u)
      })
      for (const o of p.built?.spin ?? [])
        if (r.fuel === 'wind') o.rotation.z = t * 2.2 + p.seed
        else o.scale.set(1, 0.8 + Math.sin(t * 13 + p.seed) * 0.25, 1)
    })
    this.camera.fov = TOWN.fov
    this.camera.position.set(Math.sin(t * 0.07) * TOWN.camSway, TOWN.camHeight, TOWN.camDist)
    this.camera.lookAt(0, 7, -14)
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
  }

  /** The ride screen hands every scene the same state; the town takes its riders and the game's own state. */
  set state(s: SceneState) {
    const g = s.game as unknown as ClimateState | null | undefined
    this.town = {
      level: g?.level ?? 0,
      walls: g?.walls ?? 0,
      riders: s.riders.map((r) => ({
        id: r.id,
        name: g?.cos[r.id]?.name ?? r.name,
        fuel: g?.cos[r.id]?.fuel ?? 'coal',
        cadence: r.st === 'riding' ? r.cadence : 0,
        look: r.look,
      })),
    }
  }
  fx() {}
  cycleView = () => null

  /** A still of the current frame, for the postcard. */
  snapshot = () => this.renderer.domElement.toDataURL('image/jpeg', 0.85)

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
