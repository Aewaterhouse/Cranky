import * as THREE from 'three'
import { SLOTS, ROOF_Y } from './busParts'
import { makeCable } from './cables'
import { makeRider } from './riders'
import type { SceneRider } from './world'
import type { Particles } from './particles'
import { clamp } from './util'

const COLOURS = ['#e94f37', '#3f88c5', '#44bba4', '#f6ae2d', '#9b5de5', '#f15bb5']

interface Entry {
  r: ReturnType<typeof makeRider>
  cable: ReturnType<typeof makeCable>
  slot: number
  seed: number
  runX: number
}

/** The riders on the roof: pedalling, fallen and running behind, or slumped as spectators. */
export class Crew {
  private map = new Map<string, Entry>()
  private target = new THREE.Vector3()
  private qI = new THREE.Quaternion()

  constructor(
    private scene: THREE.Scene,
    private shell: THREE.Object3D,
  ) {}

  update(
    riders: SceneRider[],
    t: number,
    dt: number,
    hordeFront: number | null,
    steam?: Particles,
    speed = 0,
  ) {
    const live = new Set(riders.map((r) => r.id))
    for (const [id, e] of this.map)
      if (!live.has(id)) {
        e.r.person.parent?.remove(e.r.person)
        this.shell.remove(e.r.root, e.cable.group)
        e.cable.dispose()
        this.map.delete(id)
      }
    const taken = new Set([...this.map.values()].map((e) => e.slot))
    let runners = 0
    riders.forEach((sr) => {
      let e = this.map.get(sr.id)
      if (!e) {
        let slot = 0
        while (taken.has(slot) && slot < SLOTS.length - 1) slot++
        taken.add(slot)
        e = {
          r: makeRider(COLOURS[this.map.size % COLOURS.length], sr.id),
          cable: makeCable(...SLOTS[slot]),
          slot,
          seed: Math.random() * 6.28,
          runX: 0,
        }
        e.r.root.position.set(SLOTS[slot][0], ROOF_Y, SLOTS[slot][1])
        this.shell.add(e.r.root, e.cable.group)
        this.map.set(sr.id, e)
      }
      const r = e.r
      r.label(sr.name, sr.c, sr.st, sr.hr, sr.hrp)
      r.heat(sr.st === 'spectator' ? null : sr.hrp, dt, steam, speed)
      r.setLook(sr.look)
      const fell = sr.st === 'fell'
      const ph = t * (sr.cadence / 60) * Math.PI * 2 + e.seed
      if (fell) {
        if (r.person.parent !== this.scene) this.scene.attach(r.person)
        const lane = (runners++ % 2 ? 1 : -1) * (1.6 + Math.floor(runners / 2) * 1.2)
        const z = hordeFront === null ? 10 + runners * 1.8 : 6.5 + (hordeFront - 6.5) * 0.45
        this.target.set(lane, 0, z)
        r.person.position.lerp(this.target, clamp(dt * 3))
        r.person.quaternion.slerp(this.qI, clamp(dt * 6))
        r.pose('run', t * 9 + e.seed, 0)
      } else {
        if (r.person.parent !== r.root) r.root.attach(r.person)
        r.person.position.lerp(this.target.set(0, 0, 0), clamp(dt * 5))
        r.person.quaternion.slerp(this.qI, clamp(dt * 8))
        r.pose(sr.st === 'spectator' ? 'slump' : 'ride', ph, Math.sign(SLOTS[e.slot][0]))
      }
      r.fade(sr.st === 'spectator' ? 0.35 : 1)
      e.cable.update(sr.st === 'riding' ? (sr.effort ?? 0.8) : 0, ph)
      r.bike.group.visible = true
    })
  }
}
