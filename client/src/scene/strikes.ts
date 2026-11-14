import * as THREE from 'three'
import type { Horde } from './horde'
import type { Particles } from './particles'
import { VIS } from './params'
import { box, canvasTex, rand } from './util'

export type StrikeKind = 'drop' | 'airstrike'

const col = new THREE.Color()
const flat = (c: string) =>
  new THREE.MeshLambertMaterial({ color: c, flatShading: true, fog: false })
const part = (g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, p: number[]) => {
  const o = new THREE.Mesh(box(w, h, d), m)
  o.position.set(p[0], p[1], p[2])
  g.add(o)
  return o
}

/** A four-engine high-wing gunship, nose towards -z. */
function makeGunship() {
  const g = new THREE.Group()
  const body = flat('#565d66')
  const dark = flat('#33383f')
  part(g, body, 2.2, 2.2, 12, [0, 0, 0])
  part(g, body, 1.6, 1.6, 2.4, [0, -0.2, -7])
  part(g, body, 17, 0.35, 2.6, [0, 1.2, -1])
  part(g, body, 0.35, 3, 2.4, [0, 2.4, 5])
  part(g, body, 6, 0.3, 1.6, [0, 1.3, 5.4])
  for (const x of [-5.6, -2.9, 2.9, 5.6]) part(g, dark, 0.8, 0.8, 2.2, [x, 0.75, -2])
  const flash = part(
    g,
    new THREE.MeshBasicMaterial({ color: '#ffd860', fog: false }),
    0.9,
    0.9,
    0.9,
    [-1.6, -0.6, 1],
  )
  return { g, flash }
}

/** Air support for clean-riding streaks: a supply drop, an air strike and an orbiting gunship. */
export class Strikes {
  group = new THREE.Group()
  private ship = makeGunship()
  private jet = new THREE.Group()
  private crate = new THREE.Group()
  private tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }))
  private names = ''
  /** Seconds since each one-shot started, or -1 when idle. */
  private jetT = -1
  private dropT = -1
  private shipK = 0
  private shot = 0
  private boomed = false
  private aim = new THREE.Vector3()
  private eye = new THREE.Vector3()
  private look = new THREE.Vector3()
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()

  constructor() {
    const j = flat('#3d444d')
    part(this.jet, j, 1.2, 1, 8, [0, 0, 0])
    part(this.jet, j, 7, 0.2, 2.6, [0, 0, 1.2])
    part(this.jet, j, 0.2, 1.8, 1.6, [0, 0.9, 3.2])
    part(this.crate, flat('#8a6a3a'), 2, 2, 2, [0, 0, 0])
    part(this.crate, flat('#e8e2d0'), 5, 0.6, 5, [0, 4, 0])
    this.tag.scale.set(11, 1.8, 1)
    this.tag.position.set(-6, -4, 2)
    this.ship.g.add(this.tag)
    this.group.add(this.ship.g, this.jet, this.crate)
    this.ship.g.visible = this.jet.visible = this.crate.visible = false
  }

  /** The jet while it is in the air, for the air-strike cinematic. */
  get jetAt() {
    return this.jetT >= 0 ? this.jet.position : null
  }
  /** The crate while it is falling, for the supply-drop cinematic. */
  get crateAt() {
    return this.dropT >= 0 ? this.crate.position : null
  }

  fire(kind: StrikeKind) {
    if (kind === 'drop') this.dropT = 0
    else {
      this.jetT = 0
      this.boomed = false
    }
  }

  private label(names: string) {
    if (names === this.names) return
    this.names = names
    this.tag.material.map?.dispose()
    this.tag.material.map = canvasTex(640, 104, (g) => {
      g.fillStyle = 'rgba(14,12,22,0.78)'
      g.beginPath()
      g.roundRect(4, 4, 632, 96, 30)
      g.fill()
      g.fillStyle = '#ffd860'
      g.font = '700 44px system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(names, 320, 54, 600)
    })
    this.tag.material.needsUpdate = true
  }

  /** Blends the camera into the gunship view while it is up. Call after the chase rig. */
  view(cam: THREE.Camera) {
    const k = this.shipK * this.shipK * (3 - 2 * this.shipK)
    if (k < 0.001) return
    this.look.copy(this.aim).lerp(this.ship.g.position, 0.35)
    this.q.setFromRotationMatrix(this.m.lookAt(this.eye, this.look, cam.up))
    cam.position.lerp(this.eye, k)
    cam.quaternion.slerp(this.q, k)
  }

  /** Returns true on the frame the air strike lands, so the camera can shake. */
  update(
    t: number,
    dt: number,
    s: { speed: number; gunship?: boolean; riders: { name: string; st: string }[] },
    hordeZ: number | null,
    horde: Horde,
    sparks: Particles,
    smoke: Particles,
  ) {
    let boom = false
    const hz = hordeZ ?? 40
    const hit = (n: number, size: number) => {
      if (hordeZ !== null) horde.launch(n)
      for (let i = 0; i < size; i++)
        smoke.emit({
          p: { x: rand(-5, 5), y: rand(0.3, 2), z: hz + rand(0, 10) },
          v: { x: rand(-2, 2), y: rand(2, 7), z: rand(-1, 3) },
          life: rand(0.8, 1.8),
          s0: 2,
          s1: 7,
          c: col.set(i % 3 ? '#4a4038' : '#ff8a30'),
          a: 0.6,
          drag: 0.96,
        })
    }

    // gunship: circles the horde with its left side (the guns) facing in
    this.shipK += ((s.gunship ? 1 : 0) - this.shipK) * Math.min(1, dt * 1.5)
    const ship = this.ship.g
    ship.visible = this.shipK > 0.02
    if (ship.visible) {
      this.label(
        s.riders
          .filter((r) => r.st === 'riding')
          .map((r) => r.name)
          .join(' · '),
      )
      const a = t * VIS.gunshipSpin
      this.aim.set(0, 0, hz * 0.6)
      ship.position.set(
        Math.sin(a) * VIS.gunshipOrbit,
        VIS.gunshipHeight,
        this.aim.z + Math.cos(a) * VIS.gunshipOrbit,
      )
      ship.rotation.set(0, a - Math.PI / 2, 0.45, 'YXZ')
      // camera seat: above, behind and outside the gunship, looking past it at the horde
      this.eye
        .set(-Math.cos(a) * 20 + Math.sin(a) * 9, 9, Math.sin(a) * 20 + Math.cos(a) * 9)
        .add(ship.position)
      this.shot -= dt
      const firing = !!s.gunship && this.shot <= 0
      this.ship.flash.visible = firing
      if (firing) {
        this.shot = rand(0.05, 0.12)
        const life = 0.55
        const tx = rand(-5, 5)
        const tz = hz + rand(0, 12)
        sparks.emit({
          p: ship.position,
          v: {
            x: (tx - ship.position.x) / life,
            y: -ship.position.y / life,
            z: (tz - ship.position.z) / life,
          },
          life,
          s0: 0.9,
          s1: 0.5,
          c: col.set('#ffd860'),
          a: 1,
        })
        if (Math.random() < 0.12) hit(3, 4)
      }
    }

    // air strike: a jet runs front to back and the horde front goes up
    this.jet.visible = this.jetT >= 0
    if (this.jetT >= 0) {
      this.jetT += dt
      this.jet.position.set(-5, 5.5, -220 + this.jetT * 170)
      if (!this.boomed && this.jet.position.z > hz - 10) {
        this.boomed = boom = true
        hit(40, 30)
      }
      if (this.jet.position.z > 120) this.jetT = -1
    }

    // supply drop: a crate floats down onto the road ahead and the bus drives through it
    this.crate.visible = this.dropT >= 0
    if (this.dropT >= 0) {
      this.dropT += dt
      const k = Math.min(1, this.dropT / 3.5)
      this.crate.position.set(0, 1 + (1 - k) * 16, -45 * (1 - k) - 5)
      this.crate.rotation.z = Math.sin(t * 3) * 0.15 * (1 - k)
      if (k >= 1) {
        this.dropT = -1
        for (let i = 0; i < 30; i++)
          sparks.emit({
            p: this.crate.position,
            v: { x: rand(-6, 6), y: rand(3, 10), z: rand(-2, 10) + s.speed * 0.3 },
            life: rand(0.5, 1.1),
            s0: 0.6,
            s1: 0.1,
            c: col.set('#ffd23f'),
            a: 1,
            g: 12,
          })
      }
    }
    return boom
  }
}
