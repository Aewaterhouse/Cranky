import type * as THREE from 'three'
import { VIS } from '../params'
import { Mesher, box, cone, cyl, ico } from '../util'
import { faces } from './buildingGeo'
import { col, instances, pos, quat, scale, UP, type Anchor } from './chunkProps'
import type { HeightField } from './heightField'
import { LANDMARK_KINDS, type Landmark, type LandmarkKind } from './landmarkPlan'
import { drawnHeight, type Patch } from './patch'
import type { Signs } from './signs'

const R = VIS.route
const L = R.place.landmarks
const P = R.place

/** Peak: a stone cairn with a white trig pillar and its black vanes on top. */
function trig() {
  const m = new Mesher(0.18)
  m.add(ico(1.5), L.stone, [0, 0.5, 0], [0.2, 0.3, 0], [1.2, 0.7, 1.2])
  m.add(ico(1), L.stone, [0.2, 1.4, 0.1], [0.5, 0, 0.3], [1.1, 0.7, 1.1])
  m.add(cyl(0.16, 0.2, 2, 6), L.trig, [0, 2.8, 0])
  for (const r of [0, Math.PI / 2]) m.add(box(1, 0.5, 0.04), '#22252b', [0, 4.05, 0], [0, r, 0])
  return m.build()
}

/** Lookout: a timber deck on posts reaching out from the road side, with a railing on three sides. */
function lookout() {
  const m = new Mesher(0.1)
  m.add(box(8, 0.25, 6), L.timber, [0, 0.5, 3.5])
  for (const x of [-3.7, 0, 3.7])
    for (const z of [0.8, 6.2]) m.add(box(0.3, 9, 0.3), L.timber, [x, -4, z])
  for (const x of [-3.9, 3.9]) m.add(box(0.12, 0.12, 6), L.steel, [x, 1.7, 3.5])
  m.add(box(8, 0.12, 0.12), L.steel, [0, 1.7, 6.45])
  for (let i = 0; i <= 4; i++) {
    m.add(box(0.1, 1.1, 0.1), L.steel, [-3.9 + i * 1.95, 1.15, 6.45])
    for (const x of [-3.9, 3.9]) m.add(box(0.1, 1.1, 0.1), L.steel, [x, 1.15, 0.6 + i * 1.46])
  }
  // A coin telescope, because every lookout has one.
  m.add(cyl(0.08, 0.1, 1.2, 5), L.steel, [2, 1.2, 5.6])
  m.add(cyl(0.16, 0.2, 0.7, 6), '#3d6f9e', [2, 1.9, 5.6], [1.2, 0, 0])
  return m.build()
}

/** TV tower: four legs leaning in to a mast, red and white bands of bracing, a light on top. Feet go underground. */
function tower() {
  const m = new Mesher(0.06)
  const H = L.towerH
  const half = (y: number) => 7 - (6.2 * y) / H
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const lean = Math.atan2(6.2, H)
    m.add(
      cyl(0.3, 0.45, H + 12, 4),
      L.steel,
      [sx * 3.5, H / 2 - 6, sz * 3.5],
      [-sz * lean, 0, sx * lean],
    )
  }
  for (let i = 0; i < 9; i++) {
    const y = 6 + (i * (H - 8)) / 8
    const w = half(y) * 2
    const c = i % 2 ? L.towerWhite : L.towerRed
    for (const s of [-1, 1]) {
      m.add(box(w, 0.5, 0.3), c, [0, y, (s * w) / 2])
      m.add(box(0.3, 0.5, w), c, [(s * w) / 2, y, 0])
    }
  }
  m.add(cyl(0.25, 0.5, 26, 5), L.towerRed, [0, H + 13, 0])
  m.add(cyl(1.6, 1.6, 2.5, 8), L.towerWhite, [0, H - 6, 0])
  m.add(ico(0.7), '#ff5a3c', [0, H + 26.5, 0])
  return m.build()
}

/** Cafe kiosk: a little box with a striped awning, a table and an umbrella out the front. */
function kiosk() {
  const m = new Mesher(0.06)
  m.add(box(5, 6, 4), P.trim, [0, 0, 0])
  m.add(box(5.4, 0.3, 4.4), P.roofs[1], [0, 3.1, 0])
  m.add(box(3.4, 1.2, 0.1), P.glass, [0, 1.7, 2.02])
  for (let i = 0; i < 5; i++)
    m.add(box(1, 0.12, 1.5), i % 2 ? P.trim : P.awning, [-2 + i, 2.6, 2.7], [0.3, 0, 0])
  m.add(cyl(0.7, 0.7, 0.08, 8), L.timber, [2.6, 0.85, 5])
  m.add(cyl(0.06, 0.06, 2.4, 5), L.steel, [2.6, 1.2, 5])
  m.add(cone(1.5, 0.7, 8), L.umbrella, [2.6, 2.6, 5])
  return m.build()
}

/** A-frame ski lodge: roof to the ground, a glazed front, a chimney. White where the tint goes. */
function lodge() {
  const m = new Mesher(0.06)
  const [w, h, d] = [4.5, 8, 5]
  m.add(
    faces(
      [
        [
          [-w, -2, d],
          [w, -2, d],
          [0, h, d],
        ],
        [
          [-w, -2, -d],
          [w, -2, -d],
          [0, h, -d],
        ],
        [
          [w, -2, d],
          [w, -2, -d],
          [0, h, -d],
          [0, h, d],
        ],
        [
          [-w, -2, d],
          [-w, -2, -d],
          [0, h, -d],
          [0, h, d],
        ],
      ],
      [0, 2, 0],
    ),
    '#ffffff',
  )
  m.add(box(3, 2.6, 0.1), P.glass, [0, 3.2, d - 0.9])
  m.add(box(1.2, 2.2, 0.1), P.door, [0, 1.1, d + 0.03])
  m.add(box(0.8, 3, 0.8), L.stone, [2, 6, -2])
  m.add(box(w * 2.1, 0.2, 2), L.timber, [0, 0.1, d + 1])
  return m.build()
}

/** Summit hut: squat stone walls, a tin roof, a chimney. */
function hut() {
  const m = new Mesher(0.12)
  m.add(box(6, 7, 4.5), L.stone, [0, -0.5, 0])
  m.add(box(6.6, 0.3, 3), P.roofs[0], [0, 3.5, 1.2], [0.45, 0, 0])
  m.add(box(6.6, 0.3, 3), P.roofs[0], [0, 3.5, -1.2], [-0.45, 0, 0])
  m.add(box(1, 2, 0.1), P.door, [0, 1, 2.27])
  m.add(box(0.9, 2.4, 0.9), L.stone, [-2.2, 4.2, 0])
  return m.build()
}

/** Bathing box: a striped shed on stumps with a little gable. White and pale grey stripes take the tint. */
function bathingBox() {
  const m = new Mesher(0.04)
  for (let i = 0; i < 5; i++)
    m.add(box(0.5, 2.4, 3), i % 2 ? '#ffffff' : '#bdbdbd', [-1 + i * 0.5, 1.7, 0])
  m.add(cone(2.1, 1.1, 4), '#f4f4f0', [0, 3.45, 0], [0, Math.PI / 4, 0], [1, 1, 1.15])
  m.add(box(0.9, 1.7, 0.08), '#f4f4f0', [0, 1.4, 1.52])
  for (const x of [-1, 1])
    for (const z of [-1.2, 1.2]) m.add(box(0.2, 3, 0.2), L.timber, [x, -1, z])
  return m.build()
}

/** Jetty: a plank deck on piles running out along +z, with a couple of bollards at the end. */
function jetty() {
  const m = new Mesher(0.12)
  const len = L.jettyLen
  m.add(box(2.6, 0.2, len), L.timber, [0, 1.3, len / 2])
  for (let z = 2; z <= len; z += 6)
    for (const x of [-1.2, 1.2]) m.add(cyl(0.16, 0.16, 6, 5), L.timber, [x, -1.4, z])
  for (const x of [-1.1, 1.1]) m.add(cyl(0.2, 0.2, 0.9, 6), L.stone, [x, 1.8, len - 0.6])
  return m.build()
}

const MAKE: Record<LandmarkKind, () => THREE.BufferGeometry> = {
  trig,
  lookout,
  tower,
  kiosk,
  lodge,
  hut,
  bathingBox,
  jetty,
}
let geos: Partial<Record<LandmarkKind, THREE.BufferGeometry>> = {}
export function dropLandmarkGeos() {
  for (const g of Object.values(geos)) g.dispose()
  geos = {}
}

/** A chunk's landmarks as one instanced mesh per kind, plus a brown name sign beside each named one. */
export function buildLandmarks(
  list: Landmark[],
  field: HeightField,
  patches: Patch[],
  a: Anchor,
  signs: Signs,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  const ground = (l: Landmark) =>
    l.kind === 'jetty' ? R.seaLevel : drawnHeight(field, patches, l.x, l.z)
  for (const kind of LANDMARK_KINDS) {
    const mine = list.filter((l) => l.kind === kind)
    if (!mine.length) continue
    const tints = kind === 'lodge' ? L.lodgeTints : kind === 'bathingBox' ? L.boxTints : undefined
    const m = instances((geos[kind] ??= MAKE[kind]()), mine.length, a, (i) => {
      const l = mine[i]
      pos.set(l.x, ground(l), l.z)
      quat.setFromAxisAngle(UP, l.face)
      scale.setScalar(kind === 'tower' ? 0.85 + l.tint * 0.4 : 1)
      if (tints) col.set(tints[Math.floor(l.tint * tints.length)])
    })
    m.castShadow = true
    out.push(m)
  }
  for (const l of list) {
    if (!l.name) continue
    // Beside the landmark, turned to face back down the way its front looks.
    const [x, z] = [l.x + Math.cos(l.face) * 5.5, l.z - Math.sin(l.face) * 5.5]
    const y = drawnHeight(field, patches, x, z)
    const m = signs.plate(l.name, 4.2, 0.9, L.signBg, '#ffffff')
    m.position.set(x - a.ax, y + 2.6 - a.ay, z - a.az)
    m.rotation.y = l.face
    const post = instances(postGeo, 1, a, () => {
      pos.set(x, y, z)
      quat.identity()
      scale.setScalar(1)
      col.set(R.signs.post)
    })
    out.push(m, post)
  }
  return out
}
const postGeo = new Mesher(0).add(box(0.14, 2.4, 0.14), '#ffffff', [0, 1.2, 0]).build()
