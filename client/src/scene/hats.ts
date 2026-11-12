import * as THREE from 'three'
import { cosmetic } from '../core/cosmetics'
import { Mesher, box, cone, cyl } from './util'

const cache = new Map<string, THREE.BufferGeometry>()

/** Cosmetic hats, centred on the head. Colours are baked in from the catalogue. */
export function makeHat(id: string | undefined): THREE.Object3D | null {
  const c = cosmetic(id)
  if (!id || !c) return null
  let geo = cache.get(id + c.colour)
  if (!geo) {
    const m = new Mesher(0.08)
    const col = c.colour ?? '#cc3333'
    const dome = new THREE.SphereGeometry(0.27, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    if (id === 'hat-cap') {
      m.add(dome, col, [0, 0.03, 0])
      m.add(box(0.34, 0.03, 0.3), col, [0, 0.04, -0.3])
    } else if (id === 'hat-cone') {
      m.add(cone(0.2, 0.55, 7), col, [0, 0.43, 0], [0.1, 0, 0])
      m.add(new THREE.IcosahedronGeometry(0.06, 0), '#ffffff', [0, 0.72, 0.03])
      m.add(cyl(0.21, 0.21, 0.04, 7), '#ff5aa0', [0, 0.17, 0])
    } else if (id === 'hat-viking') {
      m.add(dome, col, [0, 0.0, 0], [0, 0, 0], [1, 1.1, 1])
      m.add(box(0.06, 0.2, 0.04), '#777', [0, 0.0, -0.27])
      for (const s of [-1, 1]) {
        m.add(cone(0.065, 0.4, 5), '#f5ecd0', [s * 0.33, 0.17, 0], [0, 0, -s * 0.7])
        m.add(cone(0.06, 0.2, 5), '#f5ecd0', [s * 0.52, 0.36, 0], [0, 0, -s * 0.2])
      }
    } else {
      m.add(cyl(0.25, 0.23, 0.2, 8), col, [0, 0.2, 0])
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        m.add(cone(0.06, 0.2, 4), col, [Math.sin(a) * 0.23, 0.38, Math.cos(a) * 0.23])
        m.add(new THREE.IcosahedronGeometry(0.035, 0), i % 2 ? '#e03050' : '#30b0e0', [
          Math.sin(a) * 0.25,
          0.22,
          Math.cos(a) * 0.25,
        ])
      }
    }
    geo = m.build()
    cache.set(id + c.colour, geo)
  }
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  )
  mesh.castShadow = true
  return mesh
}
