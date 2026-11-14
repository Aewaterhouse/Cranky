import * as THREE from 'three'
import type { Body } from '../core/body'
import { type Figure, SLOT, type V3 } from './figure'

/** What is on the head: nothing (the creator), the helmet, or a Garage hat. */
export type Headwear = 'none' | 'helmet' | 'hat'

const R = 0.23
export const FACE_DROP = 0.03
const H = SLOT.hair
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cone = (r: number, h: number, seg = 5) => new THREE.ConeGeometry(r, h, seg)
/**
 * A shell of hair over the skull (the skull's own facets, `out` further out), kept where a facet's middle is above
 * `back` at the back of the head and above `front` over the face. `top` cuts it off above (hair under a rim).
 */
function shell(out: number, back: number, front: number, top = 1) {
  const g = ico(R + out, 1)
  const a = g.attributes.position
  const keep: number[] = []
  for (let i = 0; i < a.count; i += 3) {
    const y = (a.getY(i) + a.getY(i + 1) + a.getY(i + 2)) / 3
    const z = (a.getZ(i) + a.getZ(i + 1) + a.getZ(i + 2)) / 3
    if (y > (z < -0.06 ? front : back) && y < top)
      for (let k = i; k < i + 3; k++) keep.push(a.getX(k), a.getY(k), a.getZ(k))
  }
  g.dispose()
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(keep, 3),
  )
}

/**
 * Head hair and facial hair. Hair is built for what is worn: bare-headed styles are whole; under a helmet or hat
 * only what hangs below the rim shows, and under the helmet the tall styles (mohawk, spikes, man bun) poke through.
 */
export function addHair(f: Figure, b: Body, wear: Headwear) {
  const bare = wear === 'none'
  const through = wear !== 'hat'
  const add = (
    g: THREE.BufferGeometry,
    pos: V3 = [0, 0, 0],
    rot: V3 = [0, 0, 0],
    scale: V3 | number = 1,
  ) => f.add(g, H, pos, rot, scale)
  /** Hair round the back and sides below the rim of a helmet or hat, down to `low`. */
  const sides = (low = -0.1) => add(shell(0.012, low, 9, 0.07))
  switch (b.hair) {
    case 1: // buzz
      if (bare) add(shell(0.008, -0.06, 0.1))
      else sides(-0.06)
      break
    case 2: // short
      if (bare) add(shell(0.028, -0.1, 0.09))
      else sides()
      break
    case 3: // mullet
      if (bare) add(shell(0.026, -0.1, 0.1))
      else sides()
      add(box(0.3, 0.36, 0.07), [0, -0.2, 0.235], [0.22, 0, 0])
      add(box(0.22, 0.14, 0.06), [0, -0.4, 0.29], [0.5, 0, 0])
      break
    case 4: // mohawk
      if (through)
        for (let i = 0; i < 5; i++)
          add(
            cone(0.055, 0.3, 4),
            [0, Math.cos((i - 1.6) * 0.5) * 0.33, Math.sin((i - 1.6) * 0.5) * 0.33],
            [(i - 1.6) * 0.5, 0, 0],
            [0.6, 1, 1],
          )
      break
    case 5: // afro
      if (bare) add(ico(0.36, 1), [0, 0.09, 0.04])
      else
        for (const [x, z] of [
          [-0.25, 0.03],
          [0.25, 0.03],
          [-0.17, 0.2],
          [0.17, 0.2],
          [0, 0.27],
        ])
          add(ico(0.13, 0), [x, -0.07, z])
      break
    case 6: // man bun
      if (bare) add(shell(0.014, -0.08, 0.11))
      else sides(-0.07)
      if (through) add(ico(0.085, 0), [0, 0.2, 0.22])
      break
    case 7: // ponytail
      if (bare) add(shell(0.016, -0.08, 0.1))
      else sides(-0.07)
      add(ico(0.05, 0), [0, -0.02, 0.26])
      add(cone(0.065, 0.36, 5), [0, -0.19, 0.31], [Math.PI - 0.3, 0, 0])
      break
    case 8: // rat tail
      if (bare) add(shell(0.008, -0.06, 0.1))
      else sides(-0.05)
      add(new THREE.CylinderGeometry(0.022, 0.012, 0.5, 4), [0, -0.33, 0.25], [0.25, 0, 0])
      break
    case 9: // curtains
      if (bare) add(shell(0.026, -0.12, 0.12))
      else sides(-0.12)
      for (const s of [-1, 1])
        add(box(0.1, 0.15, 0.03), [s * 0.115, -0.015, -0.205], [0.1, s * 0.55, s * 0.28])
      break
    case 10: // comb-over: a ring of hair and three brave strands across the top
      add(shell(0.014, -0.1, 9, bare ? 0.09 : 0.04))
      if (bare)
        for (let i = 0; i < 3; i++)
          add(
            box(0.4, 0.012, 0.03),
            [0.01, 0.222 - i * i * 0.004, (i - 1) * 0.07],
            [0, 0.15, -0.12],
            [1, 1, 1],
          )
      break
    case 11: // spikes
      if (through)
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4
          const t = 0.25 + (i % 3) * 0.3
          const dir: V3 = [
            Math.sin(t) * Math.sin(a),
            Math.cos(t),
            Math.sin(t) * Math.cos(a) * 0.9 + 0.05,
          ]
          add(
            cone(0.05, 0.26, 4),
            [dir[0] * 0.33, dir[1] * 0.33, dir[2] * 0.33],
            [dir[2] * 1.1, 0, -dir[0] * 1.1],
          )
        }
      if (!bare) sides(-0.05)
      break
    case 12: // big perm
      if (bare) {
        add(ico(0.2, 0), [0, 0.2, 0.02])
        for (let i = 0; i < 7; i++)
          add(ico(0.15, 0), [
            Math.sin(i * 0.9 + 0.45) * 0.24,
            0.08 + (i % 2) * 0.06,
            Math.cos(i * 0.9 + 0.45) * 0.2 + 0.08,
          ])
      }
      for (let i = 0; i < 6; i++)
        add(ico(0.11, 0), [
          Math.sin((i - 2.5) * 0.62) * 0.27,
          -0.09 - (i % 2) * 0.05,
          Math.cos((i - 2.5) * 0.62) * 0.26,
        ])
      break
    case 13: // bowl cut
      if (bare) add(shell(0.04, -0.02, 0.06))
      else sides(-0.06)
      break
  }
  // Facial hair: moustache, handlebar, horseshoe, beard, goatee, mutton chops.
  const fy = -FACE_DROP
  const mo = (w = 0.11, h = 0.028) => add(box(w, h, 0.03), [0, fy - 0.068, -0.216])
  if (b.beard === 1) mo(0.13, 0.034)
  else if (b.beard === 2) {
    mo(0.12, 0.026)
    for (const s of [-1, 1]) {
      add(box(0.07, 0.02, 0.022), [s * 0.085, fy - 0.06, -0.21], [0, s * 0.4, s * 0.5])
      add(box(0.02, 0.05, 0.02), [s * 0.118, fy - 0.03, -0.195])
    }
  } else if (b.beard === 3) {
    mo()
    for (const s of [-1, 1])
      add(box(0.026, 0.12, 0.028), [s * 0.058, fy - 0.125, -0.185], [-0.35, 0, 0])
  } else if (b.beard === 4) {
    mo(0.12, 0.03)
    add(ico(0.17, 1), [0, fy - 0.12, -0.08], [0, 0, 0], [1.12, 0.85, 1])
  } else if (b.beard === 5) {
    mo(0.09, 0.02)
    add(cone(0.05, 0.13, 4), [0, fy - 0.185, -0.15], [Math.PI + 0.35, 0, 0])
  } else if (b.beard === 6)
    for (const s of [-1, 1])
      add(box(0.035, 0.2, 0.15), [s * 0.212, fy - 0.075, -0.075], [-0.3, 0, 0])
}
