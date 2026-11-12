import * as THREE from 'three'
import { cosmetic, type Look } from '../core/cosmetics'
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
  const part = (build: (p: THREE.Group) => void) => {
    const p = new THREE.Group()
    build(p)
    p.visible = false
    g.add(p)
    return p
  }
  const steel = mat('#8a8f98')
  const bullbar = part((p) => {
    for (const [w, h, d, x, y] of [[3.4, 0.2, 0.2, 0, 1.6], [3.4, 0.2, 0.2, 0, 0.9], [0.2, 1.2, 0.2, -1.1, 1.25], [0.2, 1.2, 0.2, 1.1, 1.25], [0.2, 1.2, 0.2, 0, 1.25]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel)
      b.position.set(x, y, -5.5)
      p.add(b)
    }
  })
  const spikes = part((p) => {
    const cone = new THREE.ConeGeometry(0.15, 0.7, 6)
    for (let z = -4.2; z <= 4.2; z += 1.4)
      for (const x of [-1.4, 1.4]) {
        const c = new THREE.Mesh(cone, steel)
        c.position.set(x, 3.75, z)
        p.add(c)
      }
  })
  const setLook = (look: Look) => {
    body.userData.colour = cosmetic(look.paint)?.colour ?? VIS.busColour
    bullbar.visible = !!look.bullbar
    spikes.visible = !!look.spikes
  }
  setLook({})
  return { group: g, body, wheels, setLook }
}

function makeHat(id: string | undefined): THREE.Object3D | null {
  const c = cosmetic(id)
  if (!c) return null
  const m = new THREE.MeshLambertMaterial({ color: c.colour })
  const g = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, y: number, mm = m) => {
    const x = new THREE.Mesh(geo, mm)
    x.position.y = y
    g.add(x)
    return x
  }
  if (id === 'hat-cap') {
    add(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0)
    add(new THREE.BoxGeometry(0.4, 0.04, 0.35), 0.02).position.z = -0.3
  } else if (id === 'hat-cone') add(new THREE.ConeGeometry(0.22, 0.6, 10), 0.3)
  else if (id === 'hat-viking') {
    add(new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0)
    const horn = new THREE.MeshLambertMaterial({ color: '#f5ecd0' })
    for (const s of [-1, 1]) {
      const h = add(new THREE.ConeGeometry(0.07, 0.4, 6), 0.2, horn)
      h.position.x = s * 0.32
      h.rotation.z = -s * 0.6
    }
  } else add(new THREE.CylinderGeometry(0.26, 0.22, 0.25, 5, 1, true), 0.12)
  g.position.y = 1.35
  return g
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
  let hat: THREE.Object3D | null = null
  let lookKey = ''
  const setLook = (look: Look = {}) => {
    const key = `${look.hat}|${look.outfit}`
    if (key === lookKey) return
    lookKey = key
    m.color.set(cosmetic(look.outfit)?.colour ?? colour)
    if (hat) g.remove(hat)
    hat = makeHat(look.hat)
    if (hat) g.add(hat)
  }
  return { group: g, torso, label, fade, setLook }
}
