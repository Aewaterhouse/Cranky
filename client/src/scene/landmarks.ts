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
        this.paint(it)
        this.place(it, dist, Math.random() < 0.5 ? -1 : 1)
      }
      it.g.position.z = it.z
    }
  }

  private paint(it: (typeof this.items)[number]) {
    const mat = it.face.material as THREE.MeshBasicMaterial
    mat.map?.dispose()
    mat.map = boardTexture(pick(SLOGANS))
  }
}
