import * as THREE from 'three'
import { clamp, noise2 } from '../math'
import type { Env } from '../moods'
import { VIS } from '../params'
import { gradMat } from '../sky'
import type { HeightField } from './heightField'

const R = VIS.route
const N = 96
/** The ring looks this many times its own radius out for high ground, and is redrawn after this many metres. */
const LOOK = [0.6, 1, 1.7]
const RESAMPLE_M = 80
const DEPTH = 600

/** Distant hills: a ring of hazy silhouettes round the rider, as tall as the land out there looks from here. */
export class Skyline {
  mesh: THREE.Mesh
  private want = new Float32Array(N + 1)
  private cx = Infinity
  private cz = Infinity
  private first = true

  constructor() {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array((N + 1) * 6)
    const t = new Float32Array((N + 1) * 2)
    const idx: number[] = []
    for (let i = 0; i <= N; i++) {
      t[i * 2 + 1] = 1
      if (i < N) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    g.setIndex(idx)
    this.mesh = new THREE.Mesh(g, gradMat())
    ;(this.mesh.material as THREE.Material).side = THREE.DoubleSide
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
  }

  /** `x, y, z` is the rider in world metres; the mesh sits there and its vertices hold heights relative to it. */
  update(
    field: HeightField,
    x: number,
    y: number,
    z: number,
    env: Env,
    dt: number,
    wet: (x: number, z: number) => boolean,
  ) {
    const mat = this.mesh.material as THREE.ShaderMaterial
    mat.uniforms.top.value.copy(env.hill).lerp(env.fog, 0.3)
    mat.uniforms.bot.value.copy(env.fog)
    this.mesh.position.set(x, y, z)
    if (Math.hypot(x - this.cx, z - this.cz) > RESAMPLE_M) {
      this.cx = x
      this.cz = z
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2
        let top = -Infinity
        let land = false
        for (const k of LOOK) {
          const px = x + Math.sin(a) * R.skyR * k
          const pz = z - Math.cos(a) * R.skyR * k
          top = Math.max(top, (field.natural(px, pz) - y) / k)
          land ||= !wet(px, pz)
        }
        // Out to sea the ring drops to the waterline so the horizon is flat.
        this.want[i] = land ? top + (noise2(i * 0.9, 3) - 0.3) * R.skyJag : R.seaLevel - y - 1
      }
      this.want[N] = this.want[0]
    }
    const p = this.mesh.geometry.attributes.position as THREE.BufferAttribute
    const k = this.first ? 1 : clamp(dt * 1.5)
    this.first = false
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const top = p.getY(i * 2 + 1) + (this.want[i] - p.getY(i * 2 + 1)) * k
      p.setXYZ(i * 2, Math.sin(a) * R.skyR, Math.min(top, 0) - DEPTH, -Math.cos(a) * R.skyR)
      p.setXYZ(i * 2 + 1, Math.sin(a) * R.skyR, top, -Math.cos(a) * R.skyR)
    }
    p.needsUpdate = true
  }
}
