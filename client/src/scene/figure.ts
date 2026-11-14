import * as THREE from 'three'

/** What a vertex is made of; a rider's palette gives each a colour. */
export const SLOT = {
  skin: 0,
  pale: 1,
  jersey: 2,
  shorts: 3,
  shoe: 4,
  hair: 5,
  white: 6,
  dark: 7,
  iris: 8,
  red: 9,
} as const
export type Slot = (typeof SLOT)[keyof typeof SLOT]
export type V3 = [number, number, number]

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const p3 = new THREE.Vector3()
const s3 = new THREE.Vector3()

/** One rigid piece of a figure: its vertices in its own space, and the object the pose moves. */
export interface Part {
  o: THREE.Object3D
  from: number
  n: number
}

/**
 * A figure as one mesh: parts are collected in their own space (each vertex tagged with a colour slot), and
 * `write()` puts every part where its object now is. `paint()` turns slots into vertex colours.
 */
export class Figure {
  parts: Record<string, Part> = {}
  geo = new THREE.BufferGeometry()
  private src: number[] = []
  private slot: number[] = []
  private pos!: Float32Array
  private local!: Float32Array
  private now = ''

  /** Starts (or carries on) the named part; `add` then goes into it. */
  part(name: string) {
    this.now = name
    this.parts[name] ??= { o: new THREE.Object3D(), from: this.src.length / 3, n: 0 }
    return this
  }

  /** Adds a primitive to the current part, placed by `pos`, `rot` and `scale`. Takes the geometry over. */
  add(
    g: THREE.BufferGeometry,
    slot: Slot,
    pos: V3 = [0, 0, 0],
    rot: V3 = [0, 0, 0],
    scale: V3 | number = 1,
  ) {
    const sc = typeof scale === 'number' ? ([scale, scale, scale] as V3) : scale
    m4.compose(p3.set(...pos), q.setFromEuler(e.set(...rot)), s3.set(...sc))
    const flat = g.index ? g.toNonIndexed() : g
    const a = flat.applyMatrix4(m4).attributes.position
    for (let i = 0; i < a.count; i++) {
      this.src.push(a.getX(i), a.getY(i), a.getZ(i))
      this.slot.push(slot)
    }
    this.parts[this.now].n += a.count
    g.dispose()
    flat.dispose()
    return this
  }

  /** Call once every part is in. */
  build() {
    this.local = new Float32Array(this.src)
    this.pos = new Float32Array(this.src)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.src.length), 3))
    // Parts move every frame, so the bounds are a fixed ball round a rider rather than recomputed.
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3)
    this.src = []
    return this
  }

  get triangles() {
    return this.local.length / 9
  }

  /** Moves every part's vertices to where its object is. */
  write() {
    const { local, pos } = this
    for (const k in this.parts) {
      const { o, from, n } = this.parts[k]
      o.updateMatrix()
      const t = o.matrix.elements
      for (let i = from * 3, end = (from + n) * 3; i < end; i += 3) {
        const x = local[i]
        const y = local[i + 1]
        const z = local[i + 2]
        pos[i] = t[0] * x + t[4] * y + t[8] * z + t[12]
        pos[i + 1] = t[1] * x + t[5] * y + t[9] * z + t[13]
        pos[i + 2] = t[2] * x + t[6] * y + t[10] * z + t[14]
      }
    }
    this.geo.attributes.position.needsUpdate = true
  }

  /** Colours every vertex from the palette (indexed by slot). */
  paint(palette: THREE.Color[]) {
    const c = this.geo.attributes.color as THREE.BufferAttribute
    const a = c.array as Float32Array
    for (let i = 0; i < this.slot.length; i++) {
      const k = palette[this.slot[i]]
      a[i * 3] = k.r
      a[i * 3 + 1] = k.g
      a[i * 3 + 2] = k.b
    }
    c.needsUpdate = true
  }
}

/** A limb segment along z from -0.5 to 0.5 (stretched by `span`), `ra` thick at the start and `rb` at the end. */
export const limb = (ra: number, rb: number, sides = 6) =>
  new THREE.CylinderGeometry(rb, ra, 1, sides).rotateX(Math.PI / 2)
