import * as THREE from 'three'
import { groundH } from './ground'
import { VIS } from './params'
import { Mesher, VC, box, canvasTex, cone, cyl, ico } from './util'

type V3 = [number, number, number]
const up = new THREE.Vector3(0, 1, 0)
const q = new THREE.Quaternion()
const e = new THREE.Euler()

/** A tapered cylinder from a to b. */
function limb(m: Mesher, a: V3, b: V3, r0: number, r1: number, col: string, seg = 7) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  e.setFromQuaternion(q.setFromUnitVectors(up, d.clone().normalize()))
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  m.add(cyl(r1, r0, d.length(), seg), col, mid, [e.x, e.y, e.z])
}

/** A chain of tapered segments along `at(t)` (t 0..1), `r(t)` thick, coloured segment by segment. */
function chain(
  m: Mesher,
  n: number,
  at: (t: number) => V3,
  r: (t: number) => number,
  col: (i: number) => string,
) {
  for (let i = 0; i < n; i++) limb(m, at(i / n), at((i + 1) / n), r(i / n), r((i + 1) / n), col(i))
}

/** Googly zombie eyes (one bigger, one drooping) and a gappy mouth, on a face at `c` looking along +z. */
function face(m: Mesher, c: V3, s: number) {
  m.add(ico(0.42 * s, 1), '#f4f4ee', [c[0] - 0.45 * s, c[1] + 0.3 * s, c[2]])
  m.add(ico(0.3 * s, 1), '#f4f4ee', [c[0] + 0.5 * s, c[1] + 0.05 * s, c[2]])
  m.add(ico(0.16 * s), '#c8202a', [c[0] - 0.4 * s, c[1] + 0.25 * s, c[2] + 0.36 * s])
  m.add(ico(0.12 * s), '#111', [c[0] + 0.52 * s, c[1] - 0.02 * s, c[2] + 0.26 * s])
  m.add(box(1 * s, 0.32 * s, 0.2 * s), '#3a1218', [c[0], c[1] - 0.55 * s, c[2]], [0, 0, 0.12])
  for (const x of [-0.25, 0.2])
    m.add(box(0.16 * s, 0.18 * s, 0.1 * s), '#f4f0d0', [
      c[0] + x * s,
      c[1] - 0.45 * s,
      c[2] + 0.1 * s,
    ])
}

const ROT = '#7f9a3a'
const ARM = '#8fae5a'

/** The Big Banana, gone zombie: rotting spots, googly eyes, arms out for brains. */
function banana() {
  const m = new Mesher(0.12)
  const at = (t: number): V3 => [Math.sin(t * 2.4 - 1.2) * 3, 1.2 + t * 10, 0]
  const r = (t: number) => 0.4 + Math.sin(t * Math.PI) * 1.5
  chain(m, 9, at, r, (i) => (i === 0 || i === 8 ? '#5a3a1a' : i === 3 || i === 6 ? ROT : '#f2d43a'))
  face(m, [0.7, 7.2, 1.6], 1.3)
  for (const s of [-1, 1]) {
    limb(m, [s * 1.4, 5.6, 0.4], [s * 1.8, 6.1, 3.4], 0.28, 0.22, ARM)
    for (const f of [-1, 0, 1])
      limb(m, [s * 1.8, 6.1, 3.4], [s * 1.8 + f * 0.25, 5.9, 4.1], 0.08, 0.06, ARM, 4)
  }
  return m
}

/** The Big Prawn, gone zombie: an arched orange body, a tail fan, waving feelers, one eye on a stalk. */
function prawn() {
  const m = new Mesher(0.12)
  const at = (t: number): V3 => [0, 3 + Math.sin(t * Math.PI) * 3.4, 5 - t * 11]
  const r = (t: number) => 1.9 - t * 1.4
  chain(m, 8, at, r, (i) => (i === 2 || i === 5 ? ROT : i % 2 ? '#e8643a' : '#f07a4a'))
  for (const s of [-1, 1])
    m.add(cone(1.3, 2.2, 5), '#e8643a', [s * 0.8, 3.4, -7], [-1.3, 0, s * 0.5], [1, 1, 0.3])
  m.add(ico(1.9, 1), '#f07a4a', [0, 3.2, 5.6])
  face(m, [0, 3.4, 7.3], 1.1)
  limb(m, [0.6, 4.6, 6.8], [1.5, 5.9, 8.2], 0.08, 0.06, '#c8502a', 4)
  m.add(ico(0.45, 1), '#f4f4ee', [1.6, 6, 8.3])
  m.add(ico(0.2), '#111', [1.7, 6, 8.7])
  for (const s of [-1, 1]) limb(m, [s * 0.5, 4.4, 6.6], [s * 4, 9, 4], 0.09, 0.03, '#c8502a', 4)
  for (let i = 0; i < 4; i++)
    for (const s of [-1, 1])
      limb(m, [s * 1.2, 2.2, 4 - i * 1.4], [s * 1.9, 0.2, 4.6 - i * 1.4], 0.12, 0.08, '#d85a30', 4)
  for (const s of [-1, 1]) limb(m, [s * 1.5, 3.6, 6], [s * 1.6, 3.9, 9.4], 0.3, 0.24, ARM)
  return m
}

/** A servo that shut when the pies ran out: canopy, pumps, boarded windows. */
function deadServo() {
  const m = new Mesher(0.1)
  m.add(box(11, 4, 7), '#d8d2c0', [-4, 2, -4])
  m.add(box(11.4, 0.5, 7.4), '#b83a2a', [-4, 4.2, -4])
  for (const x of [-7.5, -4.5, -1.5])
    m.add(box(2.2, 1.8, 0.12), '#8a6a48', [x, 1.8, -0.45], [0, 0, (x % 3) * 0.08])
  m.add(box(9, 0.4, 6), '#b83a2a', [2, 5, 6], [0, 0, 0.06])
  for (const [x, z] of [
    [-1.5, 3.5],
    [5.5, 3.5],
    [-1.5, 8.5],
  ])
    m.add(box(0.35, 5, 0.35), '#cfcfc8', [x, 2.5, z])
  m.add(box(0.35, 5, 0.35), '#cfcfc8', [5.5, 1.6, 8.5], [0.5, 0, 0.3])
  for (const z of [5, 7])
    m.add(box(0.8, 1.5, 0.5), '#b83a2a', [2, 0.75, z], [0, 0, z === 7 ? 1.3 : 0])
  m.add(cyl(0.22, 0.22, 9, 6), '#777', [8, 4.5, 0])
  return m
}

const sign = (title: string, sub: string, bg: string, fg: string) =>
  canvasTex(512, 192, (c) => {
    c.fillStyle = bg
    c.fillRect(0, 0, 512, 192)
    c.fillStyle = fg
    c.textAlign = 'center'
    c.font = '900 70px system-ui, sans-serif'
    c.fillText(title, 256, 92, 480)
    c.font = '800 38px system-ui, sans-serif'
    c.fillText(sub, 256, 156, 480)
  })

const THINGS: [() => Mesher, THREE.Texture | null, V3][] = [
  [banana, sign('THE BIG BANANA', 'NOW 40% ZOMBIE', '#f2d43a', '#3a2a10'), [0, 1.8, 5]],
  [prawn, sign('THE BIG PRAWN', 'DO NOT FEED', '#2f6fb0', '#fff'), [0, 1.8, 10.5]],
  [deadServo, sign('SERVO', 'PIES: SOLD OUT 2019', '#fff', '#b83a2a'), [8, 9.6, 0.3]],
]

/** A Big Thing (zombified) or a dead servo comes past now and then, set back off one side of the road. */
export class BigThings {
  group = new THREE.Group()
  private items = THINGS.map(([make, tex, at]) => {
    const g = new THREE.Group()
    const m = make()
    m.add(box(7, 1.2, 7), '#b8b4aa', [0, 0.3, 0])
    g.add(new THREE.Mesh(m.build(), VC))
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.9),
      new THREE.MeshBasicMaterial({ map: tex }),
    )
    p.position.set(...at)
    g.add(p)
    return g
  })
  private z = -220
  private i = -1

  constructor() {
    this.group.add(...this.items)
    this.next(0)
  }

  private next(dist: number) {
    this.i = (this.i + 1) % this.items.length
    const side = this.i % 2 ? 1 : -1
    const x = side * VIS.bigThingX
    this.items.forEach((g, i) => {
      g.visible = i === this.i
      g.position.set(x, groundH(x, this.z - dist) - 0.3, this.z)
      g.rotation.y = -side * (Math.PI / 2 - 0.55)
      g.scale.setScalar(VIS.bigThingScale)
    })
  }

  update(dz: number, dist: number) {
    this.z += dz
    if (this.z > 70) {
      this.z -= VIS.bigThingEvery
      this.next(dist)
    }
    for (const g of this.items) g.position.z = this.z
  }
}
