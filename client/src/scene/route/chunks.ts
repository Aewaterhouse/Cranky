import * as THREE from 'three'
import { VIS } from '../params'
import { VC } from '../util'
import type { HeightField } from './heightField'
import { Tris, buildRoad } from './roadGeo'
import { newPose } from './roadPath'
import { buildTerrain } from './terrainGeo'

const R = VIS.route
const pose = newPose()

/** Builds road and terrain a chunk at a time around the rider and throws away what falls behind. */
export class Chunks {
  group = new THREE.Group()
  /** Milliseconds the last chunk took to build, for the harness. */
  lastMs = 0
  private live = new Map<number, THREE.Mesh>()
  private at = NaN
  private pending = true
  private span = 0

  constructor(private field: HeightField) {}

  get count() {
    return this.live.size
  }

  /** Call every frame with the rider's distance. Builds at most one chunk per call, nearest first, unless `all`. */
  update(d: number, ahead: number, far: boolean, all = false) {
    const L = R.chunk
    const here = Math.floor(d / L)
    if (here === this.at && ahead === this.span && !this.pending) return
    this.at = here
    this.span = ahead
    // The road carries on a little past both ends so the world never just stops.
    const first = -1
    const last = Math.floor(this.field.path.length / L) + 2
    const lo = Math.floor((d - R.behind) / L)
    const hi = Math.floor((d + ahead) / L)
    const me = this.field.path.poseAt(d, pose)
    const { x, z } = me
    // Wanted: the stretch being ridden, plus any road close by as the crow flies (the other legs of a switchback).
    const wanted = (k: number) => {
      if (k < first || k > last) return false
      if (k >= lo && k <= hi) return true
      const c = this.field.path.poseAt((k + 0.5) * L, pose)
      return Math.hypot(c.x - x, c.z - z) < R.nearby
    }
    for (const [k, m] of this.live)
      if (!wanted(k)) {
        m.geometry.dispose()
        this.group.remove(m)
        this.live.delete(k)
      }
    this.pending = false
    for (let i = 0; i <= last - first; i++)
      for (const k of i ? [here + i, here - i] : [here]) {
        if (this.live.has(k) || !wanted(k)) continue
        if (this.pending && !all) return
        this.build(k, far)
        this.pending = true
      }
  }

  private build(k: number, far: boolean) {
    const t0 = performance.now()
    const d0 = k * R.chunk
    this.field.path.poseAt(d0, pose)
    const tris = new Tris(pose.x, pose.y, pose.z)
    buildRoad(this.field.path, d0, d0 + R.chunk, tris)
    buildTerrain(this.field, d0, d0 + R.chunk, far, tris)
    const m = new THREE.Mesh(tris.build(), VC)
    m.position.set(pose.x, pose.y, pose.z)
    m.receiveShadow = true
    this.group.add(m)
    this.live.set(k, m)
    this.lastMs = performance.now() - t0
  }

  /** Drops every chunk so the next update rebuilds with the current visual settings. */
  clear() {
    for (const m of this.live.values()) {
      m.geometry.dispose()
      this.group.remove(m)
    }
    this.live.clear()
    this.pending = true
  }
}
