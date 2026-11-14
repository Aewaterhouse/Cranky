import * as THREE from 'three'
import { hash } from '../math'
import { VIS } from '../params'
import { col, type Anchor } from './chunkProps'
import { chalkRows, type Chalk, type FunSign } from './funSigns'
import { FUN } from './funVis'
import type { HeightField } from './heightField'
import { drawnHeight, type Patch } from './patch'
import type { Paint } from './paintPlan'
import { across, addBox, type Tris } from './roadGeo'
import { newPose, type RoadPath } from './roadPath'
import type { Signs } from './signs'

const R = VIS.route
const S = FUN.signs
const C = FUN.chalk
const pose = newPose()
const basis = new THREE.Matrix4()
const right = new THREE.Vector3()
const fwd = new THREE.Vector3()
const up = new THREE.Vector3()
const PT = VIS.route.place.paint
const paint = new THREE.Color()
const q = new Float64Array(12)
/** Colour on white sits this much higher, so the two never fight. */
let lift = 0

/** A painted patch on the road at `d`: a band `len` long from `o0` to `o1` across, or a disc of radius `r` round `o0`. */
function patch(out: Tris, path: RoadPath, d: number, len: number, o0: number, o1: number, r = 0) {
  if (r) {
    path.poseAt(d, pose)
    across(pose, o0, q, 0)
    q[1] += lift
    for (let k = 0; k < 6; k++) {
      const [a, b] = [(k / 6) * Math.PI * 2, ((k + 1) / 6) * Math.PI * 2]
      for (const [i, t] of [
        [3, a],
        [6, b],
      ] as const) {
        across(pose, o0 + Math.cos(t) * r, q, i)
        q[i] += pose.fx * Math.sin(t) * r
        q[i + 2] += pose.fz * Math.sin(t) * r
        q[i + 1] += lift
      }
      out.add(q, 0, 3, 6, paint)
      out.add(q, 0, 6, 3, paint)
    }
    return
  }
  across(path.poseAt(d - len / 2, pose), o0, q, 0)
  across(pose, o1, q, 3)
  across(path.poseAt(d + len / 2, pose), o1, q, 6)
  across(pose, o0, q, 9)
  for (const i of [1, 4, 7, 10]) q[i] += lift
  for (const [a, b, c] of [
    [0, 3, 6],
    [0, 6, 9],
    [0, 6, 3],
    [0, 9, 6],
  ])
    out.add(q, a, b, c, paint)
}

/**
 * Lines and dots painted across the road, into the chunk's street strips (which win the depth test against the
 * road): a white KOM band with red polka dots, a green sprint band edged in white, scattered polka dots.
 */
export function buildPaint(list: Paint[], path: RoadPath, out: Tris) {
  const H = R.roadHalf
  for (const p of list) {
    if (p.kind === 'dots') {
      for (let i = 0; i < 5; i++) {
        const o = (hash(p.d + i * 3.3) - 0.5) * H * 1.7
        const d = p.d + (hash(p.d * 1.9 + i) - 0.5) * 8
        paint.set(PT.white)
        lift = 0
        patch(out, path, d, 0, o, o, PT.dot * 1.5)
        paint.set(PT.red)
        lift = 0.02
        patch(out, path, d, 0, o, o, PT.dot)
      }
      continue
    }
    paint.set(PT.white)
    lift = 0
    patch(out, path, p.d, PT.band * (p.kind === 'sprint' ? 1.8 : 1), -H, H)
    paint.set(p.kind === 'sprint' ? PT.green : PT.red)
    lift = 0.02
    if (p.kind === 'sprint') patch(out, path, p.d, PT.band, -H, H)
    else for (let o = -H + 0.5; o < H; o += 1) patch(out, path, p.d, 0, o, o, PT.dot)
  }
}

/** Funny signs for a chunk: posts go into `solid`, the boards are returned for the chunk group. */
export function buildFunSigns(
  list: FunSign[],
  field: HeightField,
  patches: Patch[],
  solid: Tris,
  signs: Signs,
): THREE.Object3D[] {
  return list.map((f) => {
    field.path.poseAt(f.d, pose)
    // Facing back down the road, turned a little towards it.
    const face = Math.atan2(-pose.fx, -pose.fz) + f.side * S.turn
    const y = drawnHeight(field, patches, f.x, f.z)
    const n = hash(f.d)
    const [bg, fg] = f.council
      ? n < 0.5
        ? [S.yellow, S.yellowInk]
        : n < 0.8
          ? [S.greenBg, S.greenInk]
          : [S.white, S.whiteInk]
      : n < 0.65
        ? [S.ply, S.paint]
        : [S.ply2, S.paint2]
    const legs = f.council ? [-S.w * 0.36, S.w * 0.36] : [(n - 0.5) * S.w * 0.4]
    for (const o of legs)
      addBox(
        solid,
        f.x + Math.cos(face) * o,
        y + S.up / 2 - 0.5,
        f.z - Math.sin(face) * o,
        0.07,
        S.up / 2 + 0.5,
        0.07,
        face,
        col.set(f.council ? R.signs.post : S.stake),
      )
    const m = signs.plate(f.text, S.w, S.h, bg, fg, !f.council, 192)
    m.position.set(f.x - solid.ax, y + S.up - solid.ay, f.z - solid.az)
    m.rotation.set(0, face, f.council ? 0 : (n - 0.5) * 2 * S.crooked, 'YXZ')
    return m
  })
}

/** Chalk for a chunk: each line of each message is a sheet lying on the road, tilted with its slope and banking. */
export function buildChalk(
  list: Chalk[],
  path: RoadPath,
  a: Anchor,
  signs: Signs,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  for (const c of list) {
    const lines = chalkRows(c.text)
    const tint = c.colour ?? C.tints[Math.floor(c.tint * C.tints.length)]
    lines.forEach((line, i) => {
      // The top line is the furthest up the road, so the message reads as a block from the saddle.
      const p = path.poseAt(c.d + (lines.length - 1 - i) * C.letterL * C.rowGap, pose)
      const m = signs.chalk(line, tint)
      const w = line === 'ARROW' ? C.letterL * 0.8 : Math.min(C.maxW, line.length * C.letterW + 0.4)
      const cb = Math.cos(p.bank)
      right.set(p.rx * cb, -Math.sin(p.bank), p.rz * cb)
      fwd.set(p.fx, p.grade, p.fz).normalize()
      up.crossVectors(right, fwd).normalize()
      fwd.crossVectors(up, right)
      m.quaternion.setFromRotationMatrix(basis.makeBasis(right, fwd, up))
      // Wandering a little off the centre line, as chalk does.
      const off = (hash(c.d + i) - 0.5) * (R.roadHalf * 2 - w - 0.6)
      m.position.set(p.x - a.ax, p.y + C.lift - a.ay, p.z - a.az).addScaledVector(right, off)
      m.scale.set(w, C.letterL, 1)
      ;(m.material as THREE.Material).opacity = C.fade
      m.renderOrder = 1
      out.push(m)
    })
  }
  return out
}
