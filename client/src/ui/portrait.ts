import * as THREE from 'three'
import type { Look } from '../core/body'
import { makeRider } from '../scene/riders'

const W = 240
const H = 150
const cache = new Map<string, string>()

/** The rider in their own body, three-quarter from the front without bike or name tag, as a PNG data URL. */
function draw(id: string, look: Look) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  r.setSize(W, H, false)
  r.setPixelRatio(1)
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#fff6e0', '#3a3530', 2.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.6)
  sun.position.set(-4, 8, -6)
  scene.add(sun)
  const rider = makeRider('#3d7bd9', id)
  rider.setLook(look)
  rider.pose('ride', 0.3)
  rider.tag.visible = false
  scene.add(rider.root)
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(rider.person)
  const mid = box.getCenter(new THREE.Vector3())
  const reach = Math.max(...box.getSize(new THREE.Vector3()).toArray()) * 0.55
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 200)
  cam.position.set(mid.x + reach * 0.9, mid.y + reach * 0.35, mid.z - reach * 1.2)
  cam.lookAt(mid)
  r.render(scene, cam)
  const url = r.domElement.toDataURL('image/png')
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
  r.dispose()
  r.forceContextLoss()
  return url
}

/** Calls `done` with the rider's portrait for the Rider header: straight away when cached, else next frame. */
export function portrait(who: { id: string; look: Look }, done: (url: string) => void) {
  const key = `${who.id}|${who.look.body ?? ''}`
  const hit = cache.get(key)
  if (hit) return done(hit)
  requestAnimationFrame(() => {
    try {
      cache.set(key, draw(who.id, who.look))
      done(cache.get(key)!)
    } catch {
      // no WebGL: the initials stay
    }
  })
}
