import type * as THREE from 'three'
import { vehicle } from '../propGeo'
import { Mesher, box, cone, cyl, ico } from '../util'
import { FUN } from './funVis'
import { wombat } from './oddGeoBush'

const C = FUN.life.col
const H = Math.PI / 2

/** A kangaroo sitting up on its haunches. Animals face +z and stand on y = 0. */
function roo() {
  const m = new Mesher(0.08)
  m.add(ico(0.36), C.roo, [0, 0.72, 0], [0.5, 0, 0], [0.8, 1.35, 0.9])
  m.add(ico(0.2), C.rooBelly, [0, 0.74, 0.2], [0.5, 0, 0], [0.8, 1.5, 0.6])
  m.add(box(0.14, 0.14, 1), C.roo, [0, 0.22, -0.6], [-0.3, 0, 0])
  for (const x of [-0.2, 0.2]) {
    m.add(box(0.16, 0.5, 0.3), C.roo, [x, 0.4, -0.02], [-0.5, 0, 0])
    m.add(box(0.12, 0.08, 0.55), C.roo, [x, 0.05, 0.2])
    m.add(box(0.07, 0.3, 0.07), C.roo, [x * 0.8, 0.95, 0.32], [0.9, 0, 0])
    m.add(cone(0.06, 0.24, 4), C.roo, [x * 0.5, 1.6, 0.12])
  }
  m.add(box(0.16, 0.36, 0.16), C.roo, [0, 1.22, 0.14], [0.2, 0, 0])
  m.add(box(0.18, 0.18, 0.34), C.roo, [0, 1.42, 0.24])
  m.add(box(0.1, 0.08, 0.06), C.black, [0, 1.4, 0.42])
  return m.build()
}

/** A black and white cow, head down. */
function cow() {
  const m = new Mesher(0.06)
  m.add(box(0.75, 0.8, 1.8), C.cow, [0, 1.1, 0])
  m.add(box(0.77, 0.5, 0.7), C.cowPatch, [0, 1.2, -0.3])
  m.add(box(0.77, 0.35, 0.4), C.cowPatch, [0, 0.95, 0.6])
  m.add(box(0.4, 0.4, 0.7), C.cow, [0, 0.95, 1.2], [0.6, 0, 0])
  m.add(box(0.34, 0.3, 0.3), C.cowPatch, [0, 0.72, 1.45], [0.6, 0, 0])
  m.add(box(0.3, 0.2, 0.3), C.udder, [0, 0.62, -0.5])
  m.add(box(0.06, 0.7, 0.06), C.cowPatch, [0, 1.05, -0.95], [0.15, 0, 0])
  for (const x of [-0.27, 0.27])
    for (const z of [-0.7, 0.7]) m.add(box(0.16, 0.75, 0.16), C.cow, [x, 0.37, z])
  return m.build()
}

/** A sheep: a ball of wool with a black face. */
function sheep() {
  const m = new Mesher(0.05)
  m.add(ico(0.42, 1), C.sheep, [0, 0.62, 0], [0, 0, 0], [1, 0.9, 1.4])
  m.add(box(0.2, 0.24, 0.3), C.black, [0, 0.7, 0.62], [0.3, 0, 0])
  for (const x of [-0.18, 0.18])
    for (const z of [-0.3, 0.3]) m.add(box(0.08, 0.36, 0.08), C.black, [x, 0.18, z])
  return m.build()
}

/** A bird's body in `body` with a `beak`, and an optional crest. Its wings are a separate mesh so they can flap. */
function bird(body: string, beak: string, s: number, crest?: string, bib?: string) {
  const m = new Mesher(0.04)
  m.add(ico(0.13 * s), body, [0, 0, 0], [0, 0, 0], [0.9, 0.9, 2])
  m.add(ico(0.09 * s), body, [0, 0.09 * s, 0.24 * s])
  m.add(cone(0.035 * s, 0.12 * s, 4), beak, [0, 0.07 * s, 0.36 * s], [H, 0, 0])
  m.add(box(0.12 * s, 0.02 * s, 0.26 * s), body, [0, 0.02 * s, -0.32 * s])
  if (crest) m.add(box(0.03 * s, 0.14 * s, 0.1 * s), crest, [0, 0.22 * s, 0.2 * s], [-0.5, 0, 0])
  if (bib) m.add(ico(0.1 * s), bib, [0, -0.03 * s, 0.05 * s], [0, 0, 0], [0.95, 0.8, 1.8])
  return m.build()
}

/** One wing reaching out along +x from the shoulder at the origin; the other is the same turned round. */
function wing(colour: string, s: number, tip?: string) {
  const m = new Mesher(0.04)
  m.add(box(0.34 * s, 0.02, 0.2 * s), colour, [0.17 * s, 0, 0])
  m.add(box(0.26 * s, 0.02, 0.14 * s), tip ?? colour, [0.46 * s, 0, -0.02 * s])
  return m.build()
}

/** A lyrebird: a plain brown bird hauling an enormous tail. */
function lyrebird() {
  const m = new Mesher(0.05)
  m.add(ico(0.2), C.lyre, [0, 0.42, 0], [0, 0, 0], [0.9, 0.9, 1.5])
  m.add(box(0.07, 0.24, 0.07), C.lyre, [0, 0.6, 0.24], [0.4, 0, 0])
  m.add(ico(0.08), C.lyre, [0, 0.74, 0.3])
  m.add(cone(0.03, 0.1, 4), C.black, [0, 0.73, 0.4], [H, 0, 0])
  for (const x of [-0.07, 0.07]) m.add(box(0.03, 0.3, 0.03), C.black, [x, 0.15, 0])
  for (let i = -3; i <= 3; i++)
    m.add(
      box(0.05, 0.02, 1.1),
      Math.abs(i) === 3 ? C.lyreTail : C.gullWing,
      [i * 0.08, 0.75, -0.6],
      [0.75, i * 0.14, 0],
    )
  return m.build()
}

/** A caravan to be towed: nose on -z like the vehicles. */
function trailer() {
  const m = new Mesher(0.05)
  m.add(box(2.1, 1.9, 4.2), C.paint, [0, 1.5, 0])
  m.add(box(2.12, 0.3, 4.22), C.stripe, [0, 1.2, 0])
  m.add(box(2.12, 0.5, 1.2), C.glass, [0, 1.9, -0.8])
  m.add(box(0.1, 0.1, 1.6), C.black, [0, 0.6, -2.8])
  for (const x of [-1, 1]) m.add(cyl(0.36, 0.36, 0.24, 8), C.black, [x, 0.36, 0.2], [0, 0, H])
  return m.build()
}

/** A tourist coach: long, tall, a band of dark glass, a stripe. */
function coach() {
  const m = new Mesher(0.04)
  m.add(box(2.5, 2.9, 11), C.paint, [0, 1.95, 0])
  m.add(box(2.52, 0.95, 10.4), C.glass, [0, 2.45, 0])
  m.add(box(2.3, 1.2, 0.1), C.glass, [0, 2.3, -5.5])
  m.add(box(2.52, 0.3, 11.02), C.stripe, [0, 1.3, 0])
  m.add(box(2.4, 0.25, 0.2), C.black, [0, 0.55, -5.5])
  for (const x of [-0.8, 0.8]) m.add(box(0.4, 0.16, 0.06), C.lamp, [x, 0.95, -5.52])
  for (const z of [-3.6, 3, 4.1])
    for (const x of [-1.2, 1.2]) m.add(cyl(0.5, 0.5, 0.3, 8), C.black, [x, 0.5, z], [0, 0, H])
  return m.build()
}

function wombatGeo() {
  const m = new Mesher(0.06)
  wombat(m, 0, 0, 1.2)
  return m.build().rotateY(-H)
}

/** Every body shape the wildlife and traffic need, by name. Built on first use and kept. */
export const LIFE_GEO: Record<string, () => THREE.BufferGeometry> = {
  roos: roo,
  cows: cow,
  sheep,
  cockatoos: () => bird(C.cockatoo, C.black, 2.2, C.crest),
  galahs: () => bird(C.galah, C.cockatoo, 2, C.galahCrest),
  seagulls: () => bird(C.gull, C.crest, 2),
  magpie: () => bird(C.black, C.cockatoo, 2.2, undefined, C.cockatoo),
  cockatoosWing: () => wing(C.cockatoo, 2.2, C.crest),
  galahsWing: () => wing(C.galahWing, 2),
  seagullsWing: () => wing(C.gullWing, 2.2, C.black),
  magpieWing: () => wing(C.black, 2.3, C.cockatoo),
  wombat: wombatGeo,
  lyrebird,
  ute: () => vehicle('ute'),
  caravan: () => vehicle('sedan'),
  caravanTow: trailer,
  coach,
}
