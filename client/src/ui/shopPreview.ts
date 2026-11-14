import * as THREE from 'three'
import type { Cosmetic, Look } from '../core/cosmetics'
import { makeBus } from '../scene/bus'
import { makeRider } from '../scene/riders'

const W = 240
const H = 150
const cache = new Map<string, string>()
/** Whose body wears the item: the rider's id and their saved body, if they have made one. */
export interface Wearer {
  id: string
  body?: string
}
const queue: [Cosmetic, Wearer, (url: string) => void][] = []
let busy = false
const key = (c: Cosmetic, who: Wearer) => `${c.id}|${who.id}|${who.body ?? ''}`

/** The bus or the rider (their own body) wearing just this item, framed for its slot, drawn to a PNG data URL. */
function draw(r: THREE.WebGLRenderer, c: Cosmetic, who: Wearer) {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#fff6e0', '#3a3530', 2.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.6)
  sun.position.set(-4, 8, -6)
  scene.add(sun)
  const look: Look = { [c.slot]: c.id, body: who.body }
  const onBus = c.slot === 'paint' || c.slot === 'bullbar' || c.slot === 'spikes'
  let obj: THREE.Object3D
  let frame: THREE.Object3D // what the camera frames: the shell, or the rider without bike and name tag
  if (onBus) {
    const bus = makeBus()
    bus.setLook(look)
    bus.update({ t: 0, speed: 0, armour: null, head: 0, brake: 0, hit: 0, pitch: 0, dz: 0 })
    obj = bus.group
    frame = bus.shell
  } else {
    const rider = makeRider('#3d7bd9', who.id, c.slot === 'bike') // a road bike, so only the trainer skin shows one
    rider.setLook(look)
    rider.pose('ride', 0.3)
    obj = rider.root
    rider.tag.visible = false
    frame = c.slot === 'hat' ? rider.head : rider.person
  }
  scene.add(obj)
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(frame)
  const size = box.getSize(new THREE.Vector3())
  const mid = box.getCenter(new THREE.Vector3())
  // Hats get a close-up of the head; everything else a three-quarter view from the front.
  const reach = Math.max(size.x, size.y, size.z) * (c.slot === 'hat' ? 1.6 : onBus ? 0.8 : 0.55)
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 200)
  cam.position.set(
    mid.x + reach * 0.9,
    mid.y + reach * (c.slot === 'spikes' ? 0.75 : 0.35),
    mid.z - reach * 1.2,
  )
  cam.lookAt(mid)
  r.render(scene, cam)
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
  return r.domElement.toDataURL('image/png')
}

/** Draws queued previews one per frame with one shared renderer, then lets the GL context go. */
function pump() {
  if (busy) return
  busy = true
  let r: THREE.WebGLRenderer
  try {
    r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  } catch {
    queue.length = 0 // no WebGL: the flat swatches stay
    busy = false
    return
  }
  r.setSize(W, H, false)
  r.setPixelRatio(1)
  const step = () => {
    const next = queue.shift()
    if (!next) {
      r.dispose()
      r.forceContextLoss()
      busy = false
      return
    }
    const [c, who, done] = next
    const url = cache.get(key(c, who)) ?? draw(r, c, who)
    cache.set(key(c, who), url)
    done(url)
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** Calls `done` with a 3D preview of the item once it is drawn (straight away when cached). */
export function shopPreview(c: Cosmetic, who: Wearer, done: (url: string) => void) {
  const hit = cache.get(key(c, who))
  if (hit) return done(hit)
  queue.push([c, who, done])
  pump()
}
