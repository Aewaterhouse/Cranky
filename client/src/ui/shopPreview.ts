import * as THREE from 'three'
import type { Cosmetic, Look } from '../core/cosmetics'
import { makeBus } from '../scene/bus'
import { makeRider } from '../scene/riders'

const W = 240
const H = 150
const cache = new Map<string, string>()
const queue: [Cosmetic, (url: string) => void][] = []
let busy = false

/** The bus or the rider wearing just this item, framed for its slot, drawn to a PNG data URL. */
function draw(r: THREE.WebGLRenderer, c: Cosmetic) {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#fff6e0', '#3a3530', 2.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.6)
  sun.position.set(-4, 8, -6)
  scene.add(sun)
  const look: Look = { [c.slot]: c.id }
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
    const rider = makeRider('#3d7bd9', 1)
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
  const reach = Math.max(size.x, size.y, size.z) * (c.slot === 'hat' ? 1.6 : onBus ? 0.8 : 1.1)
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
    const [c, done] = next
    const url = cache.get(c.id) ?? draw(r, c)
    cache.set(c.id, url)
    done(url)
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** Calls `done` with a 3D preview of the item once it is drawn (straight away when cached). */
export function shopPreview(c: Cosmetic, done: (url: string) => void) {
  const hit = cache.get(c.id)
  if (hit) return done(hit)
  queue.push([c, done])
  pump()
}
