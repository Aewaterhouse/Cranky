import { Mesher, box, cone, cyl, ico } from '../util'
import { FUN } from './funVis'

const C = FUN.odd.col
const H = Math.PI / 2

/** Four wheels lying on their axle along z, at the corners of a `wx` by `wz` rectangle. */
function wheels(m: Mesher, wx: number, wz: number, r = 0.34) {
  for (const x of [-wx, wx])
    for (const z of [-wz, wz]) m.add(cyl(r, r, 0.22, 8), C.tyre, [x, r, z], [H, 0, 0])
}

/** Homes and streets: all built with the front on +z and the long side along x, standing on y = 0. */
export const HOME = {
  /** A three-seater left on the nature strip. */
  couch() {
    const m = new Mesher(0.12)
    m.add(box(2.1, 0.5, 0.95), C.couch, [0, 0.3, 0])
    m.add(box(2.1, 0.75, 0.28), C.couch, [0, 0.85, -0.36], [-0.12, 0, 0])
    for (const x of [-1.1, 1.1]) m.add(box(0.26, 0.7, 0.98), C.couch, [x, 0.5, 0])
    for (const x of [-0.5, 0.5]) m.add(box(0.92, 0.16, 0.7), C.cushion, [x, 0.62, 0.1])
    m.add(box(0.9, 0.14, 0.66), C.cushion, [0.9, 0.2, 0.9], [0.1, 0.5, 0.2])
    return m.build()
  },
  /** A ute with no wheels, up on besser blocks, bonnet open, one tyre left behind. */
  ute() {
    const m = new Mesher(0.14)
    m.add(box(4.6, 0.55, 1.75), C.ute, [0, 0.95, 0])
    m.add(box(1.5, 0.62, 1.65), C.ute, [0.35, 1.5, 0])
    m.add(box(1.52, 0.4, 1.5), C.glass, [0.35, 1.52, 0])
    m.add(box(1.3, 0.6, 1.76), C.rust, [-1.5, 1.05, 0])
    m.add(box(1.3, 0.06, 1.6), C.ute, [1.9, 1.75, 0], [0, 0, -0.9])
    m.add(box(0.7, 0.3, 1.2), C.black, [1.7, 1.1, 0])
    for (const x of [-1.5, 1.5])
      for (const z of [-0.6, 0.6]) m.add(box(0.42, 0.68, 0.42), C.besser, [x, 0.34, z])
    m.add(cyl(0.36, 0.36, 0.24, 8), C.tyre, [0.6, 0.12, 1.7])
    return m.build()
  },
  /** A shopping trolley a long way from the shops, on its side. */
  trolley() {
    const m = new Mesher(0.08)
    // A wire basket on its side: rails round each end and along each edge, dark so the gaps read as mesh.
    for (const x of [-0.6, 0, 0.6]) {
      for (const z of [-0.36, 0.36]) m.add(box(0.05, 0.75, 0.05), C.steel, [x, 0.42, z])
      for (const y of [0.06, 0.78]) m.add(box(0.05, 0.05, 0.75), C.steel, [x, y, 0])
    }
    for (const y of [0.06, 0.3, 0.54, 0.78])
      for (const z of [-0.36, 0.36]) m.add(box(1.25, 0.04, 0.04), C.steel, [0, y, z])
    for (const z of [-0.2, 0, 0.2]) m.add(box(1.25, 0.04, 0.04), C.steel, [0, 0.06, z])
    m.add(box(0.1, 0.12, 0.85), C.red, [-0.55, 1.1, 0])
    for (const z of [-0.3, 0.3]) m.add(cyl(0.1, 0.1, 0.08, 6), C.tyre, [0.75, 0.75, z], [H, 0, 0])
    return m.build()
  },
  /** Five letterboxes on a rail: a microwave, a milk can, an esky, a proper one and a fuel drum. */
  letterboxes() {
    const m = new Mesher(0.1)
    m.add(box(5, 0.12, 0.14), C.oldTimber, [0, 1, 0])
    for (const x of [-2.3, -1.15, 0, 1.15, 2.3]) m.add(box(0.12, 1, 0.12), C.oldTimber, [x, 0.5, 0])
    m.add(box(0.75, 0.45, 0.5), C.white, [-2.1, 1.3, 0])
    m.add(box(0.42, 0.3, 0.04), C.black, [-2.2, 1.3, 0.26])
    m.add(cyl(0.26, 0.3, 0.6, 8), C.steel, [-1.05, 1.36, 0])
    m.add(cyl(0.16, 0.26, 0.22, 8), C.steel, [-1.05, 1.76, 0])
    m.add(box(0.7, 0.42, 0.45), C.blue, [0, 1.28, 0])
    m.add(box(0.74, 0.1, 0.49), C.white, [0, 1.54, 0])
    m.add(box(0.4, 0.34, 0.6), C.green, [1.1, 1.24, 0])
    m.add(cone(0.36, 0.2, 4), C.red, [1.1, 1.5, 0], [0, Math.PI / 4, 0], [0.8, 1, 1.2])
    m.add(cyl(0.27, 0.27, 0.7, 8), C.red, [2.2, 1.34, 0], [H, 0, 0])
    m.add(box(0.08, 0.5, 0.04), C.yellow, [2.5, 1.5, 0.2])
    return m.build()
  },
  /** A Hills hoist with the washing out, leaning the way they all do. */
  hoist() {
    const m = new Mesher(0.06)
    m.add(cyl(0.05, 0.06, 2.3, 6), C.steel, [0, 1.15, 0], [0, 0, 0.06])
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.4
      m.add(box(2.3, 0.05, 0.05), C.steel, [Math.cos(a) * 1.1, 2.3, -Math.sin(a) * 1.1], [0, a, 0])
      m.add(
        box(3.1, 0.03, 0.03),
        C.steel,
        [Math.cos(a + 0.79) * 1.55, 2.32, -Math.sin(a + 0.79) * 1.55],
        [0, a + 0.79 + H, 0],
      )
    }
    const wash = [C.white, C.red, C.blue, C.yellow, C.pink, C.white, C.teal]
    wash.forEach((c, i) => {
      const a = i * 0.9 + 0.3
      const r = 1.2 + (i % 3) * 0.25
      const h = 0.4 + (i % 3) * 0.25
      m.add(box(0.7, h, 0.03), c, [Math.cos(a) * r, 2.28 - h / 2, -Math.sin(a) * r], [0, a + H, 0])
    })
    return m.build()
  },
  /** Bin night: wheelie bins in a row, one knocked over. */
  bins() {
    const m = new Mesher(0.06)
    const lids = [C.red, C.yellow, C.red, C.green, C.yellow]
    lids.forEach((lid, i) => {
      const x = -1.8 + i * 0.85
      const over = i === 3
      const rot: [number, number, number] = over ? [H, 0, 0.2] : [0, (i % 2) * 0.2 - 0.1, 0]
      const y = over ? 0.33 : 0.55
      m.add(box(0.58, 1, 0.66), C.binGreen, [x, y, over ? 0.6 : 0], rot)
      m.add(
        box(0.64, 0.09, 0.74),
        lid,
        over ? [x, 0.33, 1.2] : [x, 1.1, 0.02],
        over ? [H + 0.5, 0, 0.2] : [i === 1 ? -0.5 : 0, rot[1], 0],
      )
    })
    return m.build()
  },
  /** A caravan parked up for the long haul, awning out, chair waiting. */
  caravan() {
    const m = new Mesher(0.05)
    m.add(box(4.4, 1.9, 2.1), C.white, [0, 1.5, 0])
    m.add(box(4.42, 0.3, 2.12), C.orange, [0, 1.2, 0])
    m.add(box(4.1, 0.25, 1.9), C.white, [0, 2.5, 0])
    m.add(box(1.3, 0.55, 0.06), C.glass, [-0.9, 1.8, 1.06])
    m.add(box(0.65, 1.5, 0.06), C.besser, [1.3, 1.35, 1.06])
    m.add(box(1.6, 0.08, 0.08), C.steel, [3, 0.6, 0])
    m.add(cyl(0.05, 0.05, 0.6, 5), C.steel, [3.6, 0.3, 0])
    for (const z of [-1, 1]) m.add(cyl(0.34, 0.34, 0.22, 8), C.tyre, [-0.3, 0.34, z], [H, 0, 0])
    for (let i = 0; i < 6; i++)
      m.add(box(0.6, 0.05, 1.7), i % 2 ? C.white : C.teal, [-1.5 + i * 0.6, 2.2, 1.9], [0.22, 0, 0])
    for (const x of [-1.75, 1.75]) m.add(cyl(0.03, 0.03, 2, 4), C.steel, [x, 1, 2.7])
    m.add(box(0.6, 0.06, 0.55), C.red, [-0.6, 0.45, 2.1])
    m.add(box(0.6, 0.6, 0.06), C.red, [-0.6, 0.75, 1.8], [-0.3, 0, 0])
    return m.build()
  },
  /** A tin bus shelter that has seen some weather. */
  shelter() {
    const m = new Mesher(0.1)
    const lean: [number, number, number] = [0, 0, 0.1]
    m.add(box(2.8, 2.2, 0.08), C.tin, [0.1, 1.1, -0.7], lean)
    for (const x of [-1.25, 1.45]) m.add(box(0.08, 2.2, 1.4), C.tin, [x, 1.1, 0], lean)
    m.add(box(3.2, 0.08, 1.9), C.rust, [-0.12, 2.25, 0.15], [0.08, 0, 0.1])
    m.add(box(2.3, 0.1, 0.4), C.timber, [0.05, 0.5, -0.35])
    m.add(box(0.5, 0.7, 0.04), C.white, [0.9, 1.5, -0.64], lean)
    for (const x of [-0.9, 1]) m.add(box(0.1, 0.5, 0.36), C.oldTimber, [x, 0.25, -0.35])
    return m.build()
  },
  /** A tinnie on a trailer, ready for a fishing trip that keeps not happening. */
  tinnie() {
    const m = new Mesher(0.06)
    m.add(box(3.4, 0.5, 1.5), C.tin, [-0.2, 1.05, 0])
    m.add(box(3.2, 0.3, 1.3), C.besser, [-0.2, 1.18, 0])
    m.add(cone(0.75, 1.3, 4), C.tin, [2.1, 1.05, 0], [0, 0, -H], [0.48, 1, 1.41])
    m.add(box(0.3, 0.75, 0.4), C.black, [-2.05, 1.25, 0])
    m.add(box(0.12, 0.55, 0.12), C.black, [-2.05, 0.7, 0])
    m.add(box(1.4, 0.06, 0.3), C.oldTimber, [0.2, 1.26, 0], [0, H, 0])
    m.add(box(5, 0.1, 0.12), C.rust, [0.4, 0.62, 0])
    m.add(box(0.1, 0.1, 1.9), C.rust, [-0.6, 0.6, 0])
    for (const z of [-1, 1]) m.add(cyl(0.3, 0.3, 0.2, 8), C.tyre, [-0.6, 0.3, z], [H, 0, 0])
    m.add(cyl(0.04, 0.04, 0.6, 4), C.steel, [2.7, 0.3, 0])
    return m.build()
  },
  /** A two-tone surf van with boards on the roof. */
  kombi() {
    const m = new Mesher(0.05)
    m.add(box(4.3, 0.85, 1.8), C.teal, [0, 0.85, 0])
    m.add(box(4.3, 0.75, 1.8), C.white, [0, 1.65, 0])
    m.add(box(4.1, 0.12, 1.7), C.white, [0, 2.08, 0])
    m.add(box(3, 0.45, 1.82), C.glass, [-0.3, 1.7, 0])
    m.add(box(0.06, 0.5, 1.5), C.glass, [2.16, 1.7, 0])
    for (const z of [-0.5, 0.5]) m.add(cyl(0.14, 0.14, 0.06, 8), C.yellow, [2.17, 1, z], [0, 0, H])
    m.add(box(0.06, 0.5, 0.5), C.white, [2.17, 1.05, 0])
    wheels(m, 1.4, 0.85)
    m.add(ico(1), C.orange, [-0.2, 2.3, -0.3], [0, 0.05, 0], [1.5, 0.05, 0.3])
    m.add(ico(1), C.yellow, [0.1, 2.38, 0.3], [0, -0.06, 0], [1.3, 0.05, 0.28])
    return m.build()
  },
  /** An old fridge by the road with a second career. */
  fridge() {
    const m = new Mesher(0.08)
    m.add(box(0.8, 1.75, 0.72), C.white, [0, 0.9, 0], [0, 0, 0.04])
    m.add(box(0.78, 0.5, 0.06), C.rust, [0.02, 0.3, 0.36], [0, 0, 0.04])
    m.add(box(0.06, 0.5, 0.08), C.steel, [-0.32, 1.25, 0.4])
    m.add(box(0.5, 0.3, 0.4), C.oldTimber, [0.9, 0.15, 0.1], [0, 0.4, 0])
    return m.build()
  },
  /** A council picnic table, a brick barbecue and a bin. */
  picnic() {
    const m = new Mesher(0.08)
    m.add(box(2.2, 0.08, 0.9), C.timber, [0, 0.78, 0])
    for (const z of [-0.8, 0.8]) m.add(box(2.2, 0.07, 0.3), C.timber, [0, 0.45, z])
    for (const x of [-0.85, 0.85]) {
      m.add(box(0.1, 0.78, 0.1), C.steel, [x, 0.39, 0])
      m.add(box(0.08, 0.08, 1.8), C.steel, [x, 0.4, 0])
    }
    m.add(box(1.2, 0.85, 0.8), C.rust, [2.6, 0.42, -0.4])
    m.add(box(1.25, 0.06, 0.85), C.steel, [2.6, 0.88, -0.4])
    m.add(cyl(0.3, 0.26, 0.85, 8), C.binGreen, [-2, 0.42, -0.6])
    return m.build()
  },
  /** Witches hats and a barrier around nothing in particular. */
  roadworks() {
    const m = new Mesher(0.05)
    for (const [x, z, tip] of [
      [-2.2, 0.3, 0],
      [-1.1, 0.5, 0],
      [0.1, 0.6, 0],
      [1.4, 0.45, 1],
      [2.3, 0.2, 0],
    ]) {
      const rot: [number, number, number] = tip ? [0, 0.6, H] : [0, 0, 0]
      m.add(cone(0.2, 0.7, 8), C.orange, [x, tip ? 0.2 : 0.38, z], rot)
      m.add(box(0.5, 0.05, 0.5), C.orange, [tip ? x + 0.36 : x, tip ? 0.25 : 0.03, z], rot)
    }
    for (let i = 0; i < 6; i++)
      m.add(box(0.4, 0.24, 0.05), i % 2 ? C.white : C.orange, [-1 + i * 0.4, 0.95, -0.5])
    for (const x of [-0.9, 0.9]) {
      m.add(box(0.06, 1.1, 0.06), C.steel, [x, 0.55, -0.35], [0.3, 0, 0])
      m.add(box(0.06, 1.1, 0.06), C.steel, [x, 0.55, -0.65], [-0.3, 0, 0])
    }
    return m.build()
  },
  /** Lawn flamingos and a gnome keeping watch. */
  flamingos() {
    const m = new Mesher(0.06)
    for (const [x, z, s] of [
      [-0.9, 0, 1],
      [0, -0.4, 1.15],
      [0.8, 0.2, 0.9],
    ]) {
      m.add(cyl(0.025, 0.025, 1.1 * s, 4), C.black, [x, 0.55 * s, z])
      m.add(ico(0.3 * s), C.pink, [x, 1.2 * s, z], [0, 0, 0], [1.3, 0.8, 0.7])
      m.add(box(0.07, 0.6 * s, 0.07), C.pink, [x + 0.34 * s, 1.55 * s, z], [0, 0, -0.35])
      m.add(ico(0.11 * s), C.pink, [x + 0.48 * s, 1.88 * s, z])
      m.add(cone(0.05, 0.2, 4), C.black, [x + 0.62 * s, 1.84 * s, z], [0, 0, -2])
    }
    m.add(cyl(0.2, 0.24, 0.45, 6), C.blue, [1.6, 0.22, 0.5])
    m.add(ico(0.17), C.white, [1.6, 0.52, 0.56])
    m.add(cone(0.2, 0.5, 6), C.red, [1.6, 0.9, 0.5])
    return m.build()
  },
}
