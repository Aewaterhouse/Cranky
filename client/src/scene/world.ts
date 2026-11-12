import * as THREE from 'three'
import type { Look } from '../core/cosmetics'
import { makeBus, makeRider } from './bus'
import { Horde } from './horde'
import { VIS, type Mood } from './params'

export interface SceneRider {
  id: string
  name: string
  c: number | null
  st: string
  cadence: number
  look?: Look
}
export interface SceneState {
  speed: number
  gap: number | null
  armour: number | null
  mood: Mood
  riders: SceneRider[]
  /** 0..1 progress towards a roadblock, or null. */
  roadblock: number | null
  /** The driver's bus cosmetics. */
  busLook?: Look
}

const COLOURS = ['#e94f37', '#3f88c5', '#44bba4', '#f6ae2d', '#9b5de5', '#f15bb5']
const LOOP = 400

/** The road world: bus, riders, props, horde, roadblock, moods and camera effects. */
export class World {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(VIS.fov, 1, 0.1, 600)
  state: SceneState = {
    speed: 0,
    gap: null,
    armour: null,
    mood: 'drill',
    riders: [],
    roadblock: null,
  }
  private bus = makeBus()
  private horde = new Horde()
  private hordeZ = 60
  private riders = new Map<string, ReturnType<typeof makeRider>>()
  private movers: THREE.InstancedMesh[] = []
  private moverZ: number[][] = []
  private sun = new THREE.DirectionalLight('#fff', VIS.sun)
  private hemi = new THREE.HemisphereLight('#fff', '#445', 1.2)
  private block = new THREE.Group()
  private debris: { m: THREE.Mesh; v: THREE.Vector3 }[] = []
  private t = 0
  private shakeAmt = 0
  private slowUntil = 0
  private flash = 0
  private last = performance.now()
  private raf = 0

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio))
    host.prepend(this.renderer.domElement)
    this.scene.fog = new THREE.Fog('#fff', VIS.fogNear, VIS.fogFar)
    this.sun.position.set(-30, 50, 20)
    this.scene.add(this.sun, this.hemi, this.bus.group, this.horde.group, this.block)
    const plane = (w: number, d: number, c: string, y: number) => {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: c }),
      )
      p.position.set(0, y, -150)
      this.scene.add(p)
    }
    plane(800, 800, VIS.groundColour, -0.01)
    plane(11, 800, VIS.roadColour, 0)
    const dash = new THREE.BoxGeometry(0.25, 0.02, 3)
    const tree = new THREE.ConeGeometry(1.6, 5, 6).translate(0, 3.2, 0).toNonIndexed()
    const rock = new THREE.DodecahedronGeometry(1.2).translate(0, 0.5, 0)
    const car = new THREE.BoxGeometry(2, 1.4, 4.2).translate(0, 0.7, 0)
    this.addMover(
      dash,
      '#ddd',
      40,
      () => 0,
      (i) => (i * LOOP) / 40,
    )
    this.addMover(
      tree,
      '#2f5a2a',
      90,
      () => (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 40),
    )
    this.addMover(rock, '#777', 30, () => (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 30))
    this.addMover(
      car,
      '#6a4a3a',
      10,
      () => (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 4),
    )
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshLambertMaterial({ color: i % 2 ? '#c33' : '#eee' }),
      )
      c.position.set(-4.5 + (i % 7) * 1.5, 0.7 + Math.floor(i / 7) * 1.4, 0)
      this.block.add(c)
    }
    this.block.visible = false
    addEventListener('resize', this.resize)
    this.resize()
    this.loop()
  }

  private addMover(
    geo: THREE.BufferGeometry,
    colour: string,
    n: number,
    x: () => number,
    z: (i: number) => number = () => Math.random() * LOOP,
  ) {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: colour }), n)
    const zs: number[] = []
    const mat = new THREE.Matrix4()
    for (let i = 0; i < n; i++) {
      zs.push(40 - z(i))
      mat.makeRotationY(Math.random() * 6)
      mat.setPosition(x(), 0, 0)
      m.setMatrixAt(i, mat)
    }
    this.scene.add(m)
    this.movers.push(m)
    this.moverZ.push(zs)
  }

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.host
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  fx(kind: 'hit' | 'shake' | 'slowmo' | 'smash') {
    if (kind === 'hit') {
      this.flash = 1
      this.shakeAmt = 0.8
    }
    if (kind === 'shake') this.shakeAmt = 1.5
    if (kind === 'slowmo') this.slowUntil = performance.now() + 1800
    if (kind === 'smash') this.smash()
  }

  private smash() {
    this.block.children.forEach((c) => {
      const m = (c as THREE.Mesh).clone()
      m.position.copy(c.getWorldPosition(new THREE.Vector3()))
      this.scene.add(m)
      this.debris.push({
        m,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          6 + Math.random() * 8,
          4 + Math.random() * 10,
        ),
      })
    })
    this.block.visible = false
    this.shakeAmt = 1.2
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    let dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    if (now < this.slowUntil) dt *= 0.25
    this.t += dt
    this.step(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private step(dt: number) {
    const s = this.state
    const mood = VIS.moods[s.mood] ?? VIS.moods.drill
    const lerpCol = (c: THREE.Color, to: string) =>
      c.lerp(new THREE.Color(to), Math.min(1, dt * 1.5))
    this.scene.background ??= new THREE.Color(mood.sky)
    lerpCol(this.scene.background as THREE.Color, mood.sky)
    const fog = this.scene.fog as THREE.Fog
    lerpCol(fog.color, mood.fog)
    fog.near = VIS.fogNear
    fog.far = VIS.fogFar
    lerpCol(this.sun.color, mood.light)
    this.sun.intensity = VIS.sun

    const dz = s.speed * dt
    const mat = new THREE.Matrix4()
    this.movers.forEach((m, k) => {
      const zs = this.moverZ[k]
      for (let i = 0; i < zs.length; i++) {
        zs[i] += dz
        if (zs[i] > 40) zs[i] -= LOOP
        m.getMatrixAt(i, mat)
        mat.elements[14] = zs[i]
        m.setMatrixAt(i, mat)
      }
      m.instanceMatrix.needsUpdate = true
    })
    this.bus.wheels.forEach((w) => (w.rotation.x -= dz / 0.6))
    this.bus.group.position.y = Math.abs(Math.sin(this.t * 9)) * 0.05 * Math.min(1, s.speed / 10)
    const armour = s.armour ?? 100
    this.flash = Math.max(0, this.flash - dt * 2)
    this.bus.setLook(s.busLook ?? {})
    this.bus.body.color
      .set(this.bus.body.userData.colour)
      .lerp(new THREE.Color('#6a5a4a'), (1 - armour / 100) * 0.7)
      .lerp(new THREE.Color('#f00'), this.flash)

    this.horde.group.visible = s.gap !== null
    if (s.gap !== null) {
      const target = 5.5 + s.gap * VIS.gapScale
      this.hordeZ += (target - this.hordeZ) * Math.min(1, dt * 2)
      this.horde.group.position.z = this.hordeZ
      this.horde.update(this.t)
    }
    if (s.roadblock !== null) {
      if (!this.block.visible && !this.debris.length) this.block.visible = true
      this.block.position.z = -8 - 90 * (1 - s.roadblock)
    } else this.block.visible = false
    this.debris = this.debris.filter((d) => {
      d.v.y -= 20 * dt
      d.m.position.addScaledVector(d.v, dt)
      d.m.rotation.x += dt * 5
      if (d.m.position.y < -3) this.scene.remove(d.m)
      return d.m.position.y >= -3
    })
    this.updateRiders(dt)

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5)
    const sh = () => (Math.random() - 0.5) * this.shakeAmt
    this.camera.fov = VIS.fov
    this.camera.updateProjectionMatrix()
    this.camera.position.set(sh() + Math.sin(this.t * 0.2) * 1.5, VIS.camHeight + sh(), VIS.camDist)
    this.camera.lookAt(0, 2, VIS.camLook)
  }

  private updateRiders(dt: number) {
    const live = new Set(this.state.riders.map((r) => r.id))
    for (const [id, r] of this.riders)
      if (!live.has(id)) {
        this.scene.remove(r.group)
        this.riders.delete(id)
      }
    this.state.riders.forEach((sr, i) => {
      let r = this.riders.get(sr.id)
      if (!r) {
        r = makeRider(COLOURS[this.riders.size % COLOURS.length])
        this.riders.set(sr.id, r)
        this.scene.add(r.group)
      }
      r.label(sr.name, sr.c)
      r.setLook(sr.look)
      const ph = this.t * (sr.cadence / 60) * Math.PI * 2
      const target =
        sr.st === 'fell'
          ? new THREE.Vector3(
              i % 2 ? 1.5 : -1.5,
              0.3 + Math.abs(Math.sin(ph)) * 0.3,
              6.5 + (this.hordeZ - 6.5) * 0.4,
            )
          : new THREE.Vector3(
              i % 2 ? 0.7 : -0.7,
              3.5 + Math.abs(Math.sin(ph)) * 0.12,
              -3 + Math.floor(i / 2) * 2.4,
            )
      r.group.position.lerp(target, Math.min(1, dt * 4))
      r.torso.rotation.z = Math.sin(ph) * 0.15
      r.fade(sr.st === 'spectator' ? 0.3 : 1)
    })
  }

  /** PNG of the current view (render then read in the same frame). */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.resize)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

export async function debugPanel() {
  const { default: GUI } = await import('lil-gui')
  const gui = new GUI({ title: 'Visual debug' })
  gui.add(VIS, 'camHeight', 2, 40)
  gui.add(VIS, 'camDist', 5, 60)
  gui.add(VIS, 'camLook', -40, 10)
  gui.add(VIS, 'fov', 30, 100)
  gui.add(VIS, 'fogNear', 0, 200)
  gui.add(VIS, 'fogFar', 50, 600)
  gui.add(VIS, 'gapScale', 0.1, 2)
  gui.add(VIS, 'sun', 0, 5)
  gui.addColor(VIS, 'busColour')
  for (const [k, m] of Object.entries(VIS.moods)) {
    const f = gui.addFolder(`Mood: ${k}`).close()
    f.addColor(m, 'sky')
    f.addColor(m, 'fog')
    f.addColor(m, 'light')
  }
  return gui
}
