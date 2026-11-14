import * as THREE from 'three'
import type { Env } from './moods'
import { canvasTex, noise2, smooth, rand } from './util'

export const ROAD_HALF = 8
const CELL = 6
const ROWS = 125
const Z0 = 252 // far enough behind the bus for the High and Rear camera views
const XS = [
  -260, -190, -140, -100, -72, -52, -38, -29, -22, -17, -13.5, -11, -9, -8, 0, 8, 9, 11, 13.5, 17,
  22, 29, 38, 52, 72, 100, 140, 190, 260,
]
const TILE = 72
const PX = 16

/** Rolling ground height at x and world-z (the world is static, the bus drives through it). */
export function groundH(x: number, wz: number) {
  const d = Math.abs(x)
  const w = smooth(12, 30, d) * (1 + Math.max(0, d - 40) * 0.03)
  return w * (noise2(x * 0.018 + 5, wz * 0.018) * 13 + noise2(x * 0.07, wz * 0.07) * 3 - 6)
}

function roadTexture() {
  const W = ROAD_HALF * 2 * PX
  const H = TILE * PX
  const tex = canvasTex(W, H, (c) => {
    c.fillStyle = '#3a3a41'
    c.fillRect(0, 0, W, H)
    for (let i = 0; i < 9000; i++) {
      const v = Math.floor(rand(40, 90))
      c.fillStyle = `rgba(${v},${v},${v + 6},${rand(0.12, 0.3)})`
      c.fillRect(rand(0, W), rand(0, H), rand(1, 3), rand(1, 3))
    }
    // worn wheel paths and repair patches
    for (const x of [-4.2, -1.8, 1.8, 4.2]) {
      c.fillStyle = 'rgba(0,0,0,0.12)'
      c.fillRect((x + ROAD_HALF - 0.45) * PX, 0, 0.9 * PX, H)
    }
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(${rand(20, 70)},${rand(20, 70)},${rand(24, 74)},0.55)`
      c.fillRect(rand(40, W - 100), rand(0, H), rand(30, 90), rand(40, 160))
    }
    c.strokeStyle = 'rgba(10,10,12,0.7)'
    c.lineWidth = 1.5
    for (let i = 0; i < 26; i++) {
      let x = rand(36, W - 36)
      let y = rand(0, H)
      c.beginPath()
      c.moveTo(x, y)
      for (let k = 0; k < 7; k++) c.lineTo((x += rand(-14, 14)), (y += rand(4, 22)))
      c.stroke()
    }
    // shoulders
    for (const x0 of [0, W - 2 * PX]) {
      c.fillStyle = '#6d6252'
      c.fillRect(x0, 0, 2 * PX, H)
      for (let i = 0; i < 1200; i++) {
        c.fillStyle = `rgba(${rand(80, 160)},${rand(70, 140)},${rand(55, 110)},0.5)`
        c.fillRect(x0 + rand(0, 2 * PX), rand(0, H), rand(1, 3), rand(1, 3))
      }
    }
    // edge lines (worn) and centre dashes
    c.fillStyle = '#dcdcd0'
    for (const x of [2.35, W / PX - 2.5]) {
      for (let y = 0; y < H; y += 24) if (Math.random() > 0.12) c.fillRect(x * PX, y, 6, 24)
    }
    c.fillStyle = '#e6c84a'
    for (let y = 0; y < H; y += (TILE / 8) * PX) c.fillRect(W / 2 - 3, y, 6, 3 * PX)
  })
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 640 / TILE)
  return tex
}

/** Road, shoulders and rolling roadside terrain, scrolled by driven distance. */
export class Ground {
  group = new THREE.Group()
  private tex = roadTexture()
  private terrain: THREE.Mesh
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  private cell = Infinity
  private cols = XS.length

  constructor() {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, 640).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({
        map: this.tex,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    )
    road.position.set(0, 0.03, -280)
    road.receiveShadow = true
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.cols * (ROWS + 1) * 3), 3),
    )
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(this.cols * (ROWS + 1) * 3), 3),
    )
    const idx: number[] = []
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < this.cols - 1; c++) {
        const a = r * this.cols + c
        const b = a + this.cols
        idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
    g.setIndex(idx)
    this.terrain = new THREE.Mesh(g, this.mat)
    this.terrain.receiveShadow = true
    this.terrain.frustumCulled = false
    this.group.add(this.terrain, road)
  }

  update(dist: number, env: Env) {
    this.tex.offset.y = (dist / TILE) % 1
    this.mat.color.copy(env.ground)
    const cell = Math.floor(dist / CELL)
    this.terrain.position.z = dist - cell * CELL
    if (cell === this.cell) return
    this.cell = cell
    const p = this.terrain.geometry.attributes.position as THREE.BufferAttribute
    const col = this.terrain.geometry.attributes.color as THREE.BufferAttribute
    for (let r = 0; r <= ROWS; r++) {
      const z = Z0 - r * CELL
      const wz = z - cell * CELL
      for (let c = 0; c < this.cols; c++) {
        const x = XS[c]
        const i = r * this.cols + c
        const d = Math.abs(x)
        const h = d < ROAD_HALF + 0.5 ? -0.05 : groundH(x, wz)
        p.setXYZ(i, x, h, z)
        const patch = noise2(x * 0.05 + 40, wz * 0.05)
        const dry = smooth(0.45, 0.7, patch)
        const dirt = 1 - smooth(9, 12, d)
        const lum = 0.82 + noise2(x * 0.3, wz * 0.3) * 0.3 + h * 0.012
        col.setXYZ(
          i,
          lum * (1 + dry * 0.25 + dirt * 0.35),
          lum * (1 - dry * 0.05 + dirt * 0.05),
          lum * (0.9 - dry * 0.3 + dirt * 0.0),
        )
      }
    }
    p.needsUpdate = true
    col.needsUpdate = true
  }
}
