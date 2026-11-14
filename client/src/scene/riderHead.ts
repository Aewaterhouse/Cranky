import * as THREE from 'three'
import type { Body } from '../core/body'
import { Figure, SLOT, type V3 } from './figure'
import { addHair, FACE_DROP, type Headwear } from './riderHair'
import { lerp } from './util'

const R = 0.23
/** The face sits this far below the middle of the skull, leaving the forehead to helmets and hats. */
const DROP = FACE_DROP
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
/** How far forward the face is at height `y` and `x` off centre (the skull is a ball; forward is -z). */
const face = (x: number, y: number) => -Math.sqrt(Math.max(0.01, R * R - x * x - y * y))

function eyes(f: Figure, b: Body) {
  const gap = lerp(0.055, 0.125, b.eyeGap / 100)
  const s = lerp(0.6, 1.7, b.eyeSize / 100)
  const y = 0.035 - DROP
  if (b.googly) {
    // Big white balls with a small pupil each looking its own way.
    const r = 0.06 * s
    for (const side of [-1, 1]) {
      const x = side * Math.max(gap, r * 0.9)
      const z = face(x, y) - r * 0.45
      f.add(ico(r, 1), SLOT.white, [x, y, z])
      f.add(ico(r * 0.42, 0), SLOT.dark, [
        x + r * 0.35 * (side > 0 ? 1 : -0.2),
        y - r * 0.45 * side,
        z - r * 0.72,
      ])
    }
    return
  }
  // Round, wide, sleepy (a lid over the top half), narrow, tall.
  const [w, h] = (
    [
      [1, 1],
      [1.35, 0.8],
      [1.1, 1],
      [1.3, 0.45],
      [0.8, 1.4],
    ] as const
  )[b.eyeShape] ?? [1, 1]
  const r = 0.046 * s
  for (const side of [-1, 1]) {
    const x = side * gap
    const z = face(x, y) - 0.004
    f.add(ico(r, 0), SLOT.white, [x, y, z], [0, 0, 0], [w, h, 0.45])
    f.add(
      new THREE.CylinderGeometry(r * 0.68, r * 0.68, 0.01, 6),
      SLOT.iris,
      [x, y - r * 0.08, z - r * 0.36],
      [Math.PI / 2, 0, 0],
      [Math.min(1, w), Math.min(1, h * 1.1), 1],
    )
    f.add(box(r * 0.36, r * 0.36 * Math.min(1, h * 1.2), 0.01), SLOT.dark, [
      x,
      y - r * 0.08,
      z - r * 0.4,
    ])
    if (b.eyeShape === 2)
      f.add(box(r * 2.4 * w, r * h, r * 0.7), SLOT.skin, [x, y + r * h * 0.55, z - r * 0.2])
  }
}

function brows(f: Figure, b: Body) {
  if (!b.brows) return
  const gap = lerp(0.055, 0.125, b.eyeGap / 100)
  const up = 0.035 - DROP + lerp(0.6, 1.7, b.eyeSize / 100) * (b.googly ? 0.07 : 0.042) + 0.008
  const z = face(gap, up) - 0.008
  // Thin, thick, bushy, unibrow, angry, worried.
  const [w, h, d] = (
    [
      [0.07, 0.012, 0.012],
      [0.08, 0.024, 0.016],
      [0.1, 0.042, 0.035],
      [0, 0.03, 0.02],
      [0.08, 0.022, 0.016],
      [0.08, 0.02, 0.016],
    ] as V3[]
  )[b.brows - 1]
  if (b.brows === 4) return void f.add(box(gap * 2 + 0.09, h, d), SLOT.hair, [0, up, z + 0.012])
  const tilt = b.brows === 5 ? 0.45 : b.brows === 6 ? -0.4 : 0.06
  for (const side of [-1, 1])
    f.add(box(w, h, d), SLOT.hair, [side * gap, up, z], [0, side * 0.3, side * tilt])
}

function nose(f: Figure, b: Body) {
  const s = lerp(0.6, 2.4, b.noseSize / 100)
  const y = -0.03 - DROP
  const z = face(0, y)
  if (b.noseShape === 1)
    f.add(
      new THREE.ConeGeometry(0.03 * s, 0.09 * s, 4),
      SLOT.skin,
      [0, y, z - 0.03 * s],
      [-Math.PI / 2, 0, 0],
    )
  else if (b.noseShape === 2)
    f.add(box(0.085 * s, 0.045 * s, 0.05 * s), SLOT.skin, [0, y - 0.005, z - 0.015 * s])
  else if (b.noseShape === 3) {
    f.add(
      box(0.035 * s, 0.08 * s, 0.05 * s),
      SLOT.skin,
      [0, y + 0.01 * s, z - 0.02 * s],
      [0.5, 0, 0],
    )
    f.add(box(0.04 * s, 0.03 * s, 0.04 * s), SLOT.skin, [0, y - 0.03 * s, z - 0.045 * s])
  } else
    f.add(
      ico(0.033 * s, 0),
      b.noseShape === 4 ? SLOT.red : SLOT.skin,
      [0, y, z - 0.012 * s],
      [0, 0, 0],
      b.noseShape === 4 ? 1.5 : 1,
    )
}

function mouth(f: Figure, b: Body) {
  // A beard sits in front of the chin, so the mouth comes forward with it.
  const y = -0.105 - DROP
  const z = face(0, y) - (b.beard === 4 ? 0.062 : 0.006)
  const bar = (w: number, h: number, slot: number, x = 0, dy = 0, rot = 0, dz = 0) =>
    f.add(box(w, h, 0.012), slot as 0, [x, y + dy, z + dz], [0, 0, rot])
  const curve = (dir: number) => {
    bar(0.07, 0.014, SLOT.dark)
    for (const s of [-1, 1])
      bar(0.04, 0.014, SLOT.dark, s * 0.048, dir * 0.01, s * dir * 0.55, 0.006)
  }
  if (b.mouth === 1) curve(1)
  else if (b.mouth === 5) curve(-1)
  else if (b.mouth === 2 || b.mouth === 3) {
    bar(0.125, 0.05, SLOT.dark, 0, 0, 0, 0.004)
    bar(0.105, 0.032, SLOT.white)
    if (b.mouth === 3) bar(0.018, 0.034, SLOT.dark, 0, 0, 0, -0.003)
  } else if (b.mouth === 4) {
    bar(0.08, 0.012, SLOT.dark, 0, 0.012)
    for (const s of [-1, 1]) bar(0.022, 0.04, SLOT.white, s * 0.013, -0.012, 0, -0.008)
  } else if (b.mouth === 6)
    f.add(ico(0.035, 0), SLOT.dark, [0, y - 0.01, z + 0.012], [0, 0, 0], [0.9, 1.2, 0.4])
  else bar(0.08, 0.013, SLOT.dark)
}

/** A rider's head as one figure centred on the skull: face, ears, hair and facial hair for what is worn on it. */
export function buildHead(b: Body, wear: Headwear) {
  const f = new Figure().part('head')
  f.add(ico(R, 1), SLOT.skin)
  const ear = lerp(0.5, 2.2, b.ears / 100)
  for (const s of [-1, 1])
    f.add(
      ico(0.045, 0),
      SLOT.skin,
      [s * (R + 0.012 * ear), -DROP, 0.01],
      [0, s * 0.5, 0],
      [0.45 * ear, ear, 0.8 * ear],
    )
  eyes(f, b)
  brows(f, b)
  nose(f, b)
  mouth(f, b)
  addHair(f, b, wear)
  return f.build()
}
