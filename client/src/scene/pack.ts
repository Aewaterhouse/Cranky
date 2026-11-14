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
  /** Speed Dating: the couples on this date with their match (0..1). Anyone left over is the Chaperone. */
  pairs?: [string, string, number][]
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
  private hearts = [0, 1, 2].map(() => emoji('💗'))
  private eyes = emoji('👀')

  constructor() {
    this.group.add(this.crown, this.medal, this.eyes, ...this.hearts)
  }

  /** Speed Dating places: couples side by side with a heart between them, the Chaperone lurking behind. */
  private dates(pairs: [string, string, number][], t: number) {
    const spot = new Map<string, [number, number]>()
    const mid = (VIS.packBack + VIS.packFront) / 2
    this.hearts.forEach((s, j) => {
      const p = pairs[j]
      s.visible = !!p
      if (!p) return
      const x = (j - (pairs.length - 1) / 2) * VIS.packLane * 2.6
      const z = mid + (j % 2) * 2.5
      spot.set(p[0], [x - VIS.packLane * 0.55, z])
      spot.set(p[1], [x + VIS.packLane * 0.55, z])
      s.position.set(x, 1.8 + Math.sin(t * 3 + j) * 0.1, z)
      s.scale.setScalar((0.5 + p[2] * 1.5) * (1 + Math.sin(t * (4 + p[2] * 8)) * 0.1 * p[2]))
      s.material.opacity = 0.35 + p[2] * 0.65
    })
    return spot
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
    this.crown.visible = this.medal.visible = this.eyes.visible = false
    const spot = mad.pairs ? this.dates(mad.pairs, t) : null
    if (!spot) this.hearts.forEach((s) => (s.visible = false))
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
      const at = spot?.get(sr.id)
      const want = at
        ? at[1]
        : out || spot
          ? VIS.packBack + 5
          : VIS.packBack + (VIS.packFront - VIS.packBack) * k
      e.z += (want - e.z) * clamp(dt * 0.8)
      const lane = spot ? 0 : (i - (riders.length - 1) / 2) * VIS.packLane
      const wantX = (at ? at[0] : lane) + Math.sin(t * 0.6 + e.seed) * (at ? 0.08 : 0.25)
      const x = spot ? r.root.position.x + (wantX - r.root.position.x) * clamp(dt * 1.5) : wantX
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
      if (spot && !at && !out) mark(this.eyes, 3.6, 1.1)
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
