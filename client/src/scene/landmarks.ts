import * as THREE from 'three'
import { groundH } from './ground'
import { LOOP } from './props'
import { Mesher, VC, box, canvasTex, cyl, pick, rand } from './util'

const SLOGANS: [string, string, string, string][] = [
  ['SERVO', '5 km', '#d8302a', '#fff'],
  ['LAST PIE', 'FOR 300 km', '#f0c020', '#2a1a10'],
  ["BIG BOB'S", 'MEAT PIES', '#2f6fb0', '#fff'],
  ['NEXT TOILET', 'LOL NO', '#3a8a5a', '#fff'],
  ['GIANT BANANA', '40 km ->', '#f0d020', '#4a3010'],
  ['ZOMBIES?', 'NOT ON MY SHIFT', '#6a3a8a', '#ffe'],
  ['FRESH BRAINS', '2 FOR 1', '#a02a4a', '#fff'],
  ['YOU ARE NOT LOST', '(YOU ARE DOOMED)', '#222', '#9f9'],
]

function boardTexture(slot: [string, string, string, string]) {
  return canvasTex(512, 256, (c) => {
    c.fillStyle = slot[2]
    c.fillRect(0, 0, 512, 256)
    c.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 8; i++) c.fillRect(i * 70 - 30, 0, 30, 256)
    c.fillStyle = slot[3]
    c.textAlign = 'center'
    c.font = '900 76px system-ui, sans-serif'
    c.fillText(slot[0], 256, 112, 480)
    c.font = '900 60px system-ui, sans-serif'
    c.fillText(slot[1], 256, 196, 480)
    c.strokeStyle = slot[3]
    c.lineWidth = 8
    c.strokeRect(12, 12, 488, 232)
  })
}

/** A few big roadside billboards with silly slogans, recycled as they pass. */
export class Billboards {
  group = new THREE.Group()
  private items: { g: THREE.Group; z: number; face: THREE.Mesh; wz: number }[] = []

  constructor(dist: number) {
    const frame = new Mesher(0.08)
    frame.add(box(8.4, 4.4, 0.4), '#3a3a40', [0, 8.5, -0.2])
    for (const x of [-3, 3]) frame.add(box(0.4, 7, 0.4), '#55555c', [x, 3.5, -0.6])
    frame.add(box(8, 0.3, 0.6), '#222', [0, 11, 0.1])
    for (const x of [-3, 0, 3]) frame.add(cyl(0.2, 0.2, 0.3, 6), '#fff6c0', [x, 11.3, 0.4])
    const geo = frame.build()
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(geo, VC))
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 4),
        new THREE.MeshBasicMaterial({ map: boardTexture(SLOGANS[i]) }),
      )
      face.position.set(0, 8.5, 0.02)
      g.add(face)
      g.userData.i = i
      this.group.add(g)
      this.items.push({ g, z: 30 - i * 150 - rand(0, 40), face, wz: 0 })
      this.place(this.items[i], dist, i % 2 ? -1 : 1)
    }
  }

  private place(it: (typeof this.items)[number], dist: number, side: number) {
    const x = side * rand(15, 24)
    it.g.position.set(x, groundH(x, it.z - dist) - 0.5, it.z)
    it.g.rotation.y = -side * 0.35 + rand(-0.1, 0.1)
    it.g.scale.set(1, 1, 1)
  }

  update(dz: number, dist: number) {
    for (const it of this.items) {
      it.z += dz
      if (it.z > 45) {
        it.z -= LOOP * 0.85
        const mat = it.face.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.map = boardTexture(pick(SLOGANS))
        this.place(it, dist, Math.random() < 0.5 ? -1 : 1)
      }
      it.g.position.z = it.z
    }
  }
}

/** The servo (petrol station): building, pump canopy and a glowing price sign. */
export class Servo {
  group = new THREE.Group()
  private z = -400

  constructor() {
    const m = new Mesher(0.08)
    m.add(box(12, 4.2, 7), '#e8e4d6', [-6, 2.1, 0])
    m.add(box(13, 0.4, 8), '#c8302a', [-6, 4.4, 0])
    m.add(box(6, 0.12, 0.3), '#2f8a7a', [-6, 3.5, 3.6])
    m.add(box(8, 0.3, 7), '#2f8a7a', [-9, 4.8, 8.5])
    m.add(box(8.5, 0.35, 7.5), '#f0f0e8', [-9, 5.1, 8.5])
    for (const [x, z] of [
      [-12.4, 5.4],
      [-12.4, 11.6],
      [-5.6, 5.4],
      [-5.6, 11.6],
    ])
      m.add(box(0.4, 4.8, 0.4), '#d8d8d0', [x, 2.4, z])
    for (const z of [6.8, 10.2]) {
      m.add(box(0.7, 1.5, 0.5), '#c8302a', [-9, 0.75, z])
      m.add(box(0.6, 0.4, 0.1), '#222', [-9, 1.25, z + 0.28])
    }
    m.add(box(3.6, 0.2, 5), '#555', [-9, 0.1, 8.5])
    m.add(cyl(0.25, 0.25, 12, 6), '#777', [-4, 6, 12])
    for (const z of [-1.5, 1.5]) m.add(box(2.2, 2.4, 0.1), '#2a3a48', [-6 + z * 2.2, 2, 3.52])
    m.add(box(1.4, 2.3, 0.1), '#2a3a48', [-6, 1.2, 3.52])
    this.group.add(new THREE.Mesh(m.build(), VC))
    const sign = new THREE.MeshBasicMaterial({
      map: canvasTex(256, 256, (c) => {
        c.fillStyle = '#d8302a'
        c.fillRect(0, 0, 256, 256)
        c.fillStyle = '#fff'
        c.fillRect(14, 14, 228, 228)
        c.fillStyle = '#d8302a'
        c.font = '900 72px system-ui, sans-serif'
        c.textAlign = 'center'
        c.fillText('SERVO', 128, 100)
        c.fillStyle = '#222'
        c.font = '800 36px system-ui, sans-serif'
        c.fillText('PIES · FUEL', 128, 150)
        c.fillText('BAIT · ICE', 128, 196)
      }),
    })
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), sign)
    face.position.set(-4, 11.2, 12.15)
    this.group.add(face)
    this.group.visible = false
  }

  /** Approaches while the servo mood is active and stops beside the bus. */
  update(dz: number, servo: boolean) {
    if (servo && this.z < -300) this.z = -260
    if (!servo && this.z > -300) this.z += dz
    else if (servo && this.z < -12) this.z = Math.min(-12, this.z + dz)
    if (this.z > 40) this.z = -400
    this.group.visible = this.z > -300
    this.group.position.set(-12, 0, this.z)
  }
}
