import * as THREE from 'three'
import { VIS } from '../params'
import type { Level } from '../quality'
import { VC } from '../util'
import { dropBuildingGeos } from './buildingGeo'
import { buildBuildings, buildPlants } from './chunkProps'
import type { Features } from './features'
import type { Furn } from './furniture'
import { buildFurniture, buildRails, dropFurnitureGeos } from './furnitureGeo'
import type { HeightField } from './heightField'
import type { LandCover } from './landCover'
import { buildLandmarks, dropLandmarkGeos } from './landmarkGeo'
import type { Landmark } from './landmarkPlan'
import { Patch } from './patch'
import { dropPlantGeos } from './plantGeo'
import { Tris, buildRoad } from './roadGeo'
import { newPose } from './roadPath'
import { scatter } from './scatter'
import type { Signs } from './signs'
import { buildStreets } from './streetGeo'
import { buildTerrain } from './terrainGeo'

const R = VIS.route
const P = R.place
const pose = newPose()
/** Water catches the sun; streets lie on the ground and win the depth test against it by a growing margin. */
const WATER = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true })
const STREET = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  polygonOffset: true,
})

/** Everything a chunk is built from. */
export interface Place {
  field: HeightField
  cover: LandCover
  features: Features
  signs: Signs
  furniture: Map<number, Furn[]>
  landmarks: Map<number, Landmark[]>
}

/** Builds road, terrain and what stands on it a chunk at a time around the rider and throws away what falls behind. */
export class Chunks {
  group = new THREE.Group()
  /** Milliseconds the last chunk took to build, for the harness. */
  lastMs = 0
  private live = new Map<number, THREE.Group>()
  private at = NaN
  private pending = true
  private span = 0

  constructor(private place: Place) {}

  get count() {
    return this.live.size
  }

  /** Call every frame with the rider's distance. Builds at most one chunk per call, nearest first, unless `all`. */
  update(d: number, ahead: number, level: Level, all = false) {
    const L = R.chunk
    const { path } = this.place.field
    const here = Math.floor(d / L)
    if (here === this.at && ahead === this.span && !this.pending) return
    this.at = here
    this.span = ahead
    // The road carries on a little past both ends so the world never just stops.
    const first = -1
    const last = Math.floor(path.length / L) + 2
    const lo = Math.floor((d - R.behind) / L)
    const hi = Math.floor((d + ahead) / L)
    const me = path.poseAt(d, pose)
    const { x, z } = me
    // Wanted: the stretch being ridden, plus any road close by as the crow flies (the other legs of a switchback).
    const wanted = (k: number) => {
      if (k < first || k > last) return false
      if (k >= lo && k <= hi) return true
      const c = path.poseAt((k + 0.5) * L, pose)
      return Math.hypot(c.x - x, c.z - z) < R.nearby
    }
    for (const [k, g] of this.live) if (!wanted(k)) this.drop(k, g)
    this.pending = false
    for (let i = 0; i <= last - first; i++)
      for (const k of i ? [here + i, here - i] : [here]) {
        if (this.live.has(k) || !wanted(k)) continue
        if (this.pending && !all) return
        this.build(k, level)
        this.pending = true
      }
  }

  private build(k: number, level: Level) {
    const far = level !== 'potato'
    const t0 = performance.now()
    const { field, cover, features, signs, furniture, landmarks } = this.place
    const d0 = k * R.chunk
    const d1 = d0 + R.chunk
    field.path.poseAt(d0, pose)
    const g = new THREE.Group()
    g.position.set(pose.x, pose.y, pose.z)
    const solid = new Tris(pose.x, pose.y, pose.z)
    const water = new Tris(pose.x, pose.y, pose.z)
    const strips = new Tris(pose.x, pose.y, pose.z)
    buildRoad(field.path, d0, d1, solid)
    const patches = [new Patch(field, d0, d1, far, -1), new Patch(field, d0, d1, far, 1)]
    for (const p of patches) buildTerrain(p, field.fine, cover, solid, water)
    const cf = features.chunk(k)
    if (cf) for (const m of buildStreets(cf, field, patches, strips, solid, signs)) g.add(m)
    const spots = scatter(k, patches, cover, features, P.detail[level], P.reach[level])
    for (const m of buildPlants(spots, solid)) g.add(m)
    if (cf) for (const m of buildBuildings(cf.buildings, field, patches, cover, solid)) g.add(m)
    for (const m of buildFurniture(furniture.get(k) ?? [], field, patches, solid, signs)) g.add(m)
    buildRails(patches, field, features, solid)
    for (const m of buildLandmarks(landmarks.get(k) ?? [], field, patches, solid, signs)) g.add(m)
    WATER.color.set(R.waterTint)
    WATER.specular.set(R.waterGlint)
    WATER.shininess = R.waterShine
    STREET.polygonOffsetFactor = -R.streetBias
    STREET.polygonOffsetUnits = -R.streetBias * 60
    for (const [tris, mat] of [
      [solid, VC],
      [water, WATER],
      [strips, STREET],
    ] as const) {
      if (!tris.pos.length) continue
      const m = new THREE.Mesh(tris.build(), mat)
      m.receiveShadow = true
      g.add(m)
    }
    this.group.add(g)
    this.live.set(k, g)
    this.lastMs = performance.now() - t0
  }

  private drop(k: number, g: THREE.Group) {
    g.traverse((o) => {
      // Instanced props share their geometry; only the meshes built for this chunk own theirs.
      if (o instanceof THREE.InstancedMesh) o.dispose()
      else if (o instanceof THREE.Mesh && !o.userData.sign && !o.userData.shared)
        (o.geometry as THREE.BufferGeometry).dispose()
    })
    this.place.signs.release(g)
    this.group.remove(g)
    this.live.delete(k)
  }

  /** Drops every chunk so the next update rebuilds with the current visual settings. */
  clear() {
    for (const [k, g] of this.live) this.drop(k, g)
    this.pending = true
    dropPlantGeos()
    dropBuildingGeos()
    dropFurnitureGeos()
    dropLandmarkGeos()
  }
}
