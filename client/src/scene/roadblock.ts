import * as THREE from 'three'
import { vehicle } from './propGeo'
import { Mesher, VC, box, canvasTex, cyl, rand } from './util'

interface Piece {
  m: THREE.Mesh
  v: THREE.Vector3
  w: THREE.Vector3
  age: number
}

const barrel = (c: string) =>
  new Mesher(0.12)
    .add(cyl(0.38, 0.4, 1, 8), c, [0, 0.5, 0])
    .add(cyl(0.4, 0.4, 0.07, 8), '#202020', [0, 0.72, 0])
    .add(cyl(0.41, 0.41, 0.07, 8), '#202020', [0, 0.28, 0])
    .build()
const tyres = () => {
  const m = new Mesher(0.1)
  for (let i = 0; i < 3; i++)
    m.add(new THREE.TorusGeometry(0.4, 0.17, 5, 9).rotateX(Math.PI / 2), '#1d1d20', [
      0,
      0.17 + i * 0.34,
      0,
    ])
  return m.build()
}
const plank = () =>
  new Mesher(0.2)
    .add(box(0.2, 0.06, 2.6), '#9a7a4a')
    .add(box(0.2, 0.06, 2.6), '#8a6a3a', [0.3, 0.06, 0])
    .build()
/** A barricade of wrecks, barrels and tyres. Pieces are separate meshes so they can fly apart. */
export class Roadblock {
  group = new THREE.Group()
  private pieces: Piece[] = []
  private parts: THREE.Mesh[] = []
  private lampA = new THREE.MeshBasicMaterial({ color: '#ffa020' })
  private lampB = new THREE.MeshBasicMaterial({ color: '#ffa020' })
  private flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.1, 5),
    new THREE.MeshBasicMaterial({ color: '#ff8a20', transparent: true, opacity: 0.85 }),
  )
  private glow = new THREE.PointLight('#ff8a30', 0, 40, 1.5)
  private flash = new THREE.PointLight('#ffa020', 0, 40, 1.5)
  debris = new THREE.Group()
  smashed = false

  constructor() {
    const g = this.group
    const mk = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      ry = 0,
      rz = 0,
    ) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.set(0, ry, rz)
      m.castShadow = true
      g.add(m)
      this.parts.push(m)
      return m
    }
    const car = (kind: 'sedan' | 'ute' | 'van', c: string) =>
      [
        vehicle(kind),
        new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: c }),
      ] as const
    const [sg, sm] = car('sedan', '#8a3a2a')
    const [vg, vm] = car('van', '#d8d4c8')
    const [ug, um] = car('ute', '#3f6aa0')
    const [s2g, s2m] = car('sedan', '#c8a838')
    mk(sg, sm, -3.9, 0, 0.3, 0.7)
    mk(vg, vm, 0.6, 0, 0.6, -0.25)
    mk(ug, um, 4.3, 0, -0.2, 1.1)
    mk(s2g, s2m, -1.6, 1.15, 0.2, 0.3, 0.35)
    mk(ug, um, 2.6, 1.7, 0.4, -0.5, -0.2)
    const bg = [barrel('#c0392b'), barrel('#2f6fb0'), barrel('#d8a020')]
    for (let i = 0; i < 9; i++)
      mk(
        bg[i % 3],
        VC,
        -6 + i * 1.5 + rand(-0.3, 0.3),
        0,
        2 + rand(-0.3, 1.4),
        rand(0, 6),
        i % 4 === 0 ? 1.4 : 0,
      )
    for (const x of [-5.4, -2.3, 2.1, 5.5]) mk(tyres(), VC, x, 0, -1.6 + rand(-0.3, 0.3))
    for (let i = 0; i < 4; i++)
      mk(plank(), VC, -4.5 + i * 3, 0.9, 1.4, rand(-0.4, 0.4), 0.9 * (i % 2 ? 1 : -1))
    const sign = new THREE.MeshBasicMaterial({
      map: canvasTex(256, 128, (c) => {
        c.fillStyle = '#f0c020'
        c.fillRect(0, 0, 256, 128)
        c.fillStyle = '#181818'
        for (let i = -2; i < 8; i++) {
          c.beginPath()
          c.moveTo(i * 40, 128)
          c.lineTo(i * 40 + 20, 128)
          c.lineTo(i * 40 + 60, 0)
          c.lineTo(i * 40 + 40, 0)
          c.fill()
        }
        c.fillStyle = '#fff'
        c.fillRect(20, 30, 216, 68)
        c.fillStyle = '#b01818'
        c.font = '900 44px system-ui, sans-serif'
        c.textAlign = 'center'
        c.fillText('ROAD CLOSED', 128, 78)
      }),
    })
    mk(new THREE.BoxGeometry(2.4, 1.2, 0.1), sign, 0.4, 3.1, 2.2).rotation.set(0.15, 0, 0)
    mk(cyl(0.05, 0.05, 2.2, 5), VC, -0.6, 2, 2.1)
    // flashing lamps
    for (const [x, m] of [
      [-5.5, this.lampA],
      [5.5, this.lampB],
    ] as const) {
      mk(cyl(0.05, 0.05, 2.4, 5), VC, x, 1.2, 2.4)
      mk(new THREE.SphereGeometry(0.28, 8, 6), m, x, 2.5, 2.4)
    }
    this.flame.position.set(-1.1, 1.3, 2.3)
    g.add(this.flame, this.glow, this.flash)
    this.glow.position.set(-1.1, 1.8, 3)
    this.flash.position.set(0, 3, 4)
    g.visible = false
  }

  update(t: number, dt: number, night: number, p: number | null) {
    const on = p !== null && !this.smashed
    this.group.visible = on
    if (p === null || p < 0.15) this.smashed = false
    this.group.position.z = -9 - 95 * (1 - (p ?? 0))
    const ph = t % 0.8 < 0.4
    this.lampA.color.set(ph ? '#ffc040' : '#402808')
    this.lampB.color.set(ph ? '#402808' : '#ffc040')
    this.flash.intensity = on ? (ph ? 120 : 20) * (0.4 + night) : 0
    this.glow.intensity = on ? (60 + Math.sin(t * 17) * 20) * (0.5 + night) : 0
    this.flame.scale.set(1 + Math.sin(t * 13) * 0.15, 1 + Math.sin(t * 19) * 0.25, 1)
    for (const d of this.pieces) {
      d.age += dt
      d.v.y -= 22 * dt
      d.m.position.addScaledVector(d.v, dt)
      d.m.rotation.x += d.w.x * dt
      d.m.rotation.y += d.w.y * dt
      d.m.rotation.z += d.w.z * dt
      if (d.m.position.y < 0 && d.v.y < 0) {
        d.m.position.y = 0
        d.v.y *= -0.35
        d.v.x *= 0.7
        d.v.z *= 0.7
        d.w.multiplyScalar(0.6)
      }
      d.m.scale.setScalar(Math.max(0.001, Math.min(1, (2.6 - d.age) * 2)))
    }
    this.pieces = this.pieces.filter((d) => {
      if (d.age < 2.6) return true
      this.debris.remove(d.m)
      return false
    })
  }

  /** Blows every piece apart; returns world positions for sparks. */
  smash() {
    if (!this.group.visible) return []
    this.smashed = true
    this.group.visible = false
    const at: THREE.Vector3[] = []
    for (const part of this.parts) {
      if (!part.visible) continue
      const m = part.clone()
      m.material = part.material
      part.getWorldPosition(m.position)
      m.rotation.copy(part.rotation)
      this.debris.add(m)
      at.push(m.position.clone())
      this.pieces.push({
        m,
        age: 0,
        v: new THREE.Vector3(m.position.x * 1.6 + rand(-3, 3), rand(7, 17), rand(4, 24)),
        w: new THREE.Vector3(rand(-7, 7), rand(-4, 4), rand(-7, 7)),
      })
    }
    return at
  }
}
