import * as THREE from 'three'
import { Mesher, box, cyl, cone, rand } from './util'

export const WHEELS: [number, number][] = [
  [-1.4, -4.4],
  [1.4, -4.4],
  [-1.4, 3.0],
  [1.4, 3.0],
]
/** Roof surface height, and rider seat slots (x, z) on the roof. */
export const ROOF_Y = 3.33
export const SLOTS: [number, number][] = [
  [-0.62, -2.2],
  [0.62, -2.2],
  [-0.62, 0.4],
  [0.62, 0.4],
  [-0.62, 3.0],
  [0.62, 3.0],
]
export const EXHAUST: [number, number, number] = [-1.0, 0.55, 5.4]
export const HOOD: [number, number, number] = [0, 2.1, -4.7]
const PAINT = '#ffffff'
const STEEL = '#8b9099'

/** Painted shell: body, roof, pillars, hood. Tinted by the paint material. */
export function paintGeo() {
  const m = new Mesher(0.05)
  m.add(box(2.9, 1.25, 8.4), PAINT, [0, 1.55, 0.8])
  m.add(box(2.9, 0.18, 8.4), PAINT, [0, 3.09, 0.8])
  m.add(box(2.5, 0.12, 8.2), PAINT, [0, 3.27, 0.8])
  for (const s of [-1, 1]) m.add(box(0.4, 0.12, 8.3), PAINT, [s * 1.3, 3.2, 0.8], [0, 0, -s * 0.55])
  for (let z = -2.4; z <= 5; z += 1.1) m.add(box(2.96, 0.82, 0.14), PAINT, [0, 2.59, z])
  for (const x of [-1.4, 0, 1.4]) m.add(box(0.14, 0.82, 0.14), PAINT, [x, 2.59, -3.4])
  m.add(box(2.3, 1.0, 2.0), PAINT, [0, 1.45, -4.4])
  m.add(box(2.3, 0.14, 2.0), PAINT, [0, 2.0, -4.4], [0.1, 0, 0])
  m.add(box(2.4, 0.3, 0.14), PAINT, [0, 1.0, -5.38])
  for (const [x, z] of WHEELS.slice(0, 2)) m.add(box(0.55, 0.16, 1.7), PAINT, [x * 1.0, 1.36, z])
  m.add(box(2.9, 0.1, 0.14), PAINT, [0, 2.22, -3.4])
  m.add(box(2.92, 0.82, 0.14), PAINT, [0, 2.59, 4.95])
  return m.build()
}

export function glassGeo() {
  const m = new Mesher(0.06)
  m.add(box(2.84, 0.82, 8.3), '#2a3d4c', [0, 2.59, 0.8])
  for (const x of [-0.62, 0.62]) m.add(box(1.0, 0.5, 0.06), '#33495a', [x, 2.65, 5.03])
  return m.build()
}

/** Chassis, bumpers, grille, rails, mirrors, exhaust, roof rack and luggage. */
export function trimGeo() {
  const m = new Mesher(0.1)
  m.add(box(2.2, 0.5, 9.4), '#18181a', [0, 0.62, 0.3])
  for (const y of [1.1, 2.12]) m.add(box(2.94, 0.09, 8.42), '#1b1b1e', [0, y, 0.8])
  m.add(box(2.84, 0.3, 0.42), '#6b6f78', [0, 0.78, -5.5])
  m.add(box(3.0, 0.32, 0.4), '#202022', [0, 0.78, 5.2])
  m.add(box(1.6, 0.8, 0.1), '#2a2a2e', [0, 1.4, -5.42])
  for (let i = -2; i <= 2; i++) m.add(box(0.06, 0.8, 0.12), '#b4b6be', [i * 0.3, 1.4, -5.44])
  for (const x of [-0.88, 0.88])
    m.add(cyl(0.25, 0.25, 0.1, 8), '#c4c6cc', [x, 1.55, -5.4], [Math.PI / 2, 0, 0])
  for (const [x, z] of WHEELS)
    m.add(cyl(0.8, 0.8, 0.5, 12), '#0e0e10', [x * 0.99, 0.62, z], [0, 0, Math.PI / 2])
  m.add(box(2.6, 0.08, 0.5), '#202022', [0, 3.0, -3.55])
  for (const s of [-1, 1]) {
    m.add(box(0.5, 0.05, 0.05), '#222', [s * 1.6, 2.5, -3.55])
    m.add(box(0.1, 0.5, 0.1), '#222', [s * 1.85, 2.5, -3.6])
    m.add(cyl(0.3, 0.3, 0.04, 8), '#c82020', [s * 1.6, 2.3, -1.3], [0, 0, Math.PI / 2])
    m.add(box(0.05, 0.1, 0.4), '#f0f0f0', [s * 1.62, 2.3, -1.3])
  }
  m.add(cyl(0.08, 0.08, 1.0, 6), '#5a5a60', [-1.0, 0.55, 5.1], [Math.PI / 2, 0, 0])
  // roof rack
  const rail = '#26262b'
  for (const s of [-1, 1]) {
    for (let z = -3.0; z <= 4.8; z += 1.3)
      m.add(box(0.06, 0.5, 0.06), rail, [s * 1.3, ROOF_Y + 0.25, z])
    m.add(box(0.06, 0.06, 7.9), rail, [s * 1.3, ROOF_Y + 0.5, 0.9])
  }
  m.add(box(2.6, 0.06, 0.06), rail, [0, ROOF_Y + 0.5, -3.0])
  m.add(box(1.6, 0.14, 0.2), '#222', [0, ROOF_Y + 0.3, -3.05])
  for (const x of [-0.6, -0.2, 0.2, 0.6])
    m.add(cyl(0.1, 0.1, 0.1, 6), '#fff6c8', [x, ROOF_Y + 0.3, -3.17], [Math.PI / 2, 0, 0])
  // luggage and spares, kept low at the back so riders stay visible
  m.add(box(0.8, 0.35, 0.6), '#8a6a3a', [-0.7, ROOF_Y + 0.18, 4.6], [0, 0.1, 0])
  m.add(box(0.7, 0.3, 0.6), '#6a7a4a', [0.6, ROOF_Y + 0.15, 4.6], [0, -0.2, 0])
  m.add(cyl(0.14, 0.14, 0.9, 6), '#4a6a8a', [0, ROOF_Y + 0.14, 4.7], [0, 0, Math.PI / 2])
  for (const x of [-1.0, -0.8]) m.add(box(0.26, 0.36, 0.14), '#b8302a', [x, ROOF_Y + 0.2, 4.15])
  m.add(new THREE.TorusGeometry(0.42, 0.17, 6, 10), '#1c1c1e', [-0.95, 1.5, 5.45], [0, 0, 0])
  // rear ladder
  for (const x of [0.6, 1.3]) m.add(box(0.06, 2.4, 0.06), '#26262b', [x, 2.0, 5.1])
  for (let y = 1; y < 3.1; y += 0.4) m.add(box(0.7, 0.05, 0.05), '#26262b', [0.95, y, 5.1])
  return m.build()
}

export function bullbarGeo() {
  const m = new Mesher(0.08)
  const t = (r: number, len: number, p: [number, number, number], rot: [number, number, number]) =>
    m.add(cyl(r, r, len, 6), STEEL, p, rot)
  t(0.08, 2.6, [0, 1.95, -5.95], [0, 0, Math.PI / 2])
  t(0.08, 2.6, [0, 1.0, -5.95], [0, 0, Math.PI / 2])
  for (const x of [-1.25, -0.5, 0.5, 1.25]) t(0.07, 0.95, [x, 1.48, -5.95], [0, 0, 0])
  for (const x of [-1.25, 1.25]) t(0.07, 1.0, [x, 1.0, -5.5], [Math.PI / 2, 0, 0])
  for (const x of [-1.25, 1.25]) t(0.06, 1.1, [x, 1.9, -5.45], [Math.PI / 2 - 0.4, 0, 0])
  m.add(box(2.6, 0.5, 0.08), '#5a5f68', [0, 0.78, -5.8], [0.25, 0, 0])
  for (const x of [-0.9, 0.9])
    m.add(cyl(0.16, 0.16, 0.1, 8), '#fff2b8', [x, 2.15, -5.95], [Math.PI / 2, 0, 0])
  return m.build()
}

export function spikesGeo() {
  const m = new Mesher(0.08)
  const spike = (p: [number, number, number], rot: [number, number, number], s = 1) => {
    m.add(cone(0.1 * s, 0.8 * s, 5), '#7b7f88', p, rot)
  }
  for (const x of [-1.3, 1.3])
    for (let z = -3.0; z <= 4.8; z += 0.65) spike([x, ROOF_Y + 0.85, z], [0, 0, 0])
  for (let x = -1.1; x <= 1.1; x += 0.55) spike([x, ROOF_Y + 0.85, -2.6], [0, 0, 0], 0.9)
  for (const x of [-1.2, -0.6, 0.6, 1.2]) spike([x, 0.8, -5.9], [-Math.PI / 2, 0, 0], 1.2)
  for (const x of [-1.5, 1.5])
    spike([x, 0.9, -5.5], [0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2], 1.1)
  for (const x of [-0.6, 0, 0.6])
    m.add(cone(0.12, 0.7, 5), '#7b7f88', [x, 1.0, 5.6], [Math.PI / 2, 0, 0])
  return m.build()
}

/** Bolted-on armour plates, grouped into `n` tiers that peel off as armour drops. */
export function plateGroups(n: number) {
  const ms = Array.from({ length: n }, () => new Mesher(0.14))
  let k = 0
  const next = () => ms[k++ % n]
  const plate = (
    w: number,
    h: number,
    d: number,
    p: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    const m = next()
    m.add(box(w, h, d), '#737982', p, rot)
    m.add(box(w * 1.1, h * 0.1, d * 0.96), '#5d636b', [p[0], p[1] + h * 0.45, p[2]], rot)
    m.add(box(w * 1.1, h * 0.12, d * 0.9), '#7a5c44', [p[0], p[1] - h * 0.44, p[2]], rot)
    const side = w < d ? 1 : 0
    for (const a of [-0.4, 0.4])
      for (const b of [-0.35, 0.35])
        m.add(
          cyl(0.06, 0.06, 0.06, 6),
          '#33363b',
          [p[0] + (side ? 0.04 : 0), p[1] + b * h, p[2] + a * d * (side ? 1 : 0)],
          [0, 0, Math.PI / 2],
        )
  }
  for (const s of [-1, 1]) {
    for (const z of [-2.0, 0.0, 2.0, 4.0]) plate(0.07, 0.78, 1.9, [s * 1.47, 1.55, z + 0.0])
    for (const z of [-2.0, 0.0, 2.0, 4.0]) {
      const mm = next()
      mm.add(box(0.07, 0.2, 1.9), '#737982', [s * 1.47, 2.95, z])
      mm.add(box(0.07, 0.2, 1.9), '#737982', [s * 1.47, 2.25, z])
      mm.add(box(0.07, 0.62, 0.14), '#5d636b', [s * 1.47, 2.6, z - 0.95])
    }
  }
  plate(2.3, 0.16, 1.9, [0, 2.1, -4.4], [0.1, 0, 0])
  plate(2.4, 0.5, 0.07, [0, 1.4, -5.46])
  plate(2.9, 0.6, 0.07, [0, 1.7, 5.05])
  return ms.map((x) => x.build())
}

/** Soot, rust and bullet scars; each tier appears as armour falls. */
export function damageGroups(n: number) {
  const ms = Array.from({ length: n }, () => new Mesher(0.2))
  for (let i = 0; i < 40; i++) {
    const m = ms[i % n]
    const s = Math.random() < 0.5 ? -1 : 1
    const rust = Math.random() < 0.45
    const w = rand(0.25, 0.9)
    const col = rust ? '#7a4528' : '#161412'
    if (Math.random() < 0.8)
      m.add(
        box(0.03, rand(0.2, 0.6), w),
        col,
        [s * 1.46, rand(1.2, 2.9), rand(-3, 4.8)],
        [rand(-0.3, 0.3), 0, 0],
      )
    else m.add(box(w, 0.03, rand(0.3, 1)), col, [rand(-0.8, 0.8), 2.08, rand(-5, -3.8)])
  }
  for (let i = 0; i < 8; i++)
    ms[i % n].add(
      box(0.04, 0.3, 0.05),
      '#d8d8d0',
      [rand(-0.9, 0.9), 2.6 + rand(-0.2, 0.2), -3.47],
      [0, 0, rand(-1, 1)],
    )
  return ms.map((x) => x.build())
}

/** A wedge plough in place of the bull bar. */
export function ploughGeo() {
  const m = new Mesher(0.06)
  for (const s of [-1, 1]) {
    m.add(box(1.75, 1.3, 0.1), '#c9a227', [s * 0.8, 1.05, -6.15], [0.25, s * 0.55, 0])
    m.add(box(1.75, 0.16, 0.12), '#26262b', [s * 0.8, 1.72, -6.2], [0.25, s * 0.55, 0])
  }
  for (const x of [-1.1, 1.1])
    m.add(cyl(0.07, 0.07, 1.1, 6), STEEL, [x, 1.2, -5.5], [Math.PI / 2, 0, 0])
  return m.build()
}

/** Two tattered pirate flags on poles at the back of the roof. */
export function flagsGeo() {
  const m = new Mesher(0.05)
  for (const x of [-1.25, 1.25]) {
    m.add(cyl(0.04, 0.04, 2.4, 5), '#4a3a2a', [x, ROOF_Y + 1.5, 4.4])
    m.add(box(0.03, 0.7, 1.1), '#15151a', [x, ROOF_Y + 2.3, 5.0])
    m.add(
      new THREE.IcosahedronGeometry(0.16, 0),
      '#e8e6df',
      [x, ROOF_Y + 2.38, 5.0],
      [0, 0, 0],
      [0.3, 1, 1],
    )
    m.add(box(0.035, 0.07, 0.5), '#e8e6df', [x, ROOF_Y + 2.12, 5.0], [0.5, 0, 0])
    m.add(box(0.035, 0.07, 0.5), '#e8e6df', [x, ROOF_Y + 2.12, 5.0], [-0.5, 0, 0])
  }
  return m.build()
}

/** A roof esky and a surfboard strapped on the back half of the roof. */
export function eskyGeo() {
  const m = new Mesher(0.05)
  m.add(box(0.9, 0.5, 0.6), '#2f7fd1', [0.7, ROOF_Y + 0.45, 4.2])
  m.add(box(0.94, 0.12, 0.64), '#f4f4f0', [0.7, ROOF_Y + 0.74, 4.2])
  m.add(box(0.55, 0.09, 2.9), '#f2e3b0', [-0.75, ROOF_Y + 0.32, 3.4], [0, 0.04, 0])
  m.add(box(0.12, 0.1, 2.9), '#e94f37', [-0.75, ROOF_Y + 0.33, 3.4], [0, 0.04, 0])
  m.add(cone(0.12, 0.3, 4), '#f2e3b0', [-0.75, ROOF_Y + 0.5, 4.6], [0.4, 0, 0])
  return m.build()
}
