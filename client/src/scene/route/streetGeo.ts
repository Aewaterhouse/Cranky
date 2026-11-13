import * as THREE from 'three'
import { hash } from '../math'
import { VIS } from '../params'
import { STREET_STRIDE, type ChunkFeatures } from './features'
import type { HeightField } from './heightField'
import { drawnHeight, type Patch } from './patch'
import { addBox, type Tris } from './roadGeo'
import type { Signs } from './signs'

const R = VIS.route
const S = R.signs
const col = new THREE.Color()
const quad = new Float64Array(12)

/**
 * Side streets as pale strips lying on the drawn ground, into `strips`, and a name sign at each junction with
 * the route: the post goes into `solid`, the plate is returned to be added to the chunk.
 */
export function buildStreets(
  cf: ChunkFeatures,
  field: HeightField,
  patches: Patch[],
  strips: Tris,
  solid: Tris,
  signs: Signs,
): THREE.Object3D[] {
  const s = cf.streets
  for (let i = 0; i < s.length; i += STREET_STRIDE) {
    const main = s[i + 8]
    for (let k = 0; k < 4; k++) {
      const [x, z] = [s[i + k * 2], s[i + k * 2 + 1]]
      quad[k * 3] = x
      quad[k * 3 + 1] = drawnHeight(field, patches, x, z) + R.streetLift * (main ? 1.5 : 1)
      quad[k * 3 + 2] = z
    }
    col.set(main ? R.mainStreet : R.street).multiplyScalar(0.95 + hash(s[i] + s[i + 1] * 3.3) * 0.1)
    // Corners are left a, right a, left b, right b.
    strips.add(quad, 0, 3, 6, col)
    strips.add(quad, 3, 9, 6, col)
  }
  return cf.signs.map((j) => {
    const y = drawnHeight(field, patches, j.x, j.z)
    addBox(solid, j.x, y + S.streetH / 2, j.z, 0.07, S.streetH / 2, 0.07, 0, col.set(S.post))
    const m = signs.plate(j.name, S.streetW, S.streetW / 5, S.streetBg, S.streetFg)
    m.position.set(j.x - solid.ax, y + S.streetH - solid.ay, j.z - solid.az)
    m.rotation.y = Math.atan2(-j.dz, j.dx)
    return m
  })
}
