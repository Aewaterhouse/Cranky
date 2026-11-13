import { Mesher, box, cone, cyl, ico } from '../util'
import { FUN } from './funVis'

const C = FUN.odd.col
const H = Math.PI / 2
type V = [number, number, number]

/** A wombat-shaped lump with its nose along +x, standing on y = 0. */
export function wombat(m: Mesher, x = 0, z = 0, s = 1) {
  m.add(ico(0.42 * s), C.wombat, [x, 0.36 * s, z], [0, 0, 0], [1.5, 0.85, 1])
  m.add(ico(0.24 * s), C.wombat, [x + 0.58 * s, 0.36 * s, z], [0, 0, 0], [1, 0.9, 1])
  m.add(box(0.1 * s, 0.07 * s, 0.14 * s), C.black, [x + 0.8 * s, 0.34 * s, z])
  for (const sz of [-1, 1]) {
    m.add(box(0.08 * s, 0.1 * s, 0.06 * s), C.wombat, [x + 0.56 * s, 0.6 * s, z + sz * 0.14 * s])
    for (const sx of [-0.35, 0.35])
      m.add(box(0.16 * s, 0.2 * s, 0.14 * s), C.wombat, [x + sx * s, 0.1 * s, z + sz * 0.22 * s])
  }
}

/** A plinth, sunk well into the ground so a slope never shows under it. */
const plinth = (m: Mesher, w: number, d: number) => m.add(box(w, 3, d), C.plinth, [0, -0.9, 0])

/** Farm, bush, beach and snow: front on +z, standing on y = 0. */
export const BUSH = {
  /** An honesty-box stall: a table under a tin roof, crates of something, a money tin. */
  fruitStall() {
    const m = new Mesher(0.1)
    m.add(box(2.2, 0.1, 1), C.timber, [0, 0.9, 0])
    for (const x of [-1, 1]) {
      m.add(box(0.1, 2.1, 0.1), C.oldTimber, [x, 1.05, -0.45])
      m.add(box(0.1, 0.9, 0.1), C.oldTimber, [x, 0.45, 0.4])
    }
    m.add(box(2.6, 0.07, 1.5), C.tin, [0, 2.15, 0.1], [0.2, 0, 0])
    const fruit = [C.orange, C.yellow, C.green]
    fruit.forEach((c, i) => {
      m.add(box(0.55, 0.22, 0.5), C.oldTimber, [-0.7 + i * 0.7, 1.06, 0])
      for (let k = 0; k < 4; k++)
        m.add(ico(0.11), c, [-0.82 + i * 0.7 + (k % 2) * 0.24, 1.22, -0.1 + (k >> 1) * 0.22])
    })
    m.add(box(0.2, 0.26, 0.2), C.red, [1.25, 0.7, 0.55])
    m.add(box(0.07, 0.6, 0.07), C.oldTimber, [1.25, 0.3, 0.55])
    return m.build()
  },
  /** A bathtub horse trough, a tap, and the horse it belongs to. */
  bathtub() {
    const m = new Mesher(0.08)
    m.add(box(1.75, 0.55, 0.8), C.white, [0, 0.5, 0])
    m.add(box(1.55, 0.05, 0.62), C.blue, [0, 0.76, 0])
    for (const x of [-0.7, 0.7]) m.add(box(0.22, 0.22, 0.7), C.rust, [x, 0.11, 0])
    m.add(box(0.07, 1.1, 0.07), C.steel, [-1.1, 0.55, 0])
    const h: V = [2.3, 0, -0.8]
    m.add(box(1.5, 0.6, 0.5), C.horse, [h[0], 1.25, h[2]])
    m.add(box(0.3, 0.95, 0.34), C.horse, [h[0] - 1.05, 1.3, h[2]], [0, 0, 1.1])
    m.add(box(0.62, 0.28, 0.26), C.horse, [h[0] - 1.6, 0.98, h[2]], [0, 0, 0.7])
    m.add(box(0.1, 0.7, 0.06), C.black, [h[0] + 0.8, 1.05, h[2]], [0, 0, -0.2])
    for (const x of [-0.6, 0.6])
      for (const z of [-0.17, 0.17]) m.add(box(0.13, 1, 0.13), C.horse, [h[0] + x, 0.5, h[2] + z])
    return m.build()
  },
  /** Bee boxes on a pallet. */
  bees() {
    const m = new Mesher(0.06)
    m.add(box(3, 0.14, 1), C.oldTimber, [0, 0.07, 0])
    const tints = [C.white, C.blue, C.white, C.yellow, C.white]
    tints.forEach((c, i) => {
      for (let k = 0; k <= i % 2; k++)
        m.add(box(0.5, 0.36, 0.55), c, [-1.2 + i * 0.6, 0.33 + k * 0.38, 0])
      m.add(box(0.56, 0.06, 0.6), C.tin, [-1.2 + i * 0.6, 0.55 + (i % 2) * 0.38, 0])
    })
    return m.build()
  },
  /** A wombat warning sign, and a wombat ignoring it. */
  wombatSign() {
    const m = new Mesher(0.05)
    m.add(box(0.09, 2.6, 0.09), C.steel, [0, 1.3, 0])
    m.add(box(1.1, 1.1, 0.06), C.yellow, [0, 2.55, 0.05], [0, 0, Math.PI / 4])
    m.add(ico(0.2), C.black, [0, 2.5, 0.1], [0, 0, 0], [1.5, 0.8, 0.1])
    m.add(ico(0.11), C.black, [0.28, 2.52, 0.1], [0, 0, 0], [1, 1, 0.1])
    wombat(m, -0.2, 1.1, 1.25)
    return m.build()
  },
  /** A snowman in a beanie, and the toboggan somebody walked away from. */
  snowman() {
    const m = new Mesher(0.03)
    m.add(ico(0.7, 1), C.snow, [0, 0.55, 0])
    m.add(ico(0.5, 1), C.snow, [0, 1.45, 0])
    m.add(ico(0.34, 1), C.snow, [0, 2.1, 0])
    m.add(cone(0.07, 0.4, 5), C.orange, [0, 2.1, 0.5], [H, 0, 0])
    for (const x of [-0.13, 0.13]) m.add(box(0.07, 0.07, 0.05), C.black, [x, 2.22, 0.31])
    m.add(cyl(0.2, 0.35, 0.3, 8), C.red, [0, 2.45, 0])
    m.add(ico(0.1), C.white, [0, 2.66, 0])
    m.add(box(0.75, 0.14, 0.75), C.blue, [0, 1.84, 0])
    for (const s of [-1, 1])
      m.add(box(0.9, 0.05, 0.05), C.oldTimber, [s * 0.8, 1.6, 0], [0, 0, s * 0.5])
    m.add(box(1.5, 0.08, 0.5), C.red, [1.9, 0.3, 0.6], [0.2, 0.5, 0.25])
    for (const z of [-0.2, 0.2])
      m.add(box(1.6, 0.06, 0.06), C.oldTimber, [1.9, 0.14, 0.6 + z], [0, 0.5, 0.25])
    return m.build()
  },
  /** Skis and poles jammed in the snow, and one lost glove on a stick. */
  skis() {
    const m = new Mesher(0.04)
    for (const s of [-1, 1]) {
      m.add(box(0.11, 1.9, 0.03), s < 0 ? C.red : C.blue, [s * 0.14, 0.9, 0], [0, 0, s * 0.14])
      m.add(cyl(0.02, 0.02, 1.3, 4), C.steel, [s * 0.7, 0.6, 0.1], [0, 0, -s * 0.1])
    }
    m.add(cyl(0.025, 0.025, 1.1, 4), C.oldTimber, [-1.3, 0.55, 0.2])
    m.add(box(0.16, 0.24, 0.1), C.orange, [-1.3, 1.18, 0.2])
    return m.build()
  },
  /** Two deck chairs and an esky, pointed at the view. */
  eskyChairs() {
    const m = new Mesher(0.05)
    for (const s of [-1, 1]) {
      const x = s * 0.85
      for (let i = 0; i < 4; i++)
        m.add(
          box(0.15, 0.03, 1.15),
          i % 2 ? C.white : s < 0 ? C.red : C.blue,
          [x - 0.22 + i * 0.15, 0.55, -0.1],
          [0.75, 0, 0],
        )
      for (const e of [-0.33, 0.33]) {
        m.add(box(0.05, 0.05, 1.5), C.timber, [x + e, 0.5, -0.1], [0.75, 0, 0])
        m.add(box(0.05, 0.05, 1.1), C.timber, [x + e, 0.36, -0.1], [-0.6, 0, 0])
      }
    }
    m.add(box(0.62, 0.4, 0.4), C.blue, [0, 0.2, 0.25])
    m.add(box(0.66, 0.1, 0.44), C.white, [0, 0.45, 0.25])
    m.add(cyl(0.05, 0.05, 0.16, 6), C.rust, [0.1, 0.58, 0.25])
    return m.build()
  },
  /** Surfboards stood against a rail. */
  surfboards() {
    const m = new Mesher(0.04)
    m.add(box(3.2, 0.1, 0.1), C.oldTimber, [0, 1.1, -0.3])
    for (const x of [-1.5, 1.5]) m.add(box(0.1, 1.1, 0.1), C.oldTimber, [x, 0.55, -0.3])
    const tints = [C.yellow, C.teal, C.white, C.red, C.orange]
    tints.forEach((c, i) => {
      const len = 0.95 + (i % 3) * 0.14
      m.add(ico(1, 1), c, [-1.2 + i * 0.6, len - 0.02, -0.05], [0.24, 0, 0], [0.26, len, 0.04])
      m.add(box(0.05, len * 1.7, 0.012), C.black, [-1.2 + i * 0.6, len, -0.01], [0.24, 0, 0])
    })
    return m.build()
  },
  /** A dunny with a view. */
  dunny() {
    const m = new Mesher(0.14)
    m.add(box(1.25, 4, 1.25), C.oldTimber, [0, 0.3, 0], [0, 0, 0.05])
    m.add(box(1.6, 0.07, 1.7), C.tin, [0.1, 2.42, 0.05], [0.22, 0, 0.05])
    m.add(box(0.75, 1.8, 0.06), C.timber, [0.45, 1, 0.9], [0, -0.7, 0])
    m.add(box(0.7, 1.75, 0.04), C.black, [0.05, 1, 0.63])
    m.add(ico(0.12), C.white, [0.45, 1.6, 0.96], [0, -0.7, 0], [1, 1, 0.2])
    return m.build()
  },
  /** A farm windmill over a tank. */
  windmill() {
    const m = new Mesher(0.06)
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      m.add(cyl(0.05, 0.07, 9.4, 4), C.steel, [sx * 0.6, 3.6, sz * 0.6], [-sz * 0.12, 0, sx * 0.12])
    for (const y of [2, 4.4, 6.4]) {
      const w = 2.3 - y * 0.26
      for (const s of [-1, 1]) {
        m.add(box(w, 0.05, 0.05), C.steel, [0, y, (s * w) / 2])
        m.add(box(0.05, 0.05, w), C.steel, [(s * w) / 2, y, 0])
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      m.add(
        box(0.36, 1.3, 0.03),
        C.tin,
        [Math.cos(a) * 0.95, 8.3 + Math.sin(a) * 0.95, 0.5],
        [0.3, 0, a - H],
      )
    }
    m.add(box(0.1, 0.1, 2.2), C.steel, [0, 8.3, -0.5])
    m.add(box(0.04, 0.9, 0.9), C.red, [0, 8.3, -1.6])
    m.add(cyl(1.6, 1.6, 1.9, 10), C.tin, [3.4, 1.4, 0])
    m.add(box(2.4, 0.5, 2.4), C.oldTimber, [3.4, 0.25, 0])
    return m.build()
  },
  /** Round bales: one in pink wrap, one with a face. */
  hay() {
    const m = new Mesher(0.1)
    m.add(cyl(0.8, 0.8, 1.25, 10), C.straw, [-1.8, 0.8, 0], [0, 0, H])
    m.add(cyl(0.8, 0.8, 1.25, 10), C.pink, [1.9, 0.8, -0.4], [0, 0.3, H])
    m.add(cyl(0.8, 0.8, 1.25, 10), C.straw, [0, 0.8, 0.2], [H, 0, 0])
    for (const x of [-0.26, 0.26]) m.add(box(0.16, 0.2, 0.04), C.black, [x, 1.05, 0.84])
    for (let i = -2; i <= 2; i++)
      m.add(box(0.14, 0.08, 0.04), C.black, [i * 0.13, 0.56 + Math.abs(i) * 0.06, 0.84])
    m.add(cyl(0.6, 0.6, 0.05, 10), C.oldTimber, [0, 1.62, 0.2])
    m.add(cyl(0.32, 0.36, 0.32, 8), C.oldTimber, [0, 1.8, 0.2])
    return m.build()
  },
  /** A scarecrow in hi-vis and an Akubra. */
  scarecrow() {
    const m = new Mesher(0.06)
    m.add(box(0.1, 2.3, 0.1), C.oldTimber, [0, 1.15, 0])
    m.add(box(2, 0.09, 0.09), C.oldTimber, [0, 1.75, 0])
    m.add(box(0.75, 0.85, 0.3), C.hivis, [0, 1.45, 0])
    for (const s of [-1, 1]) {
      m.add(box(0.6, 0.26, 0.26), C.hivis, [s * 0.66, 1.75, 0])
      m.add(ico(0.14), C.straw, [s * 1.02, 1.75, 0])
    }
    m.add(box(0.77, 0.1, 0.32), C.steel, [0, 1.5, 0])
    m.add(ico(0.26, 1), C.bread, [0, 2.2, 0])
    for (const x of [-0.1, 0.1]) m.add(box(0.06, 0.06, 0.04), C.black, [x, 2.25, 0.25])
    m.add(cyl(0.5, 0.5, 0.04, 10), C.wombat, [0, 2.42, 0])
    m.add(cyl(0.24, 0.27, 0.24, 8), C.wombat, [0, 2.55, 0])
    return m.build()
  },
  /** A fence hung with lost thongs. */
  thongFence() {
    const m = new Mesher(0.08)
    for (let i = 0; i < 5; i++) m.add(box(0.14, 1.3, 0.14), C.oldTimber, [-2.6 + i * 1.3, 0.65, 0])
    for (const y of [0.6, 1.1]) m.add(box(5.3, 0.04, 0.04), C.steel, [0, y, 0])
    const tints = [C.red, C.blue, C.yellow, C.pink, C.green, C.orange, C.white, C.teal]
    for (let i = 0; i < 15; i++)
      m.add(
        box(0.2, 0.42, 0.04),
        tints[(i * 5) % tints.length],
        [-2.45 + i * 0.35, i % 2 ? 0.86 : 0.4, 0.06],
        [0, 0, ((i * 7) % 5) * 0.12 - 0.24],
      )
    return m.build()
  },
  /** The Big Thong: one enormous rubber thong on a plinth. */
  bigThong() {
    const m = new Mesher(0.05)
    plinth(m, 4.6, 2.6)
    const tilt: V = [-0.22, 0, 0]
    m.add(cyl(1, 1, 0.55, 14), C.blue, [0, 4.3, -0.4], [H - 0.22, 0, 0], [1.75, 1, 3.7])
    m.add(cyl(1, 1, 0.2, 14), C.white, [0, 4.36, -0.02], [H - 0.22, 0, 0], [1.6, 1, 3.5])
    for (const s of [-1, 1])
      m.add(box(0.3, 3.2, 0.3), C.yellow, [s * 0.75, 4.6, 0.55], [-0.22, 0, s * 0.5])
    m.add(cyl(0.2, 0.2, 0.7, 6), C.yellow, [0, 6, 0.1], [H, 0, 0])
    m.add(box(0.5, 0.5, 0.5), C.plinth, [0, 0.8, -0.2], tilt)
    return m.build()
  },
  /** The Big Meat Pie, with sauce. */
  bigPie() {
    const m = new Mesher(0.06)
    plinth(m, 6, 6)
    m.add(cyl(3, 2.5, 1.9, 14), C.pastry, [0, 1.55, 0])
    m.add(cyl(3.15, 3.15, 0.4, 14), C.crust, [0, 2.65, 0])
    m.add(cyl(2.2, 2.6, 0.5, 14), C.crust, [0, 3, 0])
    m.add(ico(1.3, 1), C.red, [0.3, 3.25, 0.4], [0, 0, 0], [1.2, 0.25, 0.9])
    m.add(ico(0.6, 1), C.red, [1.9, 2.75, 1.9], [0, 0, 0], [0.7, 1.3, 0.5])
    for (const x of [-0.9, -0.5, -0.1]) m.add(box(0.14, 0.06, 0.9), C.black, [x - 0.6, 3.27, -0.6])
    return m.build()
  },
  /** The Big Esky, lid ajar, one giant tinnie on ice. */
  bigEsky() {
    const m = new Mesher(0.05)
    plinth(m, 6.4, 4)
    m.add(box(5.6, 3.2, 3.2), C.blue, [0, 2.2, 0])
    m.add(box(5.62, 0.5, 3.22), C.white, [0, 2.6, 0])
    m.add(box(5.9, 0.6, 3.5), C.white, [0, 4.25, -0.5], [-0.3, 0, 0])
    for (const x of [-2.95, 2.95]) m.add(box(0.2, 0.3, 1.4), C.white, [x, 3, 0])
    for (const [x, z] of [
      [-1.6, 0.6],
      [-0.4, 0.9],
      [1.9, 0.5],
      [0.9, 0.9],
    ])
      m.add(box(0.8, 0.7, 0.8), C.snow, [x, 3.9, z], [0.3, x, 0.2])
    m.add(cyl(0.55, 0.55, 1.7, 10), C.yellow, [0.6, 4.4, 0.4], [0.2, 0, -0.3])
    m.add(cyl(0.56, 0.56, 0.5, 10), C.green, [0.63, 4.4, 0.4], [0.2, 0, -0.3])
    return m.build()
  },
  /** The Big Snag: a sausage in a slice of bread, sauce and all. */
  bigSnag() {
    const m = new Mesher(0.05)
    plinth(m, 6.5, 3)
    for (const s of [-1, 1]) {
      m.add(box(5.6, 0.5, 2.6), C.bread, [0, 2.3, s * 0.95], [s * 0.95, 0, 0])
      m.add(box(5.7, 0.52, 0.3), C.crust, [0, 3.35, s * 1.72], [s * 0.95, 0, 0])
    }
    m.add(cyl(0.62, 0.62, 5.6, 10), C.snag, [0, 2.6, 0], [0, 0, H])
    for (const x of [-2.8, 2.8]) m.add(ico(0.62, 1), C.snag, [x, 2.6, 0])
    for (let i = 0; i < 9; i++)
      m.add(box(0.75, 0.16, 0.2), C.red, [-2.4 + i * 0.6, 3.25, 0], [0, i % 2 ? 0.8 : -0.8, 0])
    m.add(box(0.4, 1.4, 0.4), C.plinth, [0, 1, 0])
    return m.build()
  },
}
