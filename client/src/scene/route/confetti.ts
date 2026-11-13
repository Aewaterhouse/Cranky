import * as THREE from 'three'
import { VIS } from '../params'

const P = VIS.route.party
/** Per piece: position, velocity, spin rate and a phase for the flutter. */
const STRIDE = 8

/** Confetti and streamers for a summit or the finish: one instanced mesh, thrown up and left to flutter down. */
export class Confetti {
  readonly mesh: THREE.InstancedMesh
  private s = new Float32Array(P.count * STRIDE)
  private left = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private v = new THREE.Vector3()
  private sc = new THREE.Vector3()

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false })
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, P.count)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    const c = new THREE.Color()
    for (let i = 0; i < P.count; i++)
      this.mesh.setColorAt(i, c.set(P.colours[i % P.colours.length]))
  }

  /** Throws the lot from around a spot (route metres). */
  burst(x: number, y: number, z: number) {
    const s = this.s
    for (let i = 0; i < P.count; i++) {
      const a = Math.random() * Math.PI * 2
      const out = Math.random() * P.spreadMs
      s.set(
        [
          x + Math.cos(a) * 1.5,
          y + 1 + Math.random() * 2,
          z + Math.sin(a) * 1.5,
          Math.cos(a) * out,
          P.upMs[0] + Math.random() * (P.upMs[1] - P.upMs[0]),
          Math.sin(a) * out,
          (Math.random() - 0.5) * 16,
          Math.random() * 6.28,
        ],
        i * STRIDE,
      )
    }
    this.left = P.secs
    this.mesh.visible = true
  }

  update(dt: number) {
    if (this.left <= 0) return
    this.left -= dt
    if (this.left <= 0) return void (this.mesh.visible = false)
    const s = this.s
    const drag = Math.exp(-dt * P.drag)
    // Pieces shrink away over the last second rather than popping out.
    const fade = Math.min(1, this.left)
    for (let i = 0; i < P.count; i++) {
      const o = i * STRIDE
      s[o + 4] = Math.max(-P.fallMs, s[o + 4] - P.gravity * dt)
      s[o + 3] *= drag
      s[o + 5] *= drag
      s[o + 7] += s[o + 6] * dt
      const sway = Math.sin(s[o + 7]) * P.sway * dt
      s[o] += s[o + 3] * dt + sway
      s[o + 1] += s[o + 4] * dt
      s[o + 2] += s[o + 5] * dt + sway
      // Every `streamerEvery`th piece is a long thin streamer.
      const long = i % P.streamerEvery === 0
      this.sc.set(long ? P.size * 0.4 : P.size, long ? P.size * 7 : P.size * 1.6, 1)
      this.q.setFromEuler(this.e.set(s[o + 7], s[o + 7] * 0.7, long ? s[o + 7] * 0.2 : s[o + 7]))
      this.m.compose(this.v.set(s[o], s[o + 1], s[o + 2]), this.q, this.sc.multiplyScalar(fade))
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
