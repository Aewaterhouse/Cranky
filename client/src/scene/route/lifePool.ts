import * as THREE from 'three'
import { VC } from '../util'
import { FUN } from './funVis'
import { LIFE_GEO } from './lifeGeo'
import type { LifeKind } from './lifePlan'

const L = FUN.life
const mat = new THREE.Matrix4()
const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const flap = new THREE.Quaternion()
const scale = new THREE.Vector3()
const euler = new THREE.Euler()
const tint = new THREE.Color()
const Z = new THREE.Vector3(0, 0, 1)

/**
 * One instanced mesh per animal or vehicle shape, made once and refilled every frame: `begin`, any number of
 * `put` and `bird`, then `end`. Nothing is allocated while drawing; what does not fit is left out.
 */
export class LifePool {
  group = new THREE.Group()
  private pools = new Map<string, THREE.InstancedMesh>()
  private counts = new Map<string, number>()

  constructor() {
    for (const [name, make] of Object.entries(LIFE_GEO)) {
      const kind = name.replace(/Wing|Tow/, '') as LifeKind
      const cap = L.kinds[kind].max * L.herdsShown * (name.endsWith('Wing') ? 2 : 1)
      const m = new THREE.InstancedMesh(make(), VC, Math.ceil(cap * L.duskMobs))
      m.frustumCulled = false
      m.castShadow = !name.endsWith('Wing')
      m.count = 0
      this.pools.set(name, m)
      this.group.add(m)
    }
  }

  begin() {
    this.counts.clear()
  }

  end() {
    for (const [name, m] of this.pools) {
      m.count = this.counts.get(name) ?? 0
      m.instanceMatrix.needsUpdate = true
    }
  }

  /** One `name` at (x, y, z) in route metres, turned `yaw`, tipped `pitch` (nose down positive) and rolled. */
  put(name: string, x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0) {
    const m = this.pools.get(name)!
    const n = this.counts.get(name) ?? 0
    if (n >= m.instanceMatrix.count) return
    quat.setFromEuler(euler.set(pitch, yaw, roll, 'YXZ'))
    m.setMatrixAt(n, mat.compose(pos.set(x, y, z), quat, scale.setScalar(1)))
    this.counts.set(name, n + 1)
  }

  /** A bird and both its wings, `beat` radians above level (negative folds them down). */
  bird(kind: string, x: number, y: number, z: number, yaw: number, pitch: number, beat: number) {
    this.put(kind, x, y, z, yaw, pitch)
    const name = `${kind}Wing`
    const m = this.pools.get(name)!
    const n = this.counts.get(name) ?? 0
    if (n + 2 > m.instanceMatrix.count) return
    for (let s = 0; s < 2; s++) {
      quat.setFromEuler(euler.set(pitch, yaw + s * Math.PI, 0, 'YXZ'))
      quat.multiply(flap.setFromAxisAngle(Z, beat))
      m.setMatrixAt(n + s, mat.compose(pos.set(x, y + 0.05, z), quat, scale.setScalar(1)))
    }
    this.counts.set(name, n + 2)
  }

  /** Paints the (single) vehicle of a kind. */
  paint(name: string, colour: string) {
    const m = this.pools.get(name)!
    m.setColorAt(0, tint.set(colour))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }

  dispose() {
    for (const m of this.pools.values()) {
      m.geometry.dispose()
      m.dispose()
    }
  }
}
