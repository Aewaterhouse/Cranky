import * as THREE from 'three'
import { groundH } from './ground'
import { makeGeos } from './propGeo'
import { plantGeo } from './route/plantGeo'
import { VC, pick, rand, noise2 } from './util'

export const LOOP = 420
const FRONT = 40
const CAR_COLS = ['#b8412f', '#d8d4c8', '#3f6aa0', '#c8a838', '#5a7a58', '#8a8a90', '#a05a8a']
const GREENS = ['#ffffff', '#e8f0d0', '#d0e8c0', '#f0e8b8', '#c8e0b0']
const WHITE = ['#ffffff']

export interface Spec {
  geo: THREE.BufferGeometry
  /** Lit vertex colours unless given (fairy lights glow with a basic material). */
  mat?: THREE.Material
  n: number
  /** Absolute x range; side picks left, right or both. */
  xr: [number, number]
  side?: -1 | 1
  s?: [number, number]
  yaw?: (side: number) => number
  tint?: string[]
  /** Fixed spacing along the road (lattice) instead of random placement. */
  gap?: number
  show?: (wz: number) => boolean
  wild?: boolean
  sink?: number
  /** Ruins, wrecks and burnt trees: hidden on a date. */
  grim?: boolean
}

/** One kind of roadside thing, instanced, each one sent back `LOOP` m once it passes the camera. */
export class Scatter {
  mesh: THREE.InstancedMesh
  private z: Float32Array
  private sides: Int8Array
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private c = new THREE.Color()

  constructor(
    readonly spec: Spec,
    dist: number,
  ) {
    this.mesh = new THREE.InstancedMesh(spec.geo, spec.mat ?? VC, spec.n)
    this.mesh.frustumCulled = false
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spec.n * 3), 3)
    this.z = new Float32Array(spec.n)
    this.sides = new Int8Array(spec.n)
    for (let i = 0; i < spec.n; i++) {
      this.z[i] = FRONT - (spec.gap ? i * spec.gap : rand(0, LOOP))
      this.place(i, dist)
    }
  }

  private place(i: number, dist: number) {
    const sp = this.spec
    const side = sp.side ?? (Math.random() < 0.5 ? -1 : 1)
    this.sides[i] = side
    const z = this.z[i]
    const x = side * (sp.gap ? sp.xr[0] : rand(sp.xr[0], sp.xr[1]))
    const sc = sp.s ? rand(sp.s[0], sp.s[1]) : 1
    const y = groundH(x, z - dist) - (sp.sink ?? 0)
    const vis = !sp.show || sp.show(z - dist)
    let yaw = sp.yaw ? sp.yaw(side) : rand(0, 6.28)
    let roll = 0
    let lift = 0
    if (sp.wild && Math.random() < 0.18) {
      roll = Math.random() < 0.4 ? Math.PI : rand(-0.25, 0.25)
      lift = roll === Math.PI ? 1.1 : 0
      if (roll === Math.PI) yaw += 0.2
    }
    this.e.set(0, yaw, roll)
    this.q.setFromEuler(this.e)
    this.m.compose(
      new THREE.Vector3(x, y + lift, z),
      this.q,
      new THREE.Vector3().setScalar(vis ? sc : 0),
    )
    this.mesh.setMatrixAt(i, this.m)
    this.c.set(pick(sp.tint ?? WHITE)).multiplyScalar(rand(0.85, 1.1))
    this.mesh.setColorAt(i, this.c)
    this.mesh.instanceColor!.needsUpdate = true
  }

  update(dz: number, dist: number) {
    const arr = this.mesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < this.z.length; i++) {
      this.z[i] += dz
      if (this.z[i] > FRONT) {
        this.z[i] -= LOOP
        this.place(i, dist)
      } else arr[i * 16 + 14] = this.z[i]
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

const along = () => (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.15, 0.15)
const vehicleYaw = () => (Math.random() < 0.3 ? rand(0.8, 2.3) : along())
const fenceRun = (wz: number) => noise2(wz * 0.012, 3) > 0.45

/** Roadside scenery: instanced, scrolling past with the driven distance. */
export class Props {
  group = new THREE.Group()
  private sets: Scatter[]

  constructor(dist: number) {
    const g = makeGeos(40)
    const specs: Spec[] = [
      { geo: g.live, n: 70, xr: [12, 70], s: [0.8, 1.6], tint: GREENS },
      { geo: g.pine, n: 16, xr: [14, 90], s: [0.9, 1.8], tint: GREENS },
      { geo: plantGeo('gum'), n: 34, xr: [12, 90], s: [0.55, 1], tint: GREENS },
      { geo: plantGeo('scribbly'), n: 24, xr: [10, 60], s: [0.8, 1.3], tint: GREENS },
      { geo: g.dead, n: 36, xr: [9, 50], s: [0.8, 1.4], grim: true },
      { geo: g.bush, n: 70, xr: [8.8, 40], s: [0.7, 1.5], tint: GREENS },
      { geo: g.rock, n: 50, xr: [8.5, 60], s: [0.6, 2.2], sink: 0.1 },
      {
        geo: g.sedan,
        n: 7,
        xr: [5.8, 13],
        s: [1, 1],
        yaw: vehicleYaw,
        tint: CAR_COLS,
        wild: true,
        grim: true,
      },
      {
        geo: g.ute,
        n: 5,
        xr: [5.8, 13],
        s: [1, 1],
        yaw: vehicleYaw,
        tint: CAR_COLS,
        wild: true,
        grim: true,
      },
      {
        geo: g.van,
        n: 3,
        xr: [6.2, 12],
        s: [1, 1],
        yaw: vehicleYaw,
        tint: CAR_COLS,
        wild: true,
        grim: true,
      },
      { geo: g.junk, n: 9, xr: [8.8, 14], s: [1, 1.2], grim: true },
      { geo: g.pole, n: 11, xr: [10.5, 0], side: -1, gap: 40, yaw: () => 0 },
      { geo: g.pylon, n: 4, xr: [60, 0], side: 1, gap: LOOP / 4, yaw: () => 0, s: [1.2, 1.2] },
      {
        geo: g.fence,
        n: 100,
        xr: [9.8, 0],
        side: 1,
        gap: 4.2,
        yaw: () => Math.PI / 2,
        show: fenceRun,
      },
      {
        geo: g.fence,
        n: 100,
        xr: [9.8, 0],
        side: -1,
        gap: 4.2,
        yaw: () => Math.PI / 2,
        show: (w) => noise2(w * 0.012, 9) > 0.55,
      },
      {
        geo: g.ruin,
        n: 7,
        xr: [14, 40],
        yaw: (s) => (s > 0 ? -0.2 : 0.2) + rand(-0.3, 0.3),
        tint: ['#ffffff', '#e0d0c0'],
        grim: true,
      },
      { geo: g.warn, n: 8, xr: [8.6, 9.6], yaw: () => rand(-0.2, 0.2) },
      { geo: g.green, n: 4, xr: [8.8, 9.6], yaw: () => rand(-0.15, 0.15) },
      { geo: g.stop, n: 3, xr: [8.6, 9.4], yaw: () => rand(-0.3, 0.3) },
      { geo: g.roo, n: 3, xr: [8.6, 9.4], yaw: () => rand(-0.2, 0.2) },
      { geo: g.wombat, n: 2, xr: [8.6, 9.4], yaw: () => rand(-0.2, 0.2) },
    ]
    this.sets = specs.map((s) => new Scatter(s, dist))
    this.sets.forEach((s) => this.group.add(s.mesh))
  }

  update(dz: number, dist: number, date = false) {
    for (const s of this.sets) {
      s.mesh.visible = !(date && s.spec.grim)
      s.update(dz, dist)
    }
  }
}
