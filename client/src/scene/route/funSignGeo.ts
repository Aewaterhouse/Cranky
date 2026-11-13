import * as THREE from 'three'
import { hash } from '../math'
import { VIS } from '../params'
import { col, type Anchor } from './chunkProps'
import type { Chalk, FunSign } from './funSigns'
import { FUN } from './funVis'
import type { HeightField } from './heightField'
import { drawnHeight, type Patch } from './patch'
import { addBox, type Tris } from './roadGeo'
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
    const lines =
      c.text === 'ARROW'
        ? [c.text]
        : c.text.split(' ').reduce<string[]>((acc, w) => {
            const last = acc[acc.length - 1]
            if (last !== undefined && last.length + w.length < 9) acc[acc.length - 1] += ` ${w}`
            else acc.push(w)
            return acc
          }, [])
    const tint = C.tints[Math.floor(c.tint * C.tints.length)]
    lines.forEach((line, i) => {
      // The top line is the furthest up the road, so the message reads as a block from the saddle.
      const p = path.poseAt(c.d + (lines.length - 1 - i) * C.letterL * 1.08, pose)
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
