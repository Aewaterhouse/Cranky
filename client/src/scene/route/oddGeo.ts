import type * as THREE from 'three'
import { VIS } from '../params'
import { instances, pos, quat, scale, UP, type Anchor } from './chunkProps'
import { FUN } from './funVis'
import type { HeightField } from './heightField'
import { BUSH } from './oddGeoBush'
import { HOME } from './oddGeoHome'
import { ODD_KINDS, type OddKind, type Oddity } from './oddPlan'
import { drawnHeight, type Patch } from './patch'
import type { Signs } from './signs'

const O = FUN.odd
const MAKE: Record<OddKind, () => THREE.BufferGeometry> = { ...HOME, ...BUSH }
/** Where a kind's sign board hangs, in its own metres: [x, y, z, width, height]. */
const BOARD: Partial<Record<OddKind, [number, number, number, number, number]>> = {
  couch: [0, 1.05, 0.2, 1.5, 0.75],
  fruitStall: [0, 0.45, 0.55, 2, 0.8],
  shelter: [0.1, 2.65, 0.9, 2.6, 0.7],
  wombatSign: [0, 1.6, 0.06, 0.8, 0.6],
  skis: [1.2, 1, 0, 1.3, 0.7],
  surfboards: [0, 2.6, -0.3, 2.2, 0.8],
  thongFence: [0, 1.75, 0, 2.4, 0.8],
  fridge: [0, 1.25, 0.39, 0.72, 0.6],
  roadworks: [0, 1.6, -0.5, 2.2, 0.9],
  bigThong: [0, 0.2, 1.36, 4, 0.8],
  bigPie: [0, 0.2, 3.06, 5, 0.9],
  bigEsky: [0, 0.2, 2.06, 5, 0.9],
  bigSnag: [0, 0.2, 1.56, 5, 0.9],
}
let geos: Partial<Record<OddKind, THREE.BufferGeometry>> = {}
export function dropOddGeos() {
  for (const g of Object.values(geos)) g.dispose()
  geos = {}
}

/** A chunk's oddities: one instanced mesh per kind, and the board for each one that has something to say. */
export function buildOddities(
  list: Oddity[],
  field: HeightField,
  patches: Patch[],
  a: Anchor,
  signs: Signs,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  const F = VIS.route.place.furniture
  const y = (o: Oddity) => drawnHeight(field, patches, o.x, o.z)
  for (const kind of ODD_KINDS) {
    const mine = list.filter((o) => o.kind === kind)
    if (!mine.length) continue
    const m = instances((geos[kind] ??= MAKE[kind]()), mine.length, a, (i) => {
      pos.set(mine[i].x, y(mine[i]), mine[i].z)
      quat.setFromAxisAngle(UP, mine[i].face)
      scale.setScalar(O.size)
    })
    m.castShadow = true
    out.push(m)
  }
  for (const o of list) {
    const b = BOARD[o.kind]
    if (!b || !o.text) continue
    const [c, s] = [Math.cos(o.face) * O.size, Math.sin(o.face) * O.size]
    const council = o.kind === 'wombatSign' || o.kind === 'roadworks'
    const big = o.kind.startsWith('big')
    const m = signs.plate(
      o.text,
      b[3] * O.size,
      b[4] * O.size,
      council ? F.gradeBg : big ? O.plaqueBg : O.boardBg,
      council ? F.gradeFg : big ? O.plaqueFg : O.boardFg,
      !council && !big,
    )
    m.position.set(
      o.x + b[0] * c + b[2] * s - a.ax,
      y(o) + b[1] * O.size - a.ay,
      o.z - b[0] * s + b[2] * c - a.az,
    )
    m.rotation.y = o.face
    out.push(m)
  }
  return out
}
