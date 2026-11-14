import * as THREE from 'three'
import { Mesher, VC, box, clamp, cone, cyl, ico } from '../util'
import { LAND, TOPS } from './townGeo'

/** Tunables for the town's water (debug panel on /town-dev.html?debug=1, with the rest of `TOWN`). */
export const WATER = {
  /** Swell height (m) and how long a swell takes to roll in (s). */
  swell: 0.35,
  swellS: 7,
  /** Foam around the shore: width (m) and how much it breathes. */
  foam: 2.6,
  foamPulse: 0.35,
  /** Debris floats once the sea level passes this (0..1), and this many gulls wheel over the water. */
  debrisFrom: 0.15,
  /** Debris and gulls are drawn this much bigger than life, so they read from the camera. */
  debrisSize: 2.2,
  gullSize: 2.4,
  gulls: 6,
}

const NEAR = 260
const SEGS = 52
const FRONTS = [TOPS.beach, TOPS.shore, TOPS.main, TOPS.hill, TOPS.ridge]
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const p = new THREE.Vector3()
const s = new THREE.Vector3()
const m4 = new THREE.Matrix4()

/** Height of the swell at (x, z) at time t, fading to nothing at the edge of the near sheet. */
export function swellAt(x: number, z: number, t: number) {
  const fade = clamp((NEAR / 2 - Math.max(Math.abs(x), Math.abs(z - 40))) / 30)
  const w = (Math.PI * 2) / WATER.swellS
  return (
    WATER.swell *
    fade *
    (Math.sin(z * 0.16 - t * w) + 0.5 * Math.sin((x * 0.6 + z) * 0.11 + t * w * 0.7))
  )
}

/** The sea's edge against the town: the front of the lowest terrace still above water (or the seawall). */
export function shoreZ(y: number, walls: number) {
  const i = FRONTS.findIndex((top) => top > y)
  return walls > 0 && i <= 1 ? LAND.wall : LAND.fronts[Math.max(0, i)]
}

const piece = (build: (m: Mesher) => void) => {
  const m = new Mesher(0.1)
  build(m)
  return m.build()
}

/** What floats off once the beach goes under: wheelie bins, an esky, surfboards, an inflatable flamingo, a couch. */
const DEBRIS: [THREE.BufferGeometry, [number, number][]][] = [
  [
    piece((m) => {
      m.add(box(0.7, 1.05, 0.75), '#2f6b3a', [0, 0, 0])
      m.add(box(0.76, 0.1, 0.82), '#f2c230', [0, 0.57, 0])
    }),
    [
      [0.18, 0.2],
      [0.62, 0.35],
      [0.8, 0.15],
      [0.35, 0.55],
    ],
  ],
  [
    piece((m) => {
      m.add(box(1, 0.55, 0.6), '#f4f4f0', [0, 0, 0])
      m.add(box(1.04, 0.14, 0.64), '#2f7fc4', [0, 0.32, 0])
    }),
    [[0.48, 0.25]],
  ],
  [
    piece((m) => {
      m.add(box(0.55, 0.08, 2.4), '#ffd21f', [0, 0, 0])
      m.add(box(0.12, 0.09, 2.2), '#e94f37', [0, 0.01, 0])
    }),
    [
      [0.28, 0.4],
      [0.72, 0.6],
    ],
  ],
  [
    piece((m) => {
      m.add(new THREE.TorusGeometry(0.75, 0.3, 5, 10), '#f08aa6', [0, 0, 0], [Math.PI / 2, 0, 0])
      m.add(cyl(0.13, 0.17, 1.4, 5), '#f08aa6', [0, 0.75, -0.7], [0.2, 0, 0])
      m.add(ico(0.22), '#f08aa6', [0, 1.45, -0.6])
      m.add(cone(0.08, 0.3, 4), '#1c1c1f', [0, 1.4, -0.3], [Math.PI / 2, 0, 0])
    }),
    [[0.55, 0.12]],
  ],
  [
    piece((m) => {
      m.add(box(2.2, 0.5, 0.9), '#7d5a78', [0, 0, 0])
      m.add(box(2.2, 0.6, 0.25), '#7d5a78', [0, 0.45, -0.35], [-0.2, 0, 0])
      for (const x of [-1.1, 1.1]) m.add(box(0.2, 0.4, 0.9), '#a98aa0', [x, 0.3, 0])
    }),
    [[0.1, 0.45]],
  ],
]

const gullGeo = () =>
  piece((m) => {
    m.add(ico(0.22), '#f4f4f0', [0, 0, 0], [0, 0, 0], [1, 0.8, 1.8])
    for (const x of [-1, 1])
      m.add(box(1, 0.04, 0.32), '#c9d0d6', [x * 0.5, 0.12, 0], [0, 0, x * 0.35])
    m.add(cone(0.06, 0.22, 4), '#f2c230', [0, 0, 0.45], [Math.PI / 2, 0, 0])
  })

/**
 * The town's sea: a near sheet that swells, a far sheet with a hole for it, foam breathing round the shore,
 * debris bobbing once the beach is under, and gulls wheeling over it all.
 */
export class TownWater {
  group = new THREE.Group()
  mat = new THREE.MeshLambertMaterial({ transparent: true, flatShading: true })
  private near: THREE.Mesh
  private far: THREE.Mesh
  private foam = new THREE.Group()
  private foamMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true })
  private debris = DEBRIS.map(([g, at]) => new THREE.InstancedMesh(g, VC, at.length))
  private gulls = new THREE.InstancedMesh(gullGeo(), VC, WATER.gulls)

  constructor() {
    const g = new THREE.PlaneGeometry(NEAR, NEAR, SEGS, SEGS)
      .rotateX(-Math.PI / 2)
      .translate(0, 0, 40)
    this.near = new THREE.Mesh(g, this.mat)
    const outer = new THREE.Shape()
      .moveTo(-450, -450)
      .lineTo(450, -450)
      .lineTo(450, 450)
      .lineTo(-450, 450)
    const h = NEAR / 2
    outer.holes.push(
      new THREE.Path()
        .moveTo(-h, -h - 40)
        .lineTo(-h, h - 40)
        .lineTo(h, h - 40)
        .lineTo(h, -h - 40),
    )
    this.far = new THREE.Mesh(new THREE.ShapeGeometry(outer).rotateX(-Math.PI / 2), this.mat)
    // Lacy foam: a strip of uneven blobs, stretched along each edge of the land.
    const lace = new Mesher(0.05)
    for (let i = 0; i < 40; i++)
      lace.add(box(0.035, 0.06, 0.5 + (i % 3) * 0.3), '#ffffff', [-0.5 + i / 40, 0, (i % 4) * 0.12])
    const strip = lace.build()
    for (let i = 0; i < 3; i++) this.foam.add(new THREE.Mesh(strip, this.foamMat))
    this.group.add(this.near, this.far, this.foam, this.gulls, ...this.debris)
  }

  update(t: number, y: number, level: number, walls: number) {
    const pos = this.near.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setY(i, swellAt(pos.getX(i), pos.getZ(i), t))
    pos.needsUpdate = true
    this.near.position.y = this.far.position.y = y
    const z0 = shoreZ(y, walls)
    const pulse = 1 + Math.sin(t * ((Math.PI * 2) / WATER.swellS)) * WATER.foamPulse
    this.foamMat.opacity = 0.25 + 0.3 * pulse
    const [front, left, right] = this.foam.children
    front.position.set(0, y + 0.05, z0 + 0.4)
    front.scale.set(LAND.w + 3, 1, WATER.foam * pulse)
    for (const [o, sx] of [
      [left, -1],
      [right, 1],
    ] as const) {
      o.position.set(sx * (LAND.w / 2 + 0.6), y + 0.05, (z0 + LAND.back) / 2)
      o.rotation.y = Math.PI / 2
      o.scale.set(z0 - LAND.back, 1, WATER.foam * pulse)
    }
    const up = clamp((level - WATER.debrisFrom) / 0.1)
    DEBRIS.forEach(([, at], k) =>
      at.forEach(([u, v], i) => {
        const seed = k * 7.1 + i * 3.3
        const x = (u - 0.5) * (LAND.w - 8) + Math.sin(t * 0.06 + seed) * 4
        const z = z0 + 4 + v * 30 + Math.sin(t * 0.04 + seed * 2) * 2
        p.set(x, y + swellAt(x, z, t) + 0.15 * WATER.debrisSize, z)
        e.set(Math.sin(t * 0.9 + seed) * 0.15, seed + t * 0.05, Math.cos(t * 0.7 + seed) * 0.15)
        this.debris[k].setMatrixAt(
          i,
          m4.compose(p, q.setFromEuler(e), s.setScalar(up * WATER.debrisSize)),
        )
      }),
    )
    for (const d of this.debris) d.instanceMatrix.needsUpdate = true
    for (let i = 0; i < WATER.gulls; i++) {
      const a = t * (0.25 + i * 0.03) + i * 2.1
      const r = 12 + (i % 3) * 7
      p.set(
        Math.cos(a) * r + (i - 2.5) * 12,
        Math.max(y, TOPS.beach) + 11 + (i % 2) * 4 + Math.sin(t + i) * 0.8,
        z0 + 10 + Math.sin(a) * r * 0.6,
      )
      e.set(0, -a, 0.3)
      s.set(1, 0.5 + 0.6 * Math.abs(Math.sin(t * 5 + i)), 1).multiplyScalar(WATER.gullSize)
      this.gulls.setMatrixAt(i, m4.compose(p, q.setFromEuler(e), s))
    }
    this.gulls.instanceMatrix.needsUpdate = true
  }
}
