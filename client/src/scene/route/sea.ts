import * as THREE from 'three'
import type { TerrainData } from '../../core/route'
import { VIS } from '../params'

const R = VIS.route
const O = R.ocean
/** Texture value = 128 + metres above the sea × this, so ±16 m fits in a byte. */
const SCALE = 8
const SIZE = 16000

/** Cells of the pack's height grid below sea level; a route with enough of them is on the coast. */
export const seaCells = (t?: TerrainData) =>
  (t?.runs ?? []).reduce(
    (n, row) =>
      n + (row ?? []).reduce((m, [, hs]) => m + hs.filter((h) => h < R.seaLevel).length, 0),
    0,
  )

/**
 * Metres above the sea per cell: real heights on land and next to it, sea cells deeper the further they are from
 * land (the grid reads most sea as 0 m), and unknown cells copying the nearest known one.
 */
function depthGrid(t: TerrainData) {
  const { cols, rows } = t
  const h = new Float32Array(cols * rows).fill(NaN)
  t.runs.forEach((row, r) => row?.forEach(([c0, hs]) => h.set(hs, r * cols + c0)))
  const steps = new Int32Array(cols * rows).fill(-1)
  let q: number[] = []
  h.forEach((v, i) => v >= R.seaLevel && ((steps[i] = 0), q.push(i)))
  const around = (i: number, f: (j: number) => void) => {
    const c = i % cols
    if (c > 0) f(i - 1)
    if (c < cols - 1) f(i + 1)
    if (i >= cols) f(i - cols)
    if (i < cols * (rows - 1)) f(i + cols)
  }
  // Steps from land across known sea, then known values spread into the unknown.
  while (q.length) {
    const next: number[] = []
    for (const i of q)
      around(i, (j) => {
        if (steps[j] >= 0 || isNaN(h[j])) return
        steps[j] = steps[i] + 1
        h[j] = Math.min(h[j], R.seaLevel - 0.5 - (steps[j] - 1) * O.depthPerCell)
        next.push(j)
      })
    q = next
  }
  q = []
  h.forEach((v, i) => !isNaN(v) && q.push(i))
  while (q.length) {
    const next: number[] = []
    for (const i of q)
      around(i, (j) => {
        if (!isNaN(h[j])) return
        h[j] = h[i]
        next.push(j)
      })
    q = next
  }
  return h
}

/** The sea: one big sheet at sea level that only shows where the height grid says sea, with foam at the shore. */
export class Sea {
  mesh?: THREE.Mesh
  private h?: Float32Array
  private u = {
    uH: { value: null as THREE.Texture | null },
    uSpan: { value: new THREE.Vector2() },
    uHalf: { value: new THREE.Vector2() },
    uAt: { value: new THREE.Vector2() },
    uT: { value: 0 },
    uFoam: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uBand: { value: 1 },
    uLap: { value: 0 },
    uSwell: { value: 0 },
  }

  constructor(private t?: TerrainData) {
    if (!t || seaCells(t) < O.coastCells) return
    const u = this.u
    const h = (this.h = depthGrid(t))
    const data = new Uint8Array(h.length)
    h.forEach(
      (v, i) => (data[i] = Math.max(0, Math.min(255, 128 + ((v || 0) - R.seaLevel) * SCALE))),
    )
    const tex = (u.uH.value = new THREE.DataTexture(data, t.cols, t.rows, THREE.RedFormat))
    tex.magFilter = tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    u.uSpan.value.set(t.cols * t.cell, t.rows * t.cell)
    u.uHalf.value.set(0.5 / t.cols, 0.5 / t.rows)
    const mat = new THREE.MeshPhongMaterial()
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u)
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec2 uAt; varying vec2 vRoute;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoute = position.xz + uAt;')
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uH; uniform vec2 uSpan, uHalf; uniform float uT, uBand, uLap, uSwell;
uniform vec3 uFoam, uShallow; varying vec2 vRoute;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float hm = (texture2D(uH, vec2(vRoute.x, -vRoute.y) / uSpan + uHalf).r * 255.0 - 128.0) / ${SCALE}.0;
if (hm > 0.3) discard;
float lap = sin(uT * 1.2 + (vRoute.x - vRoute.y) * 0.03) * uLap;
diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, smoothstep(-9.0, -0.5, hm) * 0.7);
diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, smoothstep(-uBand, -uBand * 0.3, hm + lap));`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
vec2 sw = vRoute * 0.07;
vec3 tilt = vec3(sin(sw.x + uT * 0.9) + sin(sw.y * 1.7 - uT * 1.3) * 0.6, 0.0, cos(sw.y + uT * 0.7) + sin(sw.x * 1.3 + sw.y - uT) * 0.5);
normal = normalize(normal + (viewMatrix * vec4(tilt * uSwell, 0.0)).xyz);`,
        )
    }
    const g = new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2)
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
  }

  /** True when route metres (x, z) are out at sea (beyond the grid, the nearest edge cell decides). */
  wet = (x: number, z: number) => {
    const { t, h } = this
    if (!t || !h) return false
    const c = Math.max(0, Math.min(t.cols - 1, Math.round(x / t.cell)))
    const r = Math.max(0, Math.min(t.rows - 1, Math.round(-z / t.cell)))
    return h[r * t.cols + c] < R.seaLevel
  }

  /** Follows the rider at `x, z` (route metres) and ripples. */
  update(x: number, z: number, t: number) {
    if (!this.mesh) return
    const mat = this.mesh.material as THREE.MeshPhongMaterial
    mat.color.set(R.sea)
    mat.specular.set(R.waterGlint)
    mat.shininess = R.waterShine
    const u = this.u
    u.uFoam.value.set(O.foam)
    u.uShallow.value.set(O.shallow)
    u.uBand.value = O.foamBand
    u.uLap.value = O.lap
    u.uSwell.value = O.swell
    u.uT.value = t
    u.uAt.value.set(x, z)
    this.mesh.position.set(x, R.seaLevel, z)
  }

  dispose() {
    this.mesh?.geometry.dispose()
    ;(this.mesh?.material as THREE.Material | undefined)?.dispose()
    this.u.uH.value?.dispose()
  }
}
