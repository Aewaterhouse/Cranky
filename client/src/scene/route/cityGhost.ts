import * as THREE from 'three'
import { hash } from '../math'
import type { Env } from '../moods'
import { VIS } from '../params'
import { Mesher, box, cone, cyl } from '../util'
import type { HeightField } from './heightField'
import { project } from './roadPath'

const R = VIS.route
const G = R.ghostCity
/** A city: centre, ground height, spread (m), towers, the tallest (m) and any famous ones: [east, north, h, top]. */
interface City {
  lat: number
  lon: number
  ground: number
  spread: number
  towers: number
  tallest: number
  famous: [number, number, number, string][]
}
const BRISBANE: City = {
  lat: -27.4689,
  lon: 153.0235,
  ground: 20,
  spread: 900,
  towers: 70,
  tallest: 200,
  famous: [
    [80, 120, 270, '#d8d4c8'],
    [-150, 60, 260, '#d8d4c8'],
  ],
}
/** The cities each route can really see: Brisbane from Coot-tha, Melbourne across the bay, Hobart below kunanyi. */
const SEEN: Record<string, City> = {
  'mount-coot-tha': BRISBANE,
  'mount-coot-tha-back': BRISBANE,
  mondo: BRISBANE,
  'beach-road': {
    lat: -37.815,
    lon: 144.965,
    ground: 10,
    spread: 1300,
    towers: 90,
    tallest: 220,
    famous: [
      [-150, -700, 297, '#e8b840'],
      [150, 250, 260, '#d8d4c8'],
    ],
  },
  'mount-wellington': {
    lat: -42.8826,
    lon: 147.3257,
    ground: 10,
    spread: 700,
    towers: 45,
    tallest: 55,
    famous: [[300, 200, 75, '#d8d4c8']],
  },
}

/**
 * A ghost skyline (the bus world's trick, placed for real): the city at its true bearing and apparent size,
 * shrunk towards the rider to sit just inside the ring of hills, shown only while the ground in between
 * leaves its top in sight. Flat-tinted with the haze; its windows light up at dusk.
 */
export class CityGhost {
  readonly group = new THREE.Group()
  private at = new THREE.Vector3()
  /** Top of the tallest tower and the city's spread (m), and where the line of sight was last checked from. */
  private top = 0
  private spread = 0
  private lx = Infinity
  private lz = Infinity
  private mat = new THREE.MeshBasicMaterial({ fog: false, vertexColors: true })
  private lit = new THREE.MeshBasicMaterial({ color: G.glow, fog: false, transparent: true })

  constructor(id: string, origin?: { lat0: number; lon0: number }) {
    const c = SEEN[id]
    this.group.visible = false
    if (!c || !origin) return
    const [e, n] = project(c.lat, c.lon, origin.lat0, origin.lon0)
    this.at.set(e, c.ground, -n)
    this.top = Math.max(c.tallest, ...c.famous.map((f) => f[2]))
    this.spread = c.spread
    const m = new Mesher(0.08)
    const win = new Mesher(0)
    const tower = (x: number, z: number, w: number, h: number, top?: string) => {
      m.add(box(w, h, w * (0.7 + hash(x) * 0.6)), '#fff', [x, h / 2, z])
      if (top) m.add(cone(w * 0.45, h * 0.12, 4), top, [x, h * 1.06, z], [0, Math.PI / 4, 0])
      else if (hash(z) > 0.6) m.add(cyl(w * 0.15, w * 0.15, h * 0.12, 4), '#fff', [x, h * 1.06, z])
      for (let k = 0; k < h / 12; k++)
        if (hash(x * 3 + k) > 0.55) win.add(box(w * 0.7, 2.5, w * 1.4), '#fff', [x, 6 + k * 11, z])
    }
    for (let i = 0; i < c.towers; i++) {
      // Thick in the middle, thinning out; the tall ones in the middle too.
      const r = c.spread * hash(i * 1.7) ** 1.4
      const a = hash(i * 4.1) * Math.PI * 2
      const h = c.tallest * (0.15 + 0.85 * (1 - r / c.spread) ** 1.5 * hash(i * 2.9))
      tower(Math.cos(a) * r, Math.sin(a) * r, 22 + hash(i * 5.3) * 30, Math.max(12, h))
    }
    for (const [x, z, h, top] of c.famous) tower(x, -z, 34, h, top)
    const city = new THREE.Mesh(m.build(), this.mat)
    const glow = new THREE.Mesh(win.build(), this.lit)
    for (const o of [city, glow]) o.renderOrder = -1
    this.group.add(city, glow)
  }

  /**
   * Call every frame with the rider in world metres. Every `G.lookEvery` m the line of sight is checked: the city
   * shows while its top clears every bit of ground in between (eye `G.eye` m up).
   */
  update(field: HeightField, x: number, y: number, z: number, env: Env) {
    const dx = this.at.x - x
    const dz = this.at.z - z
    const dist = Math.hypot(dx, dz)
    if (!this.top || dist < G.minSee || dist > G.maxSee) return void (this.group.visible = false)
    if (Math.hypot(x - this.lx, z - this.lz) > G.lookEvery) {
      ;[this.lx, this.lz] = [x, z]
      const eye = y + G.eye
      const aim = (this.at.y + this.top * G.boost - eye) / dist
      let clear = true
      for (let r = G.lookFrom; r < Math.min(G.lookTo, dist - this.spread) && clear; r += G.lookStep)
        clear = (field.natural(x + (dx * r) / dist, z + (dz * r) / dist) - eye) / r < aim
      this.group.visible = clear
    }
    if (!this.group.visible) return
    const s = (R.skyR * G.at) / dist
    this.group.position.set(x + dx * s, y + (this.at.y - y) * s, z + dz * s)
    this.group.scale.set(s, s * G.boost, s)
    this.mat.color.copy(env.hill).lerp(env.fog, G.haze).multiplyScalar(G.dark)
    this.lit.opacity = Math.min(1, env.stars * 1.5) * 0.8
    this.group.children[1].visible = env.stars > 0.05
  }
}
