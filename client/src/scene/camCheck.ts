import * as THREE from 'three'
import { CAM, CAM_VIEWS, type CamView } from './camVis'
import type { PlayerCam } from './playerCam'
import type { Sky } from './sky'

export interface CamCheck {
  name: string
  view: CamView
  yaw: number
  pitch: number
  zoom: number
}

/** Every view at its own distance, zoomed right out, and zoomed out turned to each extreme. */
export const CAM_CHECKS: CamCheck[] = CAM_VIEWS.flatMap((view) => {
  const z = CAM.zoomMax
  const at = (name: string, yaw: number, pitch: number, zoom: number) => ({
    name: `${view} ${name}`,
    view,
    yaw,
    pitch,
    zoom,
  })
  return [
    at('default', 0, 0, 1),
    at('zoomed out', 0, 0, z),
    at('left', 90, 0, z),
    at('right', -90, 0, z),
    at('behind', 180, 0, z),
    at('up', 0, 90, z),
    at('down', 0, -90, z),
  ]
})

/** Holds the camera on check `c`: the view snapped in, the orbit set and kept there (no auto-return). */
export function poseCam(pc: PlayerCam, c: CamCheck, seats: typeof CAM.bus) {
  pc.views.view = c.view
  pc.views.step(60, seats)
  pc.orbit.snap()
  pc.orbit.free = true
  pc.orbit.yaw = c.yaw
  pc.orbit.pitch = c.pitch
  pc.orbit.zoom = c.zoom
  pc.orbit.idle = 0
}

const ray = new THREE.Vector3()
const fwd = new THREE.Vector3()

/**
 * The share of the picture below the horizon that shows a hole in the world: renders once with the sky dome hidden
 * over a magenta clear, then counts magenta pixels whose ray would meet the ground while the fog is still under
 * 90%. Holes further out are invisible: the dome below the horizon is the fog colour, the same as fogged ground.
 */
export function voidShare(
  w: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; sky: Sky },
  step = 4,
) {
  const { renderer: r, scene, camera } = w
  const old = r.getClearColor(new THREE.Color())
  const alpha = r.getClearAlpha()
  const bg = scene.background
  scene.background = null
  const dome = w.sky.dome.visible
  w.sky.dome.visible = false
  r.setClearColor('#ff00ff', 1)
  r.render(scene, camera)
  const gl = r.getContext()
  const W = gl.drawingBufferWidth
  const H = gl.drawingBufferHeight
  const px = new Uint8Array(W * H * 4)
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
  w.sky.dome.visible = dome
  scene.background = bg
  r.setClearColor(old, alpha)
  const fog = scene.fog instanceof THREE.Fog ? scene.fog : null
  const seen = fog ? fog.near + 0.9 * (fog.far - fog.near) : Infinity
  camera.getWorldDirection(fwd)
  let below = 0
  let hole = 0
  for (let y = 0; y < H; y += step)
    for (let x = 0; x < W; x += step) {
      ray
        .set((x / W) * 2 - 1, (y / H) * 2 - 1, 0.5)
        .unproject(camera)
        .sub(camera.position)
      if (ray.y >= 0) continue
      below++
      const i = (y * W + x) * 4
      if (px[i] < 240 || px[i + 1] > 16 || px[i + 2] < 240) continue
      // Depth (what the fog uses) of the point where this ray meets the ground.
      if ((ray.dot(fwd) * camera.position.y) / -ray.y < seen) hole++
    }
  return below ? hole / below : 0
}

/**
 * The dev pages' `?camcheck`: poses every check in turn, measures the void and lists the results in a corner
 * (and on `window.camChecks`). `pose(i)` is also on the window for screenshots.
 */
export function runCamCheck(
  pc: PlayerCam,
  seats: typeof CAM.bus,
  world: Parameters<typeof voidShare>[0],
  settle = 1200,
) {
  const out = document.createElement('pre')
  out.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:6px 8px;background:#000c;color:#fff;font:11px monospace;max-height:90vh;overflow:auto'
  document.body.append(out)
  const results: { name: string; void: number }[] = []
  const pose = (i: number) => poseCam(pc, CAM_CHECKS[i], seats)
  // Magenta where the world runs out, to see the holes in a screenshot.
  const magenta = (on: boolean) => {
    world.sky.dome.visible = !on
    world.renderer.setClearColor(on ? '#ff00ff' : '#000000', 1)
  }
  Object.assign(window, { camChecks: results, camPose: pose, camMagenta: magenta })
  let i = 0
  const next = () => {
    if (i > 0) {
      const v = voidShare(world)
      results.push({ name: CAM_CHECKS[i - 1].name, void: v })
      out.textContent += `${v > 0.001 ? 'VOID' : 'ok  '} ${(v * 100).toFixed(1).padStart(5)}%  ${CAM_CHECKS[i - 1].name}\n`
    }
    if (i === CAM_CHECKS.length) {
      const bad = results.filter((r) => r.void > 0.001).length
      out.textContent += `${bad} of ${results.length} shots show blank background below the horizon\n`
      Object.assign(window, { camCheckDone: true })
      return
    }
    pose(i++)
    setTimeout(next, settle)
  }
  next()
}
