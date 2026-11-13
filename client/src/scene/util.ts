import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export * from './math'
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
export const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

/** Shared flat-shaded vertex-colour material for props. */
export const VC = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })

type Geo = THREE.BufferGeometry
type V3 = [number, number, number]
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
export const cyl = (rt: number, rb: number, h: number, seg = 8) =>
  new THREE.CylinderGeometry(rt, rb, h, seg)
export const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg)
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail)

/** Collects transformed, colour-baked low-poly parts into one flat-shaded geometry. */
export class Mesher {
  private parts: Geo[] = []
  constructor(private jitter = 0.1) {}

  add(
    geo: Geo,
    colour: string | number,
    pos: V3 = [0, 0, 0],
    rot: V3 = [0, 0, 0],
    scale: V3 | number = 1,
  ) {
    const [sx, sy, sz] = typeof scale === 'number' ? [scale, scale, scale] : scale
    let g = geo.clone()
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        new THREE.Vector3(sx, sy, sz),
      ),
    )
    if (g.index) g = g.toNonIndexed()
    g.deleteAttribute('uv')
    g.computeVertexNormals()
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    const c = new THREE.Color(colour)
    for (let i = 0; i < n; i += 3) {
      const s = 1 + (Math.random() - 0.5) * this.jitter
      for (let k = 0; k < 3; k++) col.set([c.r * s, c.g * s, c.b * s], (i + k) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.parts.push(g)
    return this
  }

  build(): Geo {
    const g = mergeGeometries(this.parts)
    this.parts.forEach((p) => p.dispose())
    return g
  }
}

export function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const Z = new THREE.Vector3(0, 0, 1)
const dir = new THREE.Vector3()
/** Positions a unit-length (z) mesh so it spans a to b. */
export function span(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  dir.subVectors(b, a)
  const len = dir.length()
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(Z, dir.divideScalar(len || 1))
  m.scale.z = len
}
