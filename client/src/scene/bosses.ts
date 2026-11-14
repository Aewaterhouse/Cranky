import * as THREE from 'three'
import { ROAD_HALF } from './ground'
import type { Particles } from './particles'
import { VIS } from './params'
import { Mesher, VC, box, clamp, cone, cyl, ico, rand } from './util'

export type BossKind = 'roadtrain' | 'giant' | 'bridge'
/** The boss the server names, as the scene draws it. */
export const bossKind = (name: string): BossKind =>
  /TRAIN/i.test(name) ? 'roadtrain' : /BRIDGE/i.test(name) ? 'bridge' : 'giant'

const B = VIS.boss
const mesh = (m: Mesher) => {
  const o = new THREE.Mesh(m.build(), VC)
  o.castShadow = true
  return o
}
const wheels = (m: Mesher, zs: number[], half = 1.2) => {
  for (const z of zs)
    for (const x of [-half, half])
      m.add(cyl(0.55, 0.55, 0.5, 8), '#1c1c1f', [x, 0.55, z], [0, 0, Math.PI / 2])
}

/** Prime mover, nose to the bus (-z): a spiked bull bar, glowing headlights, twin stacks. */
function cab() {
  const m = new Mesher(0.1)
  m.add(box(2.6, 3.2, 3), B.truck, [0, 2.4, 1.5])
  m.add(box(2.4, 1.6, 2.2), B.truck, [0, 1.6, -0.9])
  m.add(box(2.2, 1, 0.1), '#22303a', [0, 3.2, -0.02])
  m.add(box(2.8, 1.2, 0.3), B.chrome, [0, 1.2, -2.1])
  for (let i = 0; i < 6; i++)
    m.add(cone(0.12, 0.7, 4), B.chrome, [-1.2 + i * 0.48, 1.3, -2.55], [-Math.PI / 2, 0, 0])
  for (const x of [-0.8, 0.8]) m.add(box(0.4, 0.3, 0.1), B.eyes, [x, 1.9, -2.02])
  for (const x of [-1.2, 1.2]) m.add(cyl(0.12, 0.12, 4.4, 6), B.chrome, [x, 3.4, 3.1])
  wheels(m, [-1, 2.2])
  return mesh(m)
}

/** A trailer with zombies riding on the roof. */
function trailer(i: number) {
  const m = new Mesher(0.12)
  m.add(box(2.5, 3, 11), i % 2 ? B.rust : B.truck, [0, 2.6, 5.5])
  m.add(box(2.6, 0.3, 11.2), '#2a2a2a', [0, 1.05, 5.5])
  for (let k = 0; k < 3; k++) {
    const z = 2 + k * 3.5 + i
    m.add(box(0.5, 0.7, 0.3), '#5a4a6a', [(k - 1) * 0.7, 4.5, z])
    m.add(ico(0.22), '#8fb070', [(k - 1) * 0.7, 5.05, z])
    m.add(box(0.12, 0.6, 0.12), '#8fb070', [(k - 1) * 0.7 + 0.25, 5, z - 0.3], [1.3, 0, 0])
  }
  wheels(m, [8.5, 9.8])
  return mesh(m)
}

/** A limb (arm or leg) hanging from its pivot at the origin. */
function limb(w: number, len: number, col: string, foot?: string) {
  const g = new THREE.Group()
  const m = new Mesher(0.1)
  m.add(box(w, len, w), col, [0, -len / 2, 0])
  if (foot) m.add(box(w * 1.2, w * 0.6, w * 1.8), foot, [0, -len, -w * 0.4])
  g.add(mesh(m))
  return g
}

/** The giant zombie: arms out for the bus, glowing eyes, a torn shirt. Parts move separately. */
function giant() {
  const g = new THREE.Group()
  const s = B.giantH / 13
  const body = new THREE.Group()
  const m = new Mesher(0.12)
  m.add(box(4.4, 4.6, 2.4), B.shirt, [0, 8.6, 0])
  m.add(box(4.6, 1.6, 2.6), B.pants, [0, 6.4, 0])
  m.add(box(2.2, 2.4, 2.2), B.skin, [0, 12, -0.3])
  for (const x of [-0.55, 0.55]) m.add(box(0.5, 0.35, 0.1), B.eyes, [x, 12.3, -1.45])
  m.add(box(1.4, 0.4, 0.1), '#2a1a1a', [0, 11.3, -1.42])
  m.add(box(1.6, 1.2, 0.1), B.skin, [-0.8, 9, -1.22])
  body.add(mesh(m))
  const arms = [-1, 1].map((x) => {
    const a = limb(1, 5, B.skin)
    a.position.set(x * 2.7, 10.4, 0)
    body.add(a)
    return a
  })
  const legs = [-1, 1].map((x) => {
    const l = limb(1.4, 5.8, B.pants, '#3a2a20')
    l.position.set(x * 1.2, 5.8, 0)
    g.add(l)
    return l
  })
  g.add(body)
  g.scale.setScalar(s)
  return { g, body, arms, legs }
}

/** The bridge behind the bus: deck pieces under a red truss, falling one by one into the river. */
function bridge() {
  const g = new THREE.Group()
  const w = ROAD_HALF + 1
  const pieces = Array.from({ length: B.pieces }, () => {
    const m = new Mesher(0.1)
    m.add(box(w * 2, 0.7, B.piece - 0.1), B.deck, [0, -0.3, 0])
    for (const x of [-w, w]) {
      m.add(box(0.3, 4, 0.3), B.girder, [x, 2, -B.piece / 2 + 0.2])
      m.add(box(0.3, 0.3, B.piece), B.girder, [x, 4, 0])
      m.add(box(0.2, 0.2, B.piece * 1.1), B.girder, [x, 2, 0], [0.6, 0, 0])
      m.add(box(0.15, 1, B.piece), B.chrome, [x * 0.97, 0.5, 0])
    }
    m.add(box(w * 2, 0.3, 0.3), B.girder, [0, 4, -B.piece / 2 + 0.2])
    const o = mesh(m)
    g.add(o)
    return o
  })
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 220).rotateX(-Math.PI / 2).translate(0, 0.05, 110),
    new THREE.MeshLambertMaterial({ color: B.river }),
  )
  g.add(river)
  return { g, pieces }
}

/** The boss fights behind the bus, built when first wanted. Health `left` runs 1 to 0 as the crew rides on target. */
export class Bosses {
  group = new THREE.Group()
  private truck?: { g: THREE.Group; trailers: THREE.Mesh[]; off: number[] }
  private big?: ReturnType<typeof giant> & { lost: boolean }
  private span?: ReturnType<typeof bridge>
  private phase = 0
  private z = 0
  private p = new THREE.Vector3()
  private c = new THREE.Color()

  /** Moves and damages the boss; returns true on a giant's footfall (shake the camera). */
  update(
    boss: { kind: BossKind; left: number } | null | undefined,
    hordeZ: number,
    t: number,
    dt: number,
    smoke: Particles,
    sparks: Particles,
  ) {
    for (const o of this.group.children) o.visible = false
    if (!boss) return false
    const hurt = 1 - clamp(boss.left)
    const want = hordeZ + B.back + hurt * B.fall
    this.z += (want - this.z) * clamp(dt * 2)
    if (this.z < 1) this.z = want
    const puff = (x: number, y: number, z: number, n: number, col = '#3a3a3e') => {
      if (Math.random() > dt * n) return
      smoke.emit({
        p: this.p.set(x, y, z),
        v: { x: rand(-0.5, 0.5), y: rand(1.5, 3), z: rand(1, 3) },
        life: rand(1, 2),
        s0: 0.6,
        s1: 2.6,
        c: this.c.set(col),
        a: 0.5,
        drag: 0.97,
      })
    }
    if (boss.kind === 'roadtrain') {
      if (!this.truck) {
        const g = new THREE.Group()
        g.add(cab())
        const trailers = [0, 1, 2].map((i) => {
          const tr = trailer(i)
          tr.position.z = 3.6 + i * 11.6
          g.add(tr)
          return tr
        })
        this.group.add(g)
        this.truck = { g, trailers, off: [0, 0, 0] }
      }
      const { g, trailers, off } = this.truck
      g.visible = true
      g.position.set(Math.sin(t * 0.9) * 0.4, Math.abs(Math.sin(t * 7)) * 0.06, this.z)
      g.rotation.y = Math.sin(t * 0.9 + 0.5) * 0.03
      trailers.forEach((tr, i) => {
        // The last trailer comes off first: it skids back, tips over and sinks out of sight.
        const k = 2 - i
        const gone = k < B.trailerOff.length && boss.left < B.trailerOff[k] ? 1 : 0
        off[i] += (gone - off[i]) * clamp(dt * 0.6)
        tr.position.set(off[i] * 3, -off[i] * 2.5, 3.6 + i * 11.6 + off[i] * 40)
        tr.rotation.set(0, off[i] * 0.5, off[i] * 1.2)
        tr.visible = off[i] < 0.97
        if (off[i] > 0.02 && tr.visible && Math.random() < dt * 30)
          sparks.emit({
            p: this.p.set(off[i] * 3, 0.3, this.z + 3.6 + i * 11.6 + off[i] * 40),
            v: { x: rand(-3, 3), y: rand(1, 4), z: rand(2, 6) },
            life: 0.5,
            s0: 0.25,
            s1: 0.05,
            c: this.c.set('#ffb040'),
            g: 9,
          })
      })
      for (const x of [-1.2, 1.2])
        puff(g.position.x + x, 5.8, this.z + 3.1, 4 + hurt * 30, hurt > 0.5 ? '#1c1c1f' : '#5a5a60')
    }
    if (boss.kind === 'giant') {
      if (!this.big) {
        this.big = { ...giant(), lost: false }
        this.group.add(this.big.g)
      }
      const { g, body, arms, legs } = this.big
      g.visible = true
      // A limp: the right leg drags more and the body leans over as the health goes.
      const was = Math.sin(this.phase)
      this.phase += dt * Math.PI * 2 * B.stride * (1 - hurt * 0.4)
      const sw = Math.sin(this.phase)
      legs[0].rotation.x = sw * 0.45
      legs[1].rotation.x = -sw * 0.45 * (1 - hurt * 0.8)
      body.rotation.set(-0.15, 0, hurt * 0.3 + Math.sin(this.phase) * 0.05)
      body.position.y = Math.abs(sw) * 0.4 * (B.giantH / 13)
      g.position.set(hurt * 2, 0, this.z + 6)
      arms.forEach((a, i) => (a.rotation.x = -1.4 + Math.sin(t * 1.5 + i * 2) * 0.25))
      // Below 40% the left arm drops off with a puff.
      const lost = boss.left < 0.4
      if (lost !== this.big.lost)
        for (let i = 0; i < 12; i++) puff(-3, 9, this.z + 6, 1e9, '#7fa65a')
      this.big.lost = lost
      arms[0].visible = !lost
      puff(hurt * 2, B.giantH * 0.7, this.z + 6, hurt * 25)
      return Math.sign(sw) !== Math.sign(was)
    }
    if (boss.kind === 'bridge') {
      if (!this.span) {
        this.span = bridge()
        this.group.add(this.span.g)
      }
      const { g, pieces } = this.span
      g.visible = true
      g.position.z = this.z + 6
      // Nearest piece trembles; each one further back has fallen further into the river.
      pieces.forEach((pc, i) => {
        const f = clamp(i / (pieces.length - 1) + Math.sin(t * 3 + i) * 0.03)
        pc.position.set(
          Math.sin(t * 20 + i) * 0.05 * (1 - f),
          -f * B.sink + Math.sin(t * 13) * 0.05,
          i * B.piece,
        )
        pc.rotation.set(f * 0.6 * (i % 2 ? 1 : -1), 0, f * 0.3 * (i % 3 ? 1 : -1))
      })
      for (let i = 0; i < 3; i++)
        puff(
          rand(-ROAD_HALF, ROAD_HALF),
          0.5,
          this.z + 8 + B.piece * (1 + i),
          6 + hurt * 10,
          '#e8f0f4',
        )
      puff(rand(-ROAD_HALF, ROAD_HALF), 1, this.z + 6, 3 + (1 - hurt) * 10, '#8a7a6a')
    }
    return false
  }
}
