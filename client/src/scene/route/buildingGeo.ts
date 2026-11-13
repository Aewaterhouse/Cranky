import * as THREE from 'three'
import { VIS } from '../params'
import { Mesher, box, cone } from '../util'

const P = VIS.route.place
export const BUILDING_KINDS = ['gable', 'verandah', 'hip', 'shop', 'pub', 'servo'] as const
export type BuildingKind = (typeof BUILDING_KINDS)[number]
type V = [number, number, number]

/** Flat faces from corner lists, each wound so it faces away from the origin-ish point `inside`. */
function faces(list: V[][], inside: V = [0, 0.3, 0]) {
  const pos: number[] = []
  for (const f of list)
    for (let i = 1; i < f.length - 1; i++) {
      const [a, b, c] = [f[0], f[i], f[i + 1]]
      const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(
        new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]),
      )
      const out = n.dot(new THREE.Vector3(a[0] - inside[0], a[1] - inside[1], a[2] - inside[2])) > 0
      pos.push(...a, ...(out ? b : c), ...(out ? c : b))
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/**
 * Walls in a unit footprint: y runs from -1 (buried, so sloping ground never shows a gap) to 1 at the eaves, and
 * the front is +z. White, to be tinted per building; door and windows stay dark.
 */
function walls(storeys: number, posts: 'none' | 'front' | 'round') {
  const m = new Mesher(0.05)
  m.add(box(1, 2, 1), '#ffffff')
  const rows = storeys === 2 ? [0.28, 0.76] : [0.58]
  m.add(box(0.13, 0.62 / storeys, 0.03), P.door, [0.08, 0.31 / storeys, 0.5])
  for (const y of rows)
    for (const s of [-1, 1]) {
      if (!(s > 0 && y === rows[0]))
        m.add(box(0.2, 0.3 / storeys, 0.03), P.glass, [0.3 * s, y, 0.5])
      m.add(box(0.2, 0.3 / storeys, 0.03), P.glass, [0.28 * s, y, -0.5])
      m.add(box(0.03, 0.3 / storeys, 0.22), P.glass, [0.5 * s, y, 0.1 * s])
    }
  if (posts === 'front')
    for (const x of [-0.5, 0, 0.5]) m.add(box(0.025, 0.86, 0.03), P.trim, [x, 0.43, 0.82])
  if (posts === 'round') {
    m.add(box(1.36, 0.035, 1.36), P.trim, [0, 0.5, 0])
    for (const x of [-0.66, 0, 0.66])
      for (const z of [-0.66, 0, 0.66])
        if (x || z) m.add(box(0.025, 0.96, 0.03), P.trim, [x, 0.48, z])
  }
  return m.build()
}

/** Roofs in a unit footprint with their base at y = 0 and their top at y = 1; white, tinted per building. */
function roof(kind: BuildingKind) {
  const m = new Mesher(0.06)
  const e = 0.56
  if (kind === 'gable' || kind === 'verandah') {
    m.add(
      faces([
        [
          [-e, 0, e],
          [e, 0, e],
          [e, 1, 0],
          [-e, 1, 0],
        ],
        [
          [-e, 0, -e],
          [e, 0, -e],
          [e, 1, 0],
          [-e, 1, 0],
        ],
      ]),
      '#d9d9d9',
    )
    m.add(
      faces([
        [
          [-0.5, 0, 0.5],
          [-0.5, 0, -0.5],
          [-0.5, 0.9, 0],
        ],
        [
          [0.5, 0, 0.5],
          [0.5, 0, -0.5],
          [0.5, 0.9, 0],
        ],
        [
          [-e, 0, e],
          [e, 0, e],
          [e, 0, -e],
          [-e, 0, -e],
        ],
      ]),
      '#ffffff',
    )
    if (kind === 'verandah')
      m.add(
        faces(
          [
            [
              [-e, 0.02, 0.5],
              [e, 0.02, 0.5],
              [e, -0.22, 0.9],
              [-e, -0.22, 0.9],
            ],
          ],
          [0, -9, 0],
        ),
        '#c4c4c4',
      )
  } else if (kind === 'hip' || kind === 'pub') {
    m.add(cone(0.8, 1, 4), '#d9d9d9', [0, 0.5, 0], [0, Math.PI / 4, 0])
    if (kind === 'pub') m.add(box(1.42, 0.06, 1.42), '#c4c4c4', [0, -0.04, 0])
  } else {
    m.add(box(1.04, 0.5, 1.04), '#e6e6e6', [0, 0.25, 0])
    if (kind === 'shop') m.add(box(0.96, 0.1, 0.28), P.awning, [0, -0.75, 0.64])
    else {
      // The servo's canopy stands on posts four roof-heights tall, which is the wall height.
      m.add(box(0.9, 0.7, 0.75), P.servo, [0, 0.35, 1.05])
      for (const x of [-0.36, 0.36]) m.add(box(0.035, 4, 0.04), P.trim, [x, -2, 1.05])
      for (const x of [-0.2, 0.2]) m.add(box(0.08, 1.4, 0.06), P.awning, [x, -3.3, 1.05])
    }
  }
  return m.build()
}

let geos: Partial<
  Record<BuildingKind, { walls: THREE.BufferGeometry; roof: THREE.BufferGeometry }>
> = {}

/** The shared wall and roof geometry for a kind of building, built the first time it is wanted. */
export const buildingGeo = (k: BuildingKind) =>
  (geos[k] ??= {
    walls: walls(k === 'pub' ? 2 : 1, k === 'verandah' ? 'front' : k === 'pub' ? 'round' : 'none'),
    roof: roof(k),
  })

/** Throws the geometries away so new colours from the debug panel take effect. Call with no chunks alive. */
export function dropBuildingGeos() {
  for (const g of Object.values(geos)) {
    g.walls.dispose()
    g.roof.dispose()
  }
  geos = {}
}
