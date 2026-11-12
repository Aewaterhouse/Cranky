import * as THREE from 'three'
import { VIS } from './params'

/** Procedural low-poly bus. Front faces -z; origin at road level, centre of the bus. */
export function makeBus() {
  const g = new THREE.Group()
  const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c })
  const body = new THREE.MeshLambertMaterial({ color: VIS.busColour })
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    b.position.set(x, y, z)
    g.add(b)
    return b
  }
  box(3, 2.6, 10, body, 0, 2, 0)
  box(3.05, 0.9, 8.6, mat('#223040'), 0, 2.5, 0.4)
  box(2.6, 0.9, 0.1, mat('#223040'), 0, 2.5, -5.01)
  box(3.2, 0.4, 0.4, mat('#555'), 0, 0.9, -5.1)
  box(3.1, 0.15, 9, mat('#333'), 0, 3.4, 0)
  for (const x of [-1.2, 1.2]) box(0.3, 0.3, 0.1, mat('#fff8c0'), x, 1.3, -5.05)
  const wheels: THREE.Mesh[] = []
  const wg = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12).rotateZ(Math.PI / 2)
  for (const [x, z] of [[-1.45, -3.2], [1.45, -3.2], [-1.45, 3.2], [1.45, 3.2]]) {
    const w = new THREE.Mesh(wg, mat('#1a1a1a'))
    w.position.set(x, 0.6, z)
    g.add(w)
    wheels.push(w)
  }
  return { group: g, body, wheels }
}

/** A rider figure with a canvas name tag. */
export function makeRider(colour: string) {
  const g = new THREE.Group()
  const m = new THREE.MeshLambertMaterial({ color: colour, transparent: true })
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), m)
  torso.position.y = 0.6
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: '#f0c8a0', transparent: true }))
  head.position.y = 1.25
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const tex = new THREE.CanvasTexture(canvas)
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  tag.scale.set(2.4, 0.6, 1)
  tag.position.y = 2
  g.add(torso, head, tag)
  let last = ''
  const label = (name: string, c: number | null) => {
    const col = c == null ? '#ccc' : c > 0.85 ? '#5f5' : c > 0.6 ? '#fc4' : '#f55'
    const key = name + col
    if (key === last) return
    last = key
    const x = canvas.getContext('2d')!
    x.clearRect(0, 0, 256, 64)
    x.fillStyle = 'rgba(0,0,0,0.55)'
    x.roundRect(4, 8, 248, 48, 12)
    x.fill()
    x.fillStyle = col
    x.font = 'bold 30px system-ui'
    x.textAlign = 'center'
    x.fillText(name.slice(0, 12), 128, 43)
    tex.needsUpdate = true
  }
  const fade = (o: number) => [m, head.material as THREE.Material].forEach((x) => (x.opacity = o))
  return { group: g, torso, label, fade }
}
