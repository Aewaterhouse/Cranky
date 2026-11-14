import * as THREE from 'three'
import { clamp, hash } from '../math'
import type { Level } from '../quality'
import { VIS } from '../params'
import { VC } from '../util'
import { across, type Tris } from './roadGeo'
import { newPose, type RoadPath } from './roadPath'
import { rng } from './scatter'
import { MOOD } from './routeMoods'

const W = MOOD.wet
const C = MOOD.cloud
const phong = (offset = false) =>
  new THREE.MeshPhongMaterial({
    vertexColors: true,
    flatShading: true,
    polygonOffset: offset,
    specular: 0,
  })
/** Road surfaces: plain, where another stretch overlaps (in front of the ground) and on top (later stretches, side
 * streets). All go dark and shiny in the wet. */
export const ROAD = phong()
export const UNDER = phong(true)
export const STREET = phong(true)
export const PUDDLE = new THREE.MeshPhongMaterial({
  flatShading: true,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -6,
  polygonOffsetUnits: -360,
  shininess: 90,
  specular: '#ffffff',
})

const pose = newPose()
const ring = new Float64Array(30)
const white = new THREE.Color('#ffffff')
/** A chunk's puddles: flat ragged ovals in the lanes, mostly near the edges, seeded by chunk. */
export function buildPuddles(path: RoadPath, k: number, d0: number, out: Tris) {
  const rand = rng(k * 977 + 13)
  for (let n = 0; n < W.puddles; n++) {
    const d = d0 + rand() * 200
    const o = (rand() < 0.5 ? -1 : 1) * (VIS.route.roadHalf - 0.5 - rand() ** 2 * 2.2)
    const len = 1.2 + rand() * 2.4
    const wide = 0.5 + rand() * 0.9
    path.poseAt(d, pose)
    across(pose, o, ring, 0)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const r = 0.75 + hash(k * 31 + n * 7 + i) * 0.4
      path.poseAt(d + (Math.cos(a) * len * r) / 2, pose)
      across(pose, o + (Math.sin(a) * wide * r) / 2, ring, 3 + i * 3)
    }
    for (let i = 0; i < 27; i += 3) ring[i + 1] += 0.02
    for (let i = 0; i < 8; i++) out.add(ring, 0, 3 + i * 3, 3 + ((i + 1) % 8) * 3, white)
  }
}

/** A tileable blotchy noise for the cloud shadows: value noise on a lattice that wraps, two octaves. */
function cloudTexture() {
  const N = 64
  const data = new Uint8Array(N * N * 4)
  const oct = (x: number, y: number, P: number) => {
    const [fx, fy] = [(x / N) * P, (y / N) * P]
    const [ix, iy] = [Math.floor(fx), Math.floor(fy)]
    const s = (t: number) => t * t * (3 - 2 * t)
    const [u, v] = [s(fx - ix), s(fy - iy)]
    const h = (a: number, b: number) => hash((a % P) * 57 + (b % P) * 131 + P)
    const top = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * u
    const bot = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * u
    return top + (bot - top) * v
  }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4
      data[i] = data[i + 1] = data[i + 2] = (oct(x, y, 4) * 0.7 + oct(x, y, 8) * 0.3) * 255
      data[i + 3] = 255
    }
  const tex = new THREE.DataTexture(data, N, N)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

const U = {
  uCloud: { value: 0 },
  uCloudCover: { value: 0.5 },
  uCloudScale: { value: 500 },
  uCloudOff: { value: new THREE.Vector2() },
  tCloud: { value: null as THREE.Texture | null },
}

/** Lets cloud shadows fall on a material, darkening it where the drifting cloud noise is over the world. */
function shadeClouds(m: THREE.Material) {
  m.onBeforeCompile = (s) => {
    U.tCloud.value ??= cloudTexture()
    Object.assign(s.uniforms, U)
    s.vertexShader =
      'varying vec2 vCloud;\n' +
      s.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        cw = instanceMatrix * cw;
        #endif
        vCloud = (modelMatrix * cw).xz;`,
      )
    s.fragmentShader =
      'uniform float uCloud, uCloudCover, uCloudScale; uniform vec2 uCloudOff; uniform sampler2D tCloud; varying vec2 vCloud;\n' +
      s.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uCloud > 0.0) diffuseColor.rgb *= 1.0 - uCloud * smoothstep(uCloudCover, uCloudCover + 0.12,
          texture2D(tCloud, (vCloud + uCloudOff) / uCloudScale).r);`,
      )
  }
}
for (const m of [VC, ROAD, UNDER, STREET]) shadeClouds(m)

/** The free ride's weather on the ground: wet roads, puddles and wheel spray in a shower, cloud shadows when sunny. */
export class Weather {
  /** 0 bone dry .. 1 soaked. */
  wet = 0
  private cloud = 0
  readonly spray: THREE.Points
  private p: Float32Array
  private v: Float32Array
  private age: Float32Array
  private next = 0
  private owed = 0

  constructor() {
    const n = W.spray
    this.p = new Float32Array(n * 3).fill(-1e4)
    this.v = new Float32Array(n * 3)
    this.age = new Float32Array(n).fill(9)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3))
    const mat = new THREE.PointsMaterial({ size: 0.1, transparent: true, depthWrite: false })
    this.spray = new THREE.Points(geo, mat)
    this.spray.frustumCulled = false
  }

  /**
   * `riders` are the rider figures (in route metres, facing their way), all riding at about `speed` m/s;
   * (ox, oz) is the floating origin.
   */
  update(
    mood: string,
    level: Level,
    dt: number,
    t: number,
    riders: THREE.Object3D[],
    speed: number,
    ox: number,
    oz: number,
  ) {
    const rain = mood === 'routeShower'
    this.wet = clamp(this.wet + dt / (rain ? W.inS : -W.outS))
    const w = this.wet
    for (const m of [ROAD, UNDER, STREET]) {
      m.color.lerpColors(white, tint.set(W.tint), w)
      m.specular.setScalar(0).lerp(tint.set(W.spec), w)
      m.shininess = W.shine
    }
    PUDDLE.visible = w > 0.02
    PUDDLE.opacity = w * 0.85
    PUDDLE.color.set(W.puddle)
    const lite = level === 'potato' || level === 'lowpower'
    const sunny = (mood === 'route' || mood === 'routeGolden') && !lite
    this.cloud = clamp(this.cloud + dt * (sunny ? 0.2 : -0.2))
    U.uCloud.value = this.cloud * C.shade
    U.uCloudCover.value = C.cover
    U.uCloudScale.value = C.scale
    U.uCloudOff.value.set(ox + C.windX * t, oz + C.windZ * t)
    this.splash(lite ? 0 : w, dt, riders, speed)
  }

  private splash(w: number, dt: number, riders: THREE.Object3D[], speed: number) {
    const { p, v, age } = this
    const n = age.length
    const mat = this.spray.material as THREE.PointsMaterial
    mat.color.set(W.sprayTint)
    mat.opacity = 0.75
    this.owed += W.rate * w * clamp(speed / 8) * dt * riders.length
    for (; this.owed >= 1; this.owed--) {
      const r = riders[Math.floor(Math.random() * riders.length)]
      const a = r.rotation.y
      const [bx, bz] = [Math.sin(a), Math.cos(a)]
      const side = (Math.random() - 0.5) * 1.2
      const i = this.next
      this.next = (i + 1) % n
      age[i] = 0
      p[i * 3] = r.position.x + bx * 0.55
      p[i * 3 + 1] = r.position.y + 0.1
      p[i * 3 + 2] = r.position.z + bz * 0.55
      v[i * 3] = -bx * speed * W.carry - bz * side
      v[i * 3 + 1] = 1 + Math.random() * 1.6
      v[i * 3 + 2] = -bz * speed * W.carry + bx * side
    }
    this.spray.visible = w > 0 || age.some((x) => x < 0.6)
    if (!this.spray.visible) return
    for (let i = 0; i < n; i++) {
      age[i] += dt
      if (age[i] > 0.6) {
        p[i * 3 + 1] = -1e4
        continue
      }
      v[i * 3 + 1] -= 9.8 * dt
      for (let k = 0; k < 3; k++) p[i * 3 + k] += v[i * 3 + k] * dt
    }
    this.spray.geometry.attributes.position.needsUpdate = true
  }
}
const tint = new THREE.Color()
