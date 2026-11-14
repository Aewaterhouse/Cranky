import * as THREE from 'three'
import type { Particles } from './particles'
import { VIS } from './params'
import { makeRider } from './riders'
import type { SceneRider } from './world'
import { canvasTex, clamp, rand } from './util'

/** VO2 Madness state the scene needs: effort points, who wears the crown and who leads. */
export interface MadScene {
  pts: Record<string, number>
  crown: string | null
  lead: string | null
  work: boolean
}

const COLOURS = ['#e94f37', '#3f88c5', '#44bba4', '#f6ae2d', '#9b5de5', '#f15bb5']
const PARTY = ['#ffd23f', '#ff5a4e', '#6cf', '#7fd13b', '#e040fb']
const col = new THREE.Color()

const emoji = (ch: string) => {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: canvasTex(96, 96, (g) => {
        g.font = '72px serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(ch, 48, 54)
      }),
      depthTest: false,
      transparent: true,
    }),
  )
  s.renderOrder = 11
  s.visible = false
  return s
}

interface Entry {
  r: ReturnType<typeof makeRider>
  z: number
  seed: number
}

/** The VO2 Madness pack: riders on the road, ordered front to back by effort points. */
export class Pack {
  group = new THREE.Group()
  private map = new Map<string, Entry>()
  private crown = emoji('👑')
  private medal = emoji('🥇')
  private crowned: string | null = null

  constructor() {
    this.group.add(this.crown, this.medal)
  }

  update(
    riders: SceneRider[],
    mad: MadScene,
    t: number,
    dt: number,
    speed: number,
    smoke: Particles,
    sparks: Particles,
  ) {
    const live = new Set(riders.map((r) => r.id))
    for (const [id, e] of this.map)
      if (!live.has(id)) {
        this.group.remove(e.r.root)
        this.map.delete(id)
      }
    const pts = riders.map((r) => mad.pts[r.id] ?? 0)
    const top = Math.max(0, ...pts)
    const low = Math.min(top, ...pts)
    this.crown.visible = this.medal.visible = false
    riders.forEach((sr, i) => {
      let e = this.map.get(sr.id)
      if (!e) {
        e = {
          r: makeRider(COLOURS[this.map.size % COLOURS.length], sr.id),
          z: VIS.packBack,
          seed: Math.random() * 6.28,
        }
        this.group.add(e.r.root)
        this.map.set(sr.id, e)
      }
      const r = e.r
      const out = sr.st !== 'riding'
      const k = top > low ? ((mad.pts[sr.id] ?? 0) - low) / (top - low) : 0.5
      const want = out ? VIS.packBack + 5 : VIS.packBack + (VIS.packFront - VIS.packBack) * k
      e.z += (want - e.z) * clamp(dt * 0.8)
      const x = (i - (riders.length - 1) / 2) * VIS.packLane + Math.sin(t * 0.6 + e.seed) * 0.25
      r.root.position.set(x, 0, e.z)
      r.label(sr.name, sr.c, sr.st, sr.hr, sr.hrp)
      r.setLook(sr.look)
      r.heat(out ? null : sr.hrp, dt, smoke, speed)
      r.pose(out ? 'slump' : 'ride', t * (sr.cadence / 60) * Math.PI * 2 + e.seed, 0)
      r.fade(out ? 0.35 : 1)
      const mark = (s: THREE.Sprite, y: number, size: number) => {
        s.visible = true
        s.scale.setScalar(size * (1 + Math.sin(t * 6) * 0.08))
        s.position.set(x, y + Math.sin(t * 3) * 0.12, e.z - 0.3)
      }
      if (sr.id === mad.lead) mark(this.medal, 0.5, 0.8)
      if (sr.id !== mad.crown) return
      mark(this.crown, 3.9, 1.4)
      // the crown holder leaves a trail of fire while the interval is on
      if (mad.work && Math.random() < dt * 40)
        sparks.emit({
          p: { x: x + rand(-0.15, 0.15), y: rand(0.2, 0.6), z: e.z + 1 },
          v: { x: rand(-0.5, 0.5), y: rand(0.5, 2.5), z: rand(2, 5) + speed * 0.3 },
          life: rand(0.4, 0.9),
          s0: 0.7,
          s1: 0.1,
          c: col.set(Math.random() < 0.5 ? '#ff8a20' : '#ffd23f'),
          a: 1,
        })
      if (this.crowned !== sr.id) {
        this.crowned = sr.id
        for (let n = 0; n < 60; n++)
          sparks.emit({
            p: { x, y: 3, z: e.z },
            v: { x: rand(-6, 6), y: rand(2, 10), z: rand(-4, 8) },
            life: rand(0.7, 1.5),
            s0: 0.5,
            s1: 0.15,
            c: col.set(PARTY[n % PARTY.length]),
            a: 1,
            g: 10,
          })
      }
    })
  }
}
