import * as THREE from 'three'
import { VIS } from './params'

/** Instanced shambling crowd. Origin is the front of the horde; it extends towards +z. */
export class Horde {
  group = new THREE.Group()
  private parts: THREE.InstancedMesh[]
  private seeds: { x: number; z: number; ph: number; sp: number }[] = []
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()

  constructor(n = VIS.hordeSize) {
    const skin = new THREE.MeshLambertMaterial({ color: '#7fa65a' })
    const cloth = new THREE.MeshLambertMaterial({ color: '#5a4a6a' })
    const geo = (w: number, h: number, d: number, y: number, z = 0) => new THREE.BoxGeometry(w, h, d).translate(0, y, z)
    this.parts = [
      new THREE.InstancedMesh(geo(0.6, 1.1, 0.35, 0.95), cloth, n),
      new THREE.InstancedMesh(geo(0.4, 0.4, 0.4, 1.75), skin, n),
      new THREE.InstancedMesh(geo(0.55, 0.14, 0.7, 1.35, -0.45), skin, n),
    ]
    for (const p of this.parts) this.group.add(p)
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(Math.random())
      this.seeds.push({ x: (Math.random() - 0.5) * 11, z: r * 26, ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.6 })
    }
  }

  update(t: number) {
    this.seeds.forEach((s, i) => {
      const bob = Math.abs(Math.sin(t * 6 * s.sp + s.ph)) * 0.18
      this.e.set(-0.25 + Math.sin(t * 3 + s.ph) * 0.08, Math.sin(t * 1.3 + s.ph) * 0.3, Math.sin(t * 6 * s.sp + s.ph) * 0.12)
      this.q.setFromEuler(this.e)
      this.m.compose(new THREE.Vector3(s.x + Math.sin(t * 0.7 + s.ph) * 0.4, bob, s.z), this.q, new THREE.Vector3(1, 1, 1))
      for (const p of this.parts) p.setMatrixAt(i, this.m)
    })
    for (const p of this.parts) p.instanceMatrix.needsUpdate = true
  }
}
