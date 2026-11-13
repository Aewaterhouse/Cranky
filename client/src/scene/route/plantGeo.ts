import type * as THREE from 'three'
import { VIS } from '../params'
import { Mesher, cone, cyl, ico } from '../util'
import type { Kind } from './scatter'

const C = VIS.route.place.plant

/** Tall eucalypt: a long pale leaning trunk, two boughs and a loose crown of olive blobs well off the ground. */
function gum() {
  const m = new Mesher(0.14)
  m.add(cyl(0.2, 0.38, 9, 5), C.gumTrunk, [0.3, 4.5, 0], [0, 0, -0.07])
  m.add(cyl(0.1, 0.17, 4, 4), C.gumTrunk, [1.6, 8.6, 0.2], [0, 0, -0.75])
  m.add(cyl(0.09, 0.15, 3.4, 4), C.gumTrunk, [-0.6, 9.2, -0.5], [0.4, 0, 0.6])
  m.add(ico(2.3), C.gumLeaf, [0.8, 11.6, 0], [0.3, 0.2, 0], [1.25, 0.75, 1.15])
  m.add(ico(1.8), C.gumLeaf2, [3.1, 10.2, 0.5], [0, 0.7, 0.2], [1.2, 0.7, 1])
  m.add(ico(1.7), C.gumLeaf2, [-1.7, 10.6, -1], [0.5, 0, 0], [1.1, 0.7, 1.1])
  m.add(ico(1.4), C.gumLeaf, [0.4, 13.2, 0.4], [0, 0.4, 0.4], [1.1, 0.7, 1])
  return m.build()
}

/** Scribbly gum: short white forked trunk under a wide, light crown. */
function scribbly() {
  const m = new Mesher(0.12)
  m.add(cyl(0.24, 0.34, 3, 5), C.scribblyTrunk, [0, 1.5, 0])
  m.add(cyl(0.13, 0.22, 3.4, 4), C.scribblyTrunk, [0.95, 4.3, 0], [0, 0, -0.55])
  m.add(cyl(0.12, 0.2, 3, 4), C.scribblyTrunk, [-0.8, 4.2, 0.2], [0.15, 0, 0.5])
  m.add(ico(2), C.scribblyLeaf, [1.9, 6.4, 0], [0, 0.3, 0], [1.3, 0.7, 1.2])
  m.add(ico(1.9), C.scribblyLeaf, [-1.6, 6.1, 0.4], [0.4, 0, 0.2], [1.2, 0.7, 1.2])
  m.add(ico(1.5), C.gumLeaf, [0.1, 7.3, -0.6], [0.2, 0.9, 0], [1.2, 0.65, 1.1])
  return m.build()
}

/** Snow gum: three low twisting stems streaked with colour and a thin grey-green crown. */
function snowgum() {
  const m = new Mesher(0.14)
  m.add(cyl(0.12, 0.2, 2.6, 4), C.snowTrunk, [0.5, 1.2, 0], [0, 0, -0.45])
  m.add(cyl(0.11, 0.18, 2.8, 4), C.snowStreak, [-0.5, 1.3, 0.2], [0.2, 0, 0.42])
  m.add(cyl(0.1, 0.16, 2.4, 4), C.snowTrunk, [0, 1.15, -0.5], [-0.5, 0, 0])
  m.add(ico(1.1), C.snowLeaf, [1.2, 2.9, 0], [0, 0.3, 0], [1.3, 0.6, 1.1])
  m.add(ico(1.2), C.snowLeaf, [-1.2, 3.1, 0.3], [0.3, 0, 0], [1.2, 0.6, 1.2])
  m.add(ico(1), C.snowLeaf, [0, 2.8, -1.2], [0, 0.8, 0.2], [1.1, 0.6, 1.1])
  return m.build()
}

/** Tree fern: a brown trunk with a flat star of fronds. */
function fern() {
  const m = new Mesher(0.12)
  m.add(cyl(0.16, 0.22, 2, 5), C.fernTrunk, [0, 1, 0])
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    m.add(
      cone(0.34, 2.1, 3),
      C.fernFrond,
      [Math.sin(a) * 0.95, 2.05, Math.cos(a) * 0.95],
      [1.25, a, 0],
      [1, 1, 0.3],
    )
  }
  return m.build()
}

/** Coastal tea-tree with a banksia's cones: a dark leaning trunk and a dense flat crown. */
function teatree() {
  const m = new Mesher(0.12)
  m.add(cyl(0.14, 0.24, 2.6, 4), C.teaTrunk, [0.4, 1.2, 0], [0, 0, -0.4])
  m.add(cyl(0.12, 0.2, 2.2, 4), C.teaTrunk, [-0.4, 1.1, 0.2], [0.2, 0, 0.5])
  m.add(ico(1.9), C.teaLeaf, [0.9, 2.9, 0], [0.2, 0.4, 0], [1.4, 0.5, 1.3])
  m.add(ico(1.5), C.teaLeaf, [-1.2, 2.6, 0.4], [0, 0.9, 0.2], [1.3, 0.5, 1.2])
  for (const [x, z] of [
    [0.4, 0.8],
    [1.7, -0.4],
    [-1.3, 0.2],
  ])
    m.add(cyl(0.11, 0.11, 0.45, 5), C.banksia, [x, 3.55, z])
  return m.build()
}

const shrub = () =>
  new Mesher(0.16)
    .add(ico(0.7), C.shrub, [0, 0.4, 0], [0.3, 0.2, 0], [1.2, 0.8, 1.1])
    .add(ico(0.5), C.shrub2, [0.6, 0.3, 0.25], [0, 0.7, 0.3], [1.1, 0.8, 1])
    .build()

function tussock() {
  const m = new Mesher(0.2)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    m.add(
      cone(0.12, 0.75, 3),
      C.tussock,
      [Math.sin(a) * 0.14, 0.34, Math.cos(a) * 0.14],
      [Math.cos(a) * 0.35, a, -Math.sin(a) * 0.35],
    )
  }
  return m.build()
}

const boulder = () =>
  new Mesher(0.2)
    .add(ico(0.8), C.boulder, [0, 0.25, 0], [0.3, 0.5, 0], [1.3, 0.75, 1])
    .add(ico(0.45), C.boulder, [0.85, 0.12, 0.3], [0.8, 0.1, 0.2])
    .build()

const MAKE: Record<Kind, () => THREE.BufferGeometry> = {
  gum,
  scribbly,
  snowgum,
  fern,
  teatree,
  shrub,
  tussock,
  boulder,
}
let geos: Partial<Record<Kind, THREE.BufferGeometry>> = {}

/** The shared low-poly geometry for a kind of plant, built the first time it is wanted. */
export const plantGeo = (k: Kind) => (geos[k] ??= MAKE[k]())

/** Throws the geometries away so new colours from the debug panel take effect. Call with no chunks alive. */
export function dropPlantGeos() {
  for (const g of Object.values(geos)) g.dispose()
  geos = {}
}
