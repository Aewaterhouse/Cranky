import * as THREE from 'three'
import { VIS } from '../params'
import { Mesher, cyl } from '../util'
import { col, instances, pos, quat, scale, UP } from './chunkProps'
import type { Features } from './features'
import { railRows, type Furn } from './furniture'
import type { HeightField } from './heightField'
import { drawnHeight, type Patch } from './patch'
import { addBeam, addBox, type Tris } from './roadGeo'
import { newPose } from './roadPath'
import type { Signs } from './signs'

const R = VIS.route
const F = R.place.furniture
const pose = newPose()
const a3 = [0, 0, 0]
const b3 = [0, 0, 0]
/** Roadside plates: [width, height, centre height, background, text colour]. */
const PLATES: Record<'km' | 'grade' | 'hairpin', () => [number, number, number, string, string]> = {
  km: () => [1.1, 1.1, 1.6, F.kmBg, '#ffffff'],
  grade: () => [1.5, 1.5, 2.4, F.gradeBg, F.gradeFg],
  hairpin: () => [1.5, 1.5, 2.4, F.hairpinBg, '#ffffff'],
}

let arch: THREE.BufferGeometry | undefined
/** A chunky inflatable arch over the road, white with pale hoops, tinted per arch. */
function archGeo() {
  if (arch) return arch
  const m = new Mesher(0.05)
  const x = R.roadHalf + R.verge + 0.9
  for (const s of [-1, 1]) {
    m.add(cyl(0.6, 0.72, F.archH, 8), '#ffffff', [x * s, F.archH / 2, 0])
    for (const y of [1.2, 2.6, 4]) m.add(cyl(0.7, 0.7, 0.3, 8), '#d2d2d2', [x * s, y, 0])
  }
  m.add(cyl(0.62, 0.62, x * 2 + 1.2, 8), '#ffffff', [0, F.archH, 0], [0, 0, Math.PI / 2])
  return (arch = m.build())
}
export function dropFurnitureGeos() {
  arch?.dispose()
  arch = undefined
}

/** Signs and arches for a chunk: posts go into `solid`, plates and arches are returned for the chunk group. */
export function buildFurniture(
  list: Furn[],
  field: HeightField,
  patches: Patch[],
  solid: Tris,
  signs: Signs,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  for (const f of list) {
    field.path.poseAt(f.d, pose)
    const face = Math.atan2(-pose.fx, -pose.fz)
    if (f.kind === 'start' || f.kind === 'summit' || f.kind === 'finish') {
      const { x, y, z } = pose
      const tint = F[f.kind]
      const m = instances(archGeo(), 1, solid, () => {
        pos.set(x, y - 0.2, z)
        quat.setFromAxisAngle(UP, face)
        scale.setScalar(1)
        col.set(tint)
      })
      m.castShadow = true
      const banner = signs.plate(f.text, R.roadHalf * 2 + 1, 1.25, tint, '#ffffff')
      banner.position.set(x - solid.ax, y + F.archH - 1.45 - solid.ay, z - solid.az)
      banner.rotation.y = face
      out.push(m, banner)
      continue
    }
    const [w, h, up, bg, fg] = PLATES[f.kind]()
    const o = f.side * (R.roadHalf + R.verge + F.signOut)
    const x = pose.x + pose.rx * o
    const z = pose.z + pose.rz * o
    const y = drawnHeight(field, patches, x, z)
    const top = up - h / 2
    addBox(solid, x, y + top / 2, z, 0.06, top / 2, 0.06, face, col.set(R.signs.post))
    const m = signs.plate(f.text, w, h, bg, fg)
    m.position.set(x - solid.ax, y + up - solid.ay, z - solid.az)
    m.rotation.y = face
    out.push(m)
  }
  return out
}

/**
 * Guard rails where the ground falls away beside the road, and white edge posts with reflectors round bends.
 * All of it goes into the chunk's own mesh, standing on the verge's outer edge.
 */
export function buildRails(patches: Patch[], field: HeightField, features: Features, solid: Tris) {
  for (const pt of patches) {
    const on = railRows(pt)
    const at = (j: number, out: number[]) => {
      const i = pt.at(j, 0)
      out[0] = pt.p[i]
      out[1] = pt.p[i + 1]
      out[2] = pt.p[i + 2]
      return out
    }
    // A rail stops for a side street.
    for (let j = 0; j <= pt.rows; j++)
      if (on[j] && features.blocked(pt.p[pt.at(j, 0)], pt.p[pt.at(j, 0) + 2], 0.5)) on[j] = 0
    for (let j = 0; j <= pt.rows; j++) {
      at(j, a3)
      if (on[j]) {
        addBox(
          solid,
          a3[0],
          a3[1] + F.railH / 2,
          a3[2],
          0.07,
          F.railH / 2,
          0.07,
          0,
          col.set(F.railPost),
        )
        if (j < pt.rows && on[j + 1])
          addBeam(solid, a3, at(j + 1, b3), F.railH - 0.32, F.railH, 0.1, col.set(F.rail))
      } else if (j % F.postEvery === 0) {
        const { curv, fx, fz } = field.path.poseAt(pt.d0 + j * R.rowStep, pose)
        if (Math.abs(curv) < F.postCurve) continue
        const yaw = Math.atan2(fx, fz)
        addBox(
          solid,
          a3[0],
          a3[1] + F.postH / 2,
          a3[2],
          0.05,
          F.postH / 2,
          0.035,
          yaw,
          col.set(F.edgePost),
        )
        col.set(pt.side < 0 ? F.reflectLeft : F.reflectRight)
        addBox(solid, a3[0], a3[1] + F.postH - 0.2, a3[2], 0.056, 0.08, 0.04, yaw, col)
      }
    }
  }
}
