import * as THREE from 'three'

/** Shadow box half-size and how far off the sun sits, in metres. */
const SHADOW_HALF = 26
const SUN_DIST = 80

/** Sets the key light up to cast the rider's shadow; returns it. */
export function setUpSun(k: THREE.DirectionalLight) {
  k.castShadow = true
  k.shadow.mapSize.set(1536, 1536)
  const c = k.shadow.camera
  c.left = c.bottom = -SHADOW_HALF
  c.right = c.top = SHADOW_HALF
  c.near = 1
  c.far = SUN_DIST * 2
  k.shadow.bias = -0.0004
  k.shadow.normalBias = 0.06
  return k
}

/** Points the sun at a spot from the sky's elevation and azimuth (degrees). */
export function aimSun(
  k: THREE.DirectionalLight,
  env: { sunElev: number; sunAz: number },
  x: number,
  y: number,
  z: number,
) {
  const el = THREE.MathUtils.degToRad(env.sunElev)
  const az = THREE.MathUtils.degToRad(env.sunAz)
  k.target.position.set(x, y, z)
  k.position
    .set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
    .multiplyScalar(SUN_DIST)
    .add(k.target.position)
}
