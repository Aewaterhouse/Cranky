import type { RouteFeatures } from '../../core/route'
import { VIS } from '../params'
import type { HeightField } from './heightField'

const R = VIS.route
/** Side streets are cut into pieces no longer than this, and looked up in square cells this big. */
const PIECE_M = 8
const CELL = 50
/** Features further than this from any road of the route are dropped, by kind. */
const STREET_REACH = 450
const BUILDING_REACH = 300
const POI_REACH = 1200
/** Two signs with the same name closer than this are one junction. */
const SIGN_APART = 40

export interface Junction {
  x: number
  z: number
  /** Unit vector along the side street, pointing away from the route. */
  dx: number
  dz: number
  name: string
}
export interface Building {
  x: number
  z: number
  w: number
  d: number
  /** Radians anticlockwise from east, which is also the scene's rotation about y. */
  rot: number
  h: number
}
export interface Poi {
  x: number
  z: number
  name: string
  kind: 'peak' | 'viewpoint' | 'tower' | 'cafe'
}
/** One chunk's share: street pieces as [left a, right a, left b, right b] x/z pairs plus a main-road flag. */
export interface ChunkFeatures {
  streets: number[]
  signs: Junction[]
  buildings: Building[]
}
export const STREET_STRIDE = 9

/** The pack's map features in scene metres, shared out to the chunk whose road is nearest. */
export class Features {
  /** Points of interest within reach of the route. */
  readonly pois: Poi[] = []
  private chunks = new Map<number, ChunkFeatures>()
  /** Street pieces [ax, az, bx, bz, half width] and building indices by cell, for "is anything here". */
  private segs = new Map<number, number[]>()
  private blds = new Map<number, Building[]>()

  constructor(
    f: RouteFeatures | undefined,
    private field: HeightField,
  ) {
    for (const r of f?.roads ?? []) this.road(r.p, r.k === 'main', r.n)
    for (const [e, n, w, d, rot, h] of f?.buildings ?? []) {
      const b = { x: e, z: -n, w, d, rot: (rot * Math.PI) / 180, h }
      const near = field.fine.nearest(b.x, b.z, 40)
      // Nothing is built on the route's road or across a side street.
      if (near < R.roadHalf + R.verge + Math.min(w, d) / 2 + 1) continue
      if (this.blocked(b.x, b.z, Math.min(w, d) * 0.3)) continue
      const k = this.owner(b.x, b.z, BUILDING_REACH)
      if (k === undefined) continue
      this.chunk(k, true)!.buildings.push(b)
      push(this.blds, key(b.x, b.z), b)
    }
    for (const p of f?.pois ?? []) {
      const [x, z] = [p.at[0], -p.at[1]]
      const k = this.owner(x, z, POI_REACH)
      if (k !== undefined) this.pois.push({ x, z, name: p.n, kind: p.k })
    }
  }

  /** The features of chunk `k`, if it has any. */
  chunk(k: number, make = false) {
    let c = this.chunks.get(k)
    if (!c && make) this.chunks.set(k, (c = { streets: [], signs: [], buildings: [] }))
    return c
  }

  /** Chunk index of the stretch of route nearest to (x, z), if any is within `reach`. */
  owner(x: number, z: number, reach: number) {
    const f = this.field
    if (f.fine.nearest(x, z, 60) < Infinity) return Math.floor(f.fine.at / R.chunk)
    return f.coarse.nearest(x, z, reach) < Infinity ? Math.floor(f.coarse.at / R.chunk) : undefined
  }

  private road(pts: [number, number][], main: boolean, name: string) {
    const half = main ? R.mainHalf : R.streetHalf
    const H = R.roadHalf
    // Resample so no piece is long, then give every point a sideways unit vector shared by both its pieces.
    const x: number[] = []
    const z: number[] = []
    pts.forEach(([e, n], i) => {
      if (i) {
        const [pe, pn] = pts[i - 1]
        const parts = Math.ceil(Math.hypot(e - pe, n - pn) / PIECE_M)
        for (let k = 1; k < parts; k++) {
          x.push(pe + ((e - pe) * k) / parts)
          z.push(-(pn + ((n - pn) * k) / parts))
        }
      }
      x.push(e)
      z.push(-n)
    })
    const n = x.length
    const dist = x.map((_, i) => this.field.fine.nearest(x[i], z[i], 40))
    for (let i = 0; i < n - 1; i++) {
      let [ax, az, bx, bz] = [x[i], z[i], x[i + 1], z[i + 1]]
      const [da, db] = [dist[i], dist[i + 1]]
      if (da < H && db < H) continue
      const side = (j: number) => {
        const a = Math.max(0, j - 1)
        const b = Math.min(n - 1, j + 1)
        const len = Math.hypot(x[b] - x[a], z[b] - z[a]) || 1
        return [(-(z[b] - z[a]) / len) * half, ((x[b] - x[a]) / len) * half]
      }
      const [sax, saz] = side(i)
      const [sbx, sbz] = side(i + 1)
      // A piece that runs into the route's road stops at its edge, and that is a junction.
      if (da < H || db < H) {
        const t = (H - da) / (db - da)
        const [cx, cz] = [ax + (bx - ax) * t, az + (bz - az) * t]
        const len = (Math.hypot(bx - ax, bz - az) || 1) * (da < H ? 1 : -1)
        this.sign(cx, cz, (bx - ax) / len, (bz - az) / len, name, half)
        if (da < H) [ax, az] = [cx, cz]
        else [bx, bz] = [cx, cz]
      }
      const k = this.owner((ax + bx) / 2, (az + bz) / 2, STREET_REACH)
      if (k === undefined) continue
      this.chunk(k, true)!.streets.push(
        ...[ax - sax, az - saz, ax + sax, az + saz, bx - sbx, bz - sbz, bx + sbx, bz + sbz],
        main ? 1 : 0,
      )
      push(this.segs, key((ax + bx) / 2, (az + bz) / 2), ax, az, bx, bz, half)
    }
  }

  /** A street-name sign on the corner where a named side street leaves the route. */
  private sign(x: number, z: number, dx: number, dz: number, name: string, half: number) {
    if (!name) return
    const k = this.owner(x, z, 60)
    if (k === undefined) return
    for (const q of [k - 1, k, k + 1])
      for (const s of this.chunk(q)?.signs ?? [])
        if (s.name === name && Math.hypot(s.x - x, s.z - z) < SIGN_APART) return
    // On the corner: a little way up the street and just off its edge.
    const [px, pz] = [x + dx * 2.5 - dz * (half + 1.2), z + dz * 2.5 + dx * (half + 1.2)]
    this.chunk(k, true)!.signs.push({ x: px, z: pz, dx, dz, name })
  }

  /** True when (x, z) is within `pad` metres of a side street or a building. */
  blocked(x: number, z: number, pad: number): boolean {
    const [cx, cz] = [Math.floor(x / CELL), Math.floor(z / CELL)]
    for (let ix = cx - 1; ix <= cx + 1; ix++)
      for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const k = (ix + 32768) * 65536 + iz + 32768
        const s = this.segs.get(k)
        for (let i = 0; s && i < s.length; i += 5) {
          const [sx, sz] = [s[i + 2] - s[i], s[i + 3] - s[i + 1]]
          const l2 = sx * sx + sz * sz
          const t = l2 ? Math.min(1, Math.max(0, ((x - s[i]) * sx + (z - s[i + 1]) * sz) / l2)) : 0
          if (Math.hypot(x - s[i] - sx * t, z - s[i + 1] - sz * t) < s[i + 4] + pad) return true
        }
        for (const b of this.blds.get(k) ?? []) {
          const [c, sn] = [Math.cos(b.rot), Math.sin(b.rot)]
          const [lx, lz] = [(x - b.x) * c - (z - b.z) * sn, (x - b.x) * sn + (z - b.z) * c]
          if (Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad) return true
        }
      }
    return false
  }
}

const key = (x: number, z: number) =>
  (Math.floor(x / CELL) + 32768) * 65536 + Math.floor(z / CELL) + 32768
function push<T>(m: Map<number, T[]>, k: number, ...v: T[]) {
  const list = m.get(k)
  if (list) list.push(...v)
  else m.set(k, v)
}
