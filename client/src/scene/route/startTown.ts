import { hash } from '../math'
import { VIS } from '../params'
import { vehicle } from '../propGeo'
import { Mesher, box, cone, cyl, ico } from '../util'
import type { Features } from './features'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import type { Landmark } from './landmarkPlan'
import { newPose } from './roadPath'

const R = VIS.route
const L = R.place.landmarks
const S = L.start
const P = R.place
const pose = newPose()

/** The town at the start of route `id`: from the table, or Woop Woop for routes nobody has named. */
export const townOf = (id: string) => L.towns[id] ?? 'Woop Woop'

/**
 * The start village: a gateway sign with the town's name, its bakery, cars parked along the verges and bunting
 * over the road. Each thing tries a few spots and is left out where the road, a street, a building or water is.
 */
export function planStart(
  id: string,
  field: HeightField,
  cover: LandCover,
  features: Features,
): Landmark[] {
  const { path } = field
  const town = townOf(id)
  const out: Landmark[] = []
  /** The spot `o` m right of the road at `d`, or undefined where it is not free dry ground. */
  const spot = (d: number, o: number, pad: number) => {
    path.poseAt(d, pose)
    const [x, z] = [pose.x + pose.rx * o, pose.z + pose.rz * o]
    const free = field.clear(x, z, Math.abs(o) - 0.5) && !features.blocked(x, z, pad)
    return free && cover.at(x, z, field.ground(x, z)) !== 'w' ? { x, z } : undefined
  }
  /** Facing back towards riders coming up the road, turned `toRoad` of the way to face across it. */
  const facing = (side: number, toRoad: number) =>
    Math.atan2(-pose.fx - side * pose.rx * toRoad, -pose.fz - side * pose.rz * toRoad)
  const place = (kind: Landmark['kind'], d: number, o: number, pad: number, name = '') => {
    for (const dd of [0, 8, -6, 16]) {
      const at = spot(d + dd, o, pad)
      if (!at || d + dd < 0 || d + dd > path.length) continue
      const s = Math.sign(o)
      const face = facing(s, kind === 'gateway' ? 0.8 : 1.6)
      out.push({ kind, ...at, face, name, tint: hash(d * 1.7 + o) })
      return
    }
  }
  const line = L.townLines[Math.floor(hash(town.length * 13.1 + id.length) * L.townLines.length)]
  place(
    'gateway',
    S.gateway,
    R.roadHalf + R.verge + S.gatewayOut,
    4,
    `Welcome to\n${town.toUpperCase()}\n${line}`,
  )
  place(
    'bakery',
    S.bakery,
    -(R.roadHalf + R.verge + S.bakeryOut),
    8,
    `${town.toUpperCase()} BAKERY`,
  )
  for (let i = 0; i < S.cars; i++) {
    const side = i % 2 ? 1 : -1
    const d = S.carFrom + i * S.carStep + hash(i * 5.3) * 3
    const at = spot(d, side * (R.roadHalf + R.verge + S.carOut), 2.5)
    if (!at || d > path.length) continue
    // Parked along the kerb, nose the way the traffic on that side goes (cars face -z; we drive on the left).
    const face = Math.atan2(pose.fx, pose.fz) + (side < 0 ? Math.PI : 0)
    out.push({
      kind: i % 3 === 2 ? 'ute' : 'car',
      ...at,
      face,
      name: '',
      tint: hash(i * 9.1 + id.length),
    })
  }
  for (const d of S.bunting) {
    if (d > path.length) continue
    path.poseAt(d, pose)
    out.push({
      kind: 'bunting',
      x: pose.x,
      z: pose.z,
      face: Math.atan2(pose.fx, pose.fz),
      name: '',
      tint: 0,
    })
  }
  return out
}

/** Town gateway: sandstone pillars and wall, a green board (its words are a sign plate), a flower bed, a big wheel on top. */
function gateway() {
  const m = new Mesher(0.08)
  for (const x of [-4.9, 4.9]) {
    m.add(box(1.2, 6.4, 1.2), S.wall, [x, 2, 0])
    m.add(box(1.4, 0.3, 1.4), '#e8dcc2', [x, 5.3, 0])
  }
  m.add(box(9.8, 1, 0.8), S.wall, [0, 0, 0])
  m.add(box(8.8, 3.4, 0.2), S.board, [0, 3.2, 0])
  m.add(box(9, 0.35, 1.3), '#5a3f2a', [0, 0.1, 1])
  for (let i = 0; i < 12; i++)
    m.add(ico(0.3), S.flags[i % 4], [-4.1 + i * 0.75, 0.45, 1 + (i % 2) * 0.3])
  // The wheel: a rim of boxes, a hub and spokes, standing on the board.
  const [wy, wr] = [6.6, 1.6]
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    m.add(
      box(0.75, 0.16, 0.16),
      '#22252b',
      [Math.cos(a) * wr, wy + Math.sin(a) * wr, 0],
      [0, 0, a + Math.PI / 2],
    )
  }
  for (let i = 0; i < 6; i++)
    m.add(box(0.05, wr * 2, 0.05), '#c8ccd0', [0, wy, 0], [0, 0, (i / 6) * Math.PI])
  m.add(cyl(0.2, 0.2, 0.3, 8), '#c8ccd0', [0, wy, 0], [Math.PI / 2, 0, 0])
  return m.build()
}

/** Country bakery: a cream shop with a red false front (its name is a plate), a striped verandah, a giant pie on the roof. */
function bakery() {
  const m = new Mesher(0.06)
  m.add(box(10, 6, 8), S.bakeryWall, [0, 2, 0])
  m.add(box(10.2, 0.3, 8.2), P.roofs[0], [0, 5.1, 0])
  m.add(box(10.4, 2.2, 0.4), S.bakeryFront, [0, 5.9, 4.1])
  for (const x of [-3, 3]) m.add(box(3, 1.9, 0.1), P.glass, [x, 1.6, 4.02])
  m.add(box(1.3, 2.4, 0.1), P.door, [0, 1.2, 4.02])
  for (let i = 0; i < 9; i++)
    m.add(
      box(1.2, 0.14, 3),
      i % 2 ? P.trim : S.bakeryFront,
      [-4.8 + i * 1.2, 3.2, 5.6],
      [0.18, 0, 0],
    )
  for (const x of [-4.9, -1.6, 1.6, 4.9]) m.add(box(0.15, 3.2, 0.15), P.trim, [x, 1.6, 7])
  m.add(box(2.4, 0.12, 0.5), '#9b7a52', [-3, 0.5, 5.6])
  for (const x of [-4, -2]) m.add(box(0.12, 0.5, 0.4), '#9b7a52', [x, 0.25, 5.6])
  // The A-frame chalkboard and the pie the size of a car.
  for (const s of [-1, 1])
    m.add(box(0.8, 1.1, 0.06), '#2b2f2c', [3.4, 0.55, 7.8 + s * 0.2], [s * 0.2, 0, 0])
  m.add(cyl(2.6, 2.1, 1.1, 12), S.pie, [0, 6.4, -0.8])
  m.add(cyl(2.5, 2.5, 0.25, 12), '#f0c070', [0, 7.05, -0.8])
  m.add(ico(0.9), '#c8291e', [0.4, 7.2, -0.6], [0, 0, 0], [1, 0.35, 1])
  return m.build()
}

/** Bunting across the road: two poles and a sagging line of little flags, built along x around the centreline. */
function bunting() {
  const m = new Mesher(0.04)
  const half = R.roadHalf + R.verge + 1.5
  for (const x of [-half, half]) m.add(cyl(0.07, 0.09, 6, 5), '#c8ccd0', [x, 2.9, 0])
  const n = Math.round(half * 3.4)
  for (let i = 0; i <= n; i++) {
    const x = -half + (i / n) * half * 2
    const y = 5.8 - 0.7 * (1 - (x / half) ** 2)
    m.add(
      cone(0.2, 0.42, 3),
      S.flags[i % S.flags.length],
      [x, y - 0.21, 0],
      [Math.PI, 0, 0],
      [1, 1, 0.3],
    )
  }
  return m.build()
}

export const START_GEO = {
  gateway,
  bakery,
  bunting,
  car: () => vehicle('sedan'),
  ute: () => vehicle('ute'),
}

/** Where each start thing wears its name: local x, y, z of the plate's centre, its width and height, and colours. */
export const START_PLATES: Partial<
  Record<Landmark['kind'], [number, number, number, number, number, string, string][]>
> = {
  gateway: [
    [0, 4.35, 0.14, 4.6, 0.7, S.board, '#f6f3ea'],
    [0, 3.3, 0.14, 8.4, 1.3, S.board, '#f6f3ea'],
    [0, 2.15, 0.14, 6.6, 0.6, S.board, '#f2c230'],
  ],
  bakery: [[0, 5.9, 4.34, 9.4, 1.6, S.bakeryFront, '#fff4d6']],
}
