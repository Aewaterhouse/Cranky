import * as THREE from 'three'
import { ROOF_Y } from './busParts'
import { VIS } from './params'

/**
 * A power cable from a rider's trainer into the bus roof, as if the crew were driving it. It glows with the
 * rider's effort and pulses with each pedal stroke.
 */
export function makeCable(x: number, z: number) {
  const side = Math.sign(x) || 1
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x + 0.25 * side, ROOF_Y + 0.34, z + 0.55),
    new THREE.Vector3(x + 0.42 * side, ROOF_Y + 0.12, z + 0.85),
    new THREE.Vector3(x * 0.4, ROOF_Y + 0.04, z + 1.1),
    new THREE.Vector3(0.12 * side, ROOF_Y + 0.02, z + 1.25),
  ])
  const mat = new THREE.MeshLambertMaterial({ color: VIS.cableColour, emissive: VIS.cableGlow })
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.035, 5), mat)
  const socket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), mat)
  socket.position.set(0.12 * side, ROOF_Y + 0.04, z + 1.25)
  const group = new THREE.Group()
  group.add(cable, socket)
  return {
    group,
    /** `effort` is power over target (0 when off the bike); `phase` the crank angle. */
    update(effort: number, phase: number) {
      mat.color.set(VIS.cableColour)
      mat.emissive.set(VIS.cableGlow)
      mat.emissiveIntensity =
        Math.min(1.5, effort) * VIS.cableGlowMax * (0.65 + 0.35 * Math.sin(phase * 2))
    },
    dispose() {
      cable.geometry.dispose()
      socket.geometry.dispose()
      mat.dispose()
    },
  }
}
