import * as THREE from 'three'
import type { Body } from '../core/body'
import type { Profile } from '../core/curve'
import { makeRider } from '../scene/riders'
import { h } from './dom'

/** The preview's own numbers: framing, and how a drag turns and a pinch zooms. */
const CREATOR = {
  fov: 30,
  /** Camera distance for the whole rider and for the head, and the zoom limits as a share of it. */
  far: 6.2,
  near: 3.3,
  zoomMin: 0.45,
  zoomMax: 1.5,
  dragDeg: 0.5,
  pitchMax: 60,
  cadence: 55,
}

/** The live preview: the rider on their bike, turned by a drag and zoomed by a pinch or the wheel. */
export function bodyPreview(p: Profile, body: () => Body, bare: () => boolean) {
  const canvas = h('canvas', { class: 'bc-canvas', 'aria-label': 'Your rider. Drag to turn.' })
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#fff6e0', '#3a3530', 2.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.6)
  sun.position.set(-4, 8, -6)
  scene.add(sun)
  const rider = makeRider('#3d7bd9', p.id, true)
  rider.setLook(p.look)
  rider.tag.visible = false
  scene.add(rider.root)
  const cam = new THREE.PerspectiveCamera(CREATOR.fov, 1, 0.1, 50)
  let yaw = -0.6
  let pitch = 8
  let zoom = 1
  let head = false
  let aim = 1
  let dist = CREATOR.far
  const pts = new Map<number, { x: number; y: number }>()
  const spread = () => {
    const [a, b] = [...pts.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const zoomBy = (f: number) =>
    (zoom = Math.min(CREATOR.zoomMax, Math.max(CREATOR.zoomMin, zoom * f)))
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    const at = pts.get(e.pointerId)
    if (!at) return
    const before = pts.size === 2 ? spread() : 0
    if (pts.size === 1) {
      yaw -= (e.clientX - at.x) * CREATOR.dragDeg * (Math.PI / 180)
      pitch = Math.max(
        -10,
        Math.min(CREATOR.pitchMax, pitch + (e.clientY - at.y) * CREATOR.dragDeg),
      )
    }
    at.x = e.clientX
    at.y = e.clientY
    if (before > 0) zoomBy(before / spread())
  })
  const up = (e: PointerEvent) => pts.delete(e.pointerId)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener(
    'wheel',
    (e) => (e.preventDefault(), zoomBy(Math.exp(Math.sign(e.deltaY) * 0.1))),
    {
      passive: false,
    },
  )
  const size = () => {
    const w = canvas.clientWidth
    const hgt = canvas.clientHeight
    if (!w || !hgt) return
    renderer.setPixelRatio(Math.min(2, devicePixelRatio))
    renderer.setSize(w, hgt, false)
    cam.aspect = w / hgt
    cam.updateProjectionMatrix()
  }
  const at = new THREE.Vector3()
  let seen = false
  let last = performance.now()
  let phase = 0
  const frame = (now: number) => {
    // Gone from the page (another tab, a ride): let the GL context go.
    if (!canvas.isConnected && seen) {
      renderer.dispose()
      renderer.forceContextLoss()
      return
    }
    requestAnimationFrame(frame)
    if (!canvas.isConnected) return
    seen = true
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (canvas.width !== Math.round(canvas.clientWidth * renderer.getPixelRatio())) size()
    phase += (CREATOR.cadence / 60) * Math.PI * 2 * dt
    rider.pose('ride', phase)
    // Ease between the whole rider and a close-up of the head.
    const k = 1 - Math.exp(-dt * 6)
    rider.head.getWorldPosition(at)
    aim += ((head ? at.y : 1.05 * rider.root.scale.y) - aim) * k
    const big = rider.head.scale.x * rider.root.scale.y
    dist += ((head ? CREATOR.near * big : CREATOR.far) - dist) * k
    const el = (pitch * Math.PI) / 180
    const d = dist * zoom
    const cx = head ? at.x : 0
    const cz = head ? at.z : 0
    cam.position.set(
      cx + Math.sin(yaw) * Math.cos(el) * d,
      aim + Math.sin(el) * d,
      cz - Math.cos(yaw) * Math.cos(el) * d,
    )
    cam.lookAt(cx, aim, cz)
    renderer.render(scene, cam)
  }
  requestAnimationFrame(frame)
  return {
    canvas,
    /** Rebuilds the rider from the creator's body. */
    refresh: () => rider.setBody(body(), bare()),
    focus: (onHead: boolean) => ((head = onHead), (zoom = 1)),
  }
}
