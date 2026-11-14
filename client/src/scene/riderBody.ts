import * as THREE from 'three'
import type { Body } from '../core/body'
import { Figure, limb, SLOT } from './figure'
import { VIS } from './params'
import { lerp } from './util'

/** The limits each body slider runs between (at 0 and at 100). Lengths in metres, the rest multipliers. */
export const BODY_RANGE = {
  height: [0.88, 1.14],
  thick: [0.72, 1.55],
  girth: [0.8, 1.4],
  belly: [0, 0.36],
  shoulders: [0.19, 0.36],
  arms: [0.8, 1.2],
  legs: [0.85, 1.15],
  calf: [0, 0.2],
  head: [0.85, 1.85],
  neck: [0.02, 0.36],
} satisfies Record<string, [number, number]>

const THIGH = 0.46
const ARM = 0.32
const TORSO = 0.6
const SKULL = 0.23

/** A body's numbers for the skeleton and the pose. */
export interface Dims {
  /** Scale of the whole rider and bike. */
  height: number
  /** Thigh and shin length (equal), and upper and lower arm length (equal). */
  leg: number
  arm: number
  /** Half the shoulder width, half the hip width, and the head's centre above the shoulder line. */
  shoulder: number
  hip: number
  headUp: number
  /** The head group's scale. */
  head: number
}

const at = (r: [number, number], v: number) => lerp(r[0], r[1], v / 100)

export function dimsOf(b: Body): Dims {
  const head = at(BODY_RANGE.head, b.head)
  return {
    height: at(BODY_RANGE.height, b.height),
    leg: THIGH * at(BODY_RANGE.legs, b.legs),
    arm: ARM * at(BODY_RANGE.arms, b.arms),
    shoulder: at(BODY_RANGE.shoulders, b.shoulders),
    hip: 0.12 * lerp(0.9, 1.25, b.build / 100),
    headUp: 0.05 + at(BODY_RANGE.neck, b.neck) + SKULL * head,
    head,
  }
}

/**
 * Everything below the head as one figure: torso (with belly and chest), hips, neck, two-part arms and legs with
 * a calf, hands and shoes. Parts are named for the pose: `torso`, `hips`, `neck`, and `thigh`, `shin`, `upper`,
 * `fore`, `hand`, `shoe` with 0 (left) or 1 (right).
 */
export function buildBody(b: Body) {
  const f = new Figure()
  const k = at(BODY_RANGE.thick, b.build)
  const g = at(BODY_RANGE.girth, b.build)
  const d = dimsOf(b)
  const belly = at(BODY_RANGE.belly, b.belly)
  const calf = at(BODY_RANGE.calf, b.calves)
  const waist = 0.2 * g
  // The chest reaches the shoulders, whatever the build.
  const chest = Math.max(0.2 * g, d.shoulder - 0.03)
  const deep = 0.7 * lerp(0.9, 1.25, b.build / 100)
  f.part('torso')
    .add(
      new THREE.CylinderGeometry(chest, waist, TORSO, 6),
      SLOT.jersey,
      [0, TORSO / 2, 0],
      [0, 0, 0],
      [1, 1, deep],
    )
    .add(
      new THREE.SphereGeometry(chest, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2),
      SLOT.jersey,
      [0, TORSO, 0],
      [0, 0, 0],
      [1, 0.35, deep],
    )
  for (const s of [-1, 1])
    f.add(new THREE.IcosahedronGeometry(VIS.bust * lerp(0.8, 1.2, b.build / 100), 0), SLOT.jersey, [
      s * 0.13 * g,
      0.4,
      -0.2 * deep + 0.02,
    ])
  if (belly > 0.02)
    f.add(
      new THREE.IcosahedronGeometry(1, 1),
      SLOT.jersey,
      [0, 0.17 + belly * 0.1, -belly * 0.55],
      [0, 0, 0],
      [Math.max(waist, belly * 0.95), belly * 0.85, belly],
    )
  f.part('hips').add(new THREE.BoxGeometry(d.hip * 2 + 0.1 * k, 0.2, 0.26 * deep), SLOT.shorts)
  f.part('neck').add(limb(0.075 * k, 0.065 * k), SLOT.skin)
  const skinLow = b.tan ? SLOT.pale : SLOT.skin
  for (const i of [0, 1]) {
    f.part(`thigh${i}`).add(limb(0.1 * k, 0.075 * k), SLOT.shorts)
    // Shin: knee to the widest of the calf, then down to the ankle (pale below the sock line with a tan).
    const shin = 0.062 * k
    f.part(`shin${i}`)
      .add(limb(shin, shin + calf), SLOT.skin, [0, 0, -0.34], [0, 0, 0], [1, 1, 0.32])
      .add(limb(shin + calf, shin * 0.8), SLOT.skin, [0, 0, 0.02], [0, 0, 0], [1, 1, 0.4])
      .add(limb(shin * 0.8, shin * 0.7), skinLow, [0, 0, 0.36], [0, 0, 0], [1, 1, 0.28])
    f.part(`upper${i}`).add(limb(0.075 * k, 0.06 * k), SLOT.jersey)
    f.part(`fore${i}`).add(limb(0.055 * k, 0.045 * k), SLOT.skin)
    f.part(`hand${i}`).add(new THREE.BoxGeometry(0.07 * k, 0.07, 0.09), skinLow)
    f.part(`shoe${i}`).add(new THREE.BoxGeometry(0.11, 0.09, 0.26), SLOT.shoe)
  }
  return f.build()
}
