import * as THREE from 'three'
import { VIS } from './params'
import { pick, smooth, rand } from './util'

const SKIN = ['#7fa65a', '#8fb070', '#6f9a58', '#a0b080', '#7a9a8a', '#9aa86a', '#8a9a60']
const CLOTH = [
  '#5a4a6a',
  '#6a3a3a',
  '#3a4a5a',
  '#7a6a3a',
  '#4a5a4a',
  '#8a8a8a',
  '#3a3a44',
  '#a05a3a',
  '#c8c0a8',
  '#2f6f8f',
]
const PANTS = ['#2a2d3a', '#3a3a2a', '#4a3a30', '#2a3a4a', '#5a5a5a']
const EYE = '#ff3a2a'

interface Z {
  x: number
  z: number
  ph: number
  sp: number
  sc: number
  yaw: number
  runner: boolean
  cling: number
  /** Thrown by an impact: velocity, time since launch. */
  fly: { v: THREE.Vector3; t: number; spin: number } | null
  cloth: THREE.Color
}

const tint = (m: THREE.InstancedMesh, i: number, c: THREE.Color) => m.setColorAt(i, c)

/** Instanced shambling horde. Origin is the front-centre of the pack; it extends towards +z. */
export class Horde {
  group = new THREE.Group()
  private parts: THREE.InstancedMesh[]
  private zs: Z[] = []
  private B = new THREE.Matrix4()
  private L = new THREE.Matrix4()
  private M = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private p = new THREE.Vector3()
  private s = new THREE.Vector3()
  /** Extra forward lunge on impact, decays to 0. */
  swarm = 0
  dust: { x: number; z: number }[] = []

  constructor(n = VIS.hordeSize) {
    const mat = () => new THREE.MeshLambertMaterial({ flatShading: true })
    const g = (w: number, h: number, d: number, y = 0, z = 0) =>
      new THREE.BoxGeometry(w, h, d).translate(0, y, z)
    this.parts = [
      new THREE.InstancedMesh(g(0.5, 0.66, 0.3, 0.33), mat(), n),
      new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.14, 0),
        mat(),
        n,
      ),
      new THREE.InstancedMesh(g(0.13, 0.6, 0.13, -0.27), mat(), n),
      new THREE.InstancedMesh(g(0.13, 0.6, 0.13, -0.27), mat(), n),
      new THREE.InstancedMesh(g(0.17, 0.72, 0.17, -0.36), mat(), n),
      new THREE.InstancedMesh(g(0.17, 0.72, 0.17, -0.36), mat(), n),
      new THREE.InstancedMesh(
        g(0.07, 0.05, 0.03, 0.17, -0.19),
        new THREE.MeshBasicMaterial({ color: EYE }),
        n * 2,
      ),
    ]
    const col = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const runner = i < 10
      const cling = i >= 10 && i < 22 ? i - 10 + 1 : 0
      const r = Math.pow(Math.random(), 1.5)
      const z = runner ? rand(-5, 1) : r * 30
      const spread = 3.5 + z * 0.12
      const sc = rand(0.85, 1.2) * (Math.random() < 0.06 ? 1.35 : 1)
      const cloth = new THREE.Color(pick(CLOTH))
      this.zs.push({
        x: (Math.random() - 0.5) * 2 * Math.min(spread, 6.2),
        z,
        ph: Math.random() * 6.28,
        sp: runner ? rand(1.4, 1.7) : rand(0.75, 1.25),
        sc,
        yaw: rand(-0.4, 0.4),
        runner,
        cling,
        fly: null,
        cloth,
      })
      const skin = col.set(pick(SKIN)).multiplyScalar(rand(0.8, 1.1)).clone()
      tint(this.parts[0], i, cloth.clone().multiplyScalar(rand(0.8, 1.1)))
      tint(this.parts[1], i, skin)
      tint(this.parts[2], i, Math.random() < 0.5 ? skin : cloth)
      tint(this.parts[3], i, Math.random() < 0.5 ? skin : cloth)
      const pants = col.set(pick(PANTS)).clone()
      tint(this.parts[4], i, pants)
      tint(this.parts[5], i, pants)
    }
    this.parts[6].instanceColor = null
    for (const p of this.parts) {
      p.castShadow = p === this.parts[0] || p === this.parts[4]
      p.frustumCulled = false
      this.group.add(p)
    }
  }

  /** Throws the zombies closest to the bus into the air. */
  launch(count = 28) {
    this.swarm = 1
    const near = this.zs
      .filter((z) => !z.fly && !z.runner)
      .sort((a, b) => a.z - b.z)
      .slice(0, count)
    for (const z of near)
      z.fly = {
        v: new THREE.Vector3(rand(-5, 5), rand(5, 9), rand(6, 14)),
        t: 0,
        spin: rand(-6, 6),
      }
  }

  update(t: number, dt: number, gap: number) {
    const reach = 1 - smooth(4, 38, gap)
    const clingK = 1 - smooth(0, 16, gap)
    this.swarm = Math.max(0, this.swarm - dt * 1.2)
    const lunge = Math.sin(this.swarm * Math.PI) * 3
    this.dust.length = 0
    const { B, L, M, p, s, q, e } = this
    let k = 0
    this.zs.forEach((z, i) => {
      let x = z.x + Math.sin(t * 0.7 + z.ph) * 0.35
      let zz = z.z - (z.runner ? 0 : lunge * 0.5) - (z.runner ? lunge : 0)
      let y = Math.abs(Math.sin(t * 5 * z.sp + z.ph)) * 0.14 * (z.runner ? 1.6 : 1)
      let lean = -0.18 - (z.runner ? 0.25 : 0) - reach * 0.12
      let roll = Math.sin(t * 5 * z.sp + z.ph) * 0.1
      let arm = 1.15 + reach * 0.35 + Math.sin(t * 3 + z.ph) * 0.12
      let yaw = z.yaw + Math.sin(t * 1.3 + z.ph) * 0.15
      let legAmp = z.runner ? 0.95 : 0.55
      const ck = z.cling && clingK > 0.02 ? clingK : 0
      if (ck) {
        const side = (z.cling % 3) - 1
        const bx = side * 1.5 + (side === 0 ? (z.cling % 2 ? -0.6 : 0.6) : 0)
        const bz = side === 0 ? -0.2 : -(z.cling % 4) * 0.8 - 0.4 - z.z * 0
        x += (bx - x) * ck
        zz += (bz - zz) * ck
        y += (0.5 + (z.cling % 4) * 0.45 - y) * ck
        arm += (2.6 - arm) * ck
        lean += (-0.1 - lean) * ck
        yaw += (side * 0.9 * -1 - yaw) * ck * (side === 0 ? 0 : 1)
        legAmp *= 1 - ck * 0.8
      }
      if (z.fly) {
        const f = z.fly
        f.t += dt
        x += f.v.x * f.t * 0.7
        zz += f.v.z * f.t * 0.7
        y = Math.max(0, f.v.y * f.t - 11 * f.t * f.t)
        lean = -1.3 + f.spin * f.t * 0.4
        roll = f.spin * f.t * 0.5
        arm = 2.4
        if (f.t > 1.4) z.fly = null
      }
      const sw = Math.sin(t * 5 * z.sp + z.ph)
      p.set(x, y, zz)
      e.set(lean, yaw, roll)
      q.setFromEuler(e)
      s.setScalar(z.sc)
      B.compose(p, q, s)
      this.part(0, i, B, 0, 0.62, 0, 0)
      this.part(1, i, B, 0, 1.38, -0.02, Math.sin(t * 2 + z.ph) * 0.3 - 0.25 + reach * 0.15)
      this.part(2, i, B, -0.33, 1.2, 0, arm + Math.sin(t * 4 + z.ph) * 0.15)
      this.part(3, i, B, 0.33, 1.2, 0, arm + Math.sin(t * 4 + z.ph + 2) * 0.15 + 0.1)
      this.part(4, i, B, -0.13, 0.65, 0, sw * legAmp)
      this.part(5, i, B, 0.13, 0.65, 0, -sw * legAmp)
      // glowing eyes ride on the head
      for (const sx of [-0.08, 0.08]) {
        L.makeRotationX(Math.sin(t * 2 + z.ph) * 0.3 - 0.25 + reach * 0.15).setPosition(
          0,
          1.38,
          -0.02,
        )
        M.multiplyMatrices(B, L)
        L.makeTranslation(sx, 0, 0)
        M.multiply(L)
        this.parts[6].setMatrixAt(k++, M)
      }
      if (i % 9 === 0 && !z.fly && !ck) this.dust.push({ x, z: zz })
    })
    for (const m of this.parts) m.instanceMatrix.needsUpdate = true
    for (const m of this.parts.slice(0, 6)) if (m.instanceColor) m.instanceColor.needsUpdate = true
  }

  private part(
    idx: number,
    i: number,
    B: THREE.Matrix4,
    px: number,
    py: number,
    pz: number,
    rx: number,
  ) {
    this.L.makeRotationX(rx).setPosition(px, py, pz)
    this.M.multiplyMatrices(B, this.L)
    this.parts[idx].setMatrixAt(i, this.M)
  }
}
