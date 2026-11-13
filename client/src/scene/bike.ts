import * as THREE from 'three'
import { VIS } from './params'
import { Mesher, VC, box, cyl, span } from './util'

/** The trainer body's material, shared so the debug panel can recolour every trainer at once. */
export const TRAINER_MAT = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  color: VIS.trainerColour,
})

export const BB = { f: -0.13, y: 0.31 }
export const CRANK = 0.17
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const tube = (m: Mesher, a: THREE.Vector3, b: THREE.Vector3, col: string, t = 0.05) => {
  const o = new THREE.Object3D()
  span(o, a, b)
  m.add(
    box(t, t, 1),
    col,
    o.position.toArray(),
    new THREE.Euler().setFromQuaternion(o.quaternion).toArray().slice(0, 3) as [
      number,
      number,
      number,
    ],
    [1, 1, o.scale.z],
  )
}

const wheelGeo = () => {
  const m = new Mesher(0.05)
  m.add(new THREE.TorusGeometry(0.33, 0.03, 4, 14).rotateY(Math.PI / 2), '#202024')
  m.add(cyl(0.05, 0.05, 0.08, 6), '#aaa', [0, 0, 0], [0, 0, Math.PI / 2])
  for (let i = 0; i < 3; i++)
    m.add(box(0.015, 0.64, 0.02), '#9a9aa2', [0, 0, 0], [(i * Math.PI) / 3, 0, 0])
  return m.build()
}
const crankGeo = () => {
  const m = new Mesher(0.05)
  for (const s of [-1, 1]) {
    m.add(box(0.03, 0.03, CRANK), '#bbb', [s * 0.1, 0, (-CRANK / 2) * s], [0, 0, 0], 1)
    m.add(box(0.09, 0.03, 0.06), '#222', [s * 0.12, 0, -CRANK * s])
  }
  return m.build()
}

let shared: {
  wheel: THREE.BufferGeometry
  crank: THREE.BufferGeometry
  parts: THREE.BufferGeometry
  trainer: THREE.BufferGeometry
  trainerBody: THREE.BufferGeometry
  frame: THREE.BufferGeometry
} | null = null
function geos() {
  if (shared) return shared
  const rear = V(0, 0.34, 0.55)
  const front = V(0, 0.34, -0.55)
  const bb = V(0, BB.y, -BB.f)
  const seat = V(0, 0.92, 0.3)
  const head = V(0, 0.84, -0.4)
  const f = new Mesher(0.04)
  tube(f, bb, seat, '#fff', 0.06)
  tube(f, bb, head, '#fff', 0.07)
  tube(f, seat, head, '#fff', 0.05)
  tube(f, seat, rear, '#fff', 0.04)
  tube(f, bb, rear, '#fff', 0.04)
  tube(f, head, front, '#fff', 0.04)
  const p = new Mesher(0.06)
  p.add(box(0.12, 0.05, 0.3), '#1b1b1f', [0, 0.99, 0.34])
  tube(p, seat, V(0, 0.97, 0.32), '#666', 0.03)
  tube(p, head, V(0, 0.96, -0.42), '#666', 0.04)
  p.add(box(0.46, 0.035, 0.035), '#111', [0, 0.97, -0.44])
  for (const s of [-1, 1]) p.add(box(0.035, 0.035, 0.18), '#111', [s * 0.2, 0.93, -0.5])
  p.add(cyl(0.07, 0.07, 0.05, 8), '#d0d0d8', [0, BB.y, 0.13], [0, 0, Math.PI / 2])
  // trainer: a direct-drive unit (dark frame and feet, a body and flywheel tinted by TRAINER_MAT) and a front riser
  const tr = new Mesher(0.06)
  tr.add(box(0.07, 0.07, 1.25), '#26282e', [0, 0.04, 0.2])
  tr.add(box(1.0, 0.06, 0.08), '#26282e', [0, 0.03, 0.85])
  tr.add(box(0.9, 0.06, 0.08), '#26282e', [0, 0.03, 0.3])
  tr.add(cyl(0.05, 0.05, 0.3, 6), '#9a9aa2', [0, 0.34, 0.55], [0, 0, Math.PI / 2])
  tr.add(box(0.2, 0.08, 0.32), '#26282e', [0, 0.06, -0.55])
  const body = new Mesher(0.06)
  body.add(box(0.14, 0.34, 0.42), '#fff', [0.15, 0.2, 0.6])
  body.add(cyl(0.21, 0.21, 0.08, 14), '#fff', [0.25, 0.34, 0.55], [0, 0, Math.PI / 2])
  body.add(box(0.12, 0.3, 0.1), '#fff', [-0.12, 0.19, 0.55], [0.25, 0, 0])
  shared = {
    wheel: wheelGeo(),
    crank: crankGeo(),
    parts: p.build(),
    trainer: tr.build(),
    trainerBody: body.build(),
    frame: f.build(),
  }
  return shared
}

/**
 * Bike, on a trainer unless `road` (and `VIS.trainerOnRoad` is off). Local origin is the surface under it; faces -z. Frame is tinted by the
 * material colour.
 */
export function makeBike(colour: string, road = false) {
  const s = geos()
  const g = new THREE.Group()
  const frameMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    color: colour,
  })
  const frame = new THREE.Mesh(s.frame, frameMat)
  const parts = new THREE.Mesh(s.parts, VC)
  const crank = new THREE.Mesh(s.crank, VC)
  crank.position.set(0, BB.y, -BB.f)
  const rear = new THREE.Mesh(s.wheel, VC)
  rear.position.set(0, 0.34, 0.55)
  const front = new THREE.Mesh(s.wheel, VC)
  front.position.set(0, 0.34, -0.55)
  frame.castShadow = parts.castShadow = true
  g.add(frame, parts, crank, rear, front)
  if (!road || VIS.trainerOnRoad) {
    const trainer = new THREE.Group()
    trainer.add(new THREE.Mesh(s.trainer, VC), new THREE.Mesh(s.trainerBody, TRAINER_MAT))
    for (const m of trainer.children) m.castShadow = true
    trainer.scale.setScalar(VIS.trainerSize)
    trainer.position.set(0, 0, 0.55 * (1 - VIS.trainerSize))
    g.add(trainer)
  }
  return {
    group: g,
    frameMat,
    spin(phase: number) {
      crank.rotation.x = phase
      rear.rotation.x = phase * 2.6
    },
    /** Road bikes: turns both wheels to match `dist` metres travelled. */
    roll(dist: number) {
      rear.rotation.x = front.rotation.x = -dist / 0.36
    },
  }
}
