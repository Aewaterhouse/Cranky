import * as THREE from 'three'
import { cosmetic, type Look } from '../core/cosmetics'
import {
  EXHAUST,
  HOOD,
  WHEELS,
  bullbarGeo,
  eskyGeo,
  flagsGeo,
  ploughGeo,
  damageGroups,
  glassGeo,
  paintGeo,
  plateGroups,
  spikesGeo,
  trimGeo,
} from './busParts'
import { makeAmbo } from './ambulance'
import { VIS } from './params'
import { Mesher, VC, box, canvasTex, clamp, cyl } from './util'

const TIERS = 6
const SOOT = 3

function wheelGeo() {
  const m = new Mesher(0.08)
  const x = Math.PI / 2
  m.add(cyl(0.62, 0.62, 0.46, 14), '#19191b', [0, 0, 0], [0, 0, x])
  m.add(cyl(0.4, 0.4, 0.5, 10), '#9aa0a8', [0, 0, 0], [0, 0, x])
  m.add(cyl(0.18, 0.18, 0.56, 6), '#4a4d54', [0, 0, 0], [0, 0, x])
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    m.add(
      box(0.06, 0.34, 0.08),
      '#2a2c30',
      [0.25, Math.sin(a) * 0.25, Math.cos(a) * 0.25],
      [-a, 0, 0],
    )
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    m.add(box(0.5, 0.1, 0.1), '#0f0f10', [0, Math.sin(a) * 0.62, Math.cos(a) * 0.62], [-a, 0, 0])
  }
  return m.build()
}

const basic = (c: string) => new THREE.MeshBasicMaterial({ color: c })

/** Procedural low-poly school bus. Front faces -z; origin at road level. */
export function makeBus() {
  const g = new THREE.Group()
  const paint = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    color: VIS.busColour,
  })
  const glass = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    emissive: '#ffb860',
    emissiveIntensity: 0,
  })
  const shell = new THREE.Group()
  g.add(shell)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = shell) => {
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true
    parent.add(m)
    return m
  }
  add(paintGeo(), paint)
  add(glassGeo(), glass)
  add(trimGeo(), VC)
  const wg = wheelGeo()
  const wheels = WHEELS.map(([x, z]) => {
    const w = new THREE.Group()
    w.position.set(x, 0.62, z)
    const m = new THREE.Mesh(wg, VC)
    m.castShadow = true
    if (x < 0) m.rotation.y = Math.PI
    w.add(m)
    g.add(w)
    return { g: w, m }
  })
  const bullbar = add(bullbarGeo(), VC)
  const spikes = add(spikesGeo(), VC)
  const plough = add(ploughGeo(), VC)
  const flags = add(flagsGeo(), VC)
  const esky = add(eskyGeo(), VC)
  const plates = plateGroups(TIERS).map((geo) => add(geo, VC))
  const soot = damageGroups(SOOT).map((geo) => add(geo, VC))

  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.55),
    new THREE.MeshBasicMaterial({
      transparent: true,
      map: canvasTex(512, 128, (c) => {
        c.fillStyle = '#16120c'
        c.textAlign = 'center'
        c.font = '900 64px system-ui, sans-serif'
        c.fillText('ZOMBIE BUS', 256, 66)
        c.font = '700 26px system-ui, sans-serif'
        c.fillText("HONK IF YOU'RE NOT DEAD", 256, 108)
      }),
    }),
  )
  decal.position.set(-0.3, 1.7, 5.02)
  decal.rotation.y = 0
  shell.add(decal)
  const headMat = basic('#fff6d0')
  const brakeMat = basic('#aa1a1a')
  const amberA = basic('#ffa020')
  const amberB = basic('#ffa020')
  const lens = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    shell.add(m)
  }
  const hl = cyl(0.2, 0.2, 0.08, 8).rotateX(Math.PI / 2)
  for (const x of [-0.88, 0.88]) lens(hl, headMat, x, 1.55, -5.46)
  for (const x of [-1.25, 1.25]) lens(box(0.4, 0.2, 0.06), brakeMat, x, 1.45, 5.04)
  const amber = cyl(0.14, 0.14, 0.12, 8)
  for (const [x, z, m] of [
    [-1.1, -3.1, amberA],
    [1.1, -3.1, amberB],
    [-1.1, 4.7, amberB],
    [1.1, 4.7, amberA],
  ] as [number, number, THREE.Material][])
    lens(amber, m, x, 3.42, z)

  const spot = (x: number) => {
    const s = new THREE.SpotLight('#fff2c8', 0, 110, 0.5, 0.7, 1)
    s.position.set(x, 1.6, -5.4)
    s.target.position.set(x * 0.6, 0, -40)
    g.add(s, s.target)
    return s
  }
  const spots = [spot(-0.88), spot(0.88)]
  const bg = new THREE.ConeGeometry(5, 42, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -21)
  const cols = new Float32Array(bg.attributes.position.count * 3)
  for (let i = 0; i < bg.attributes.position.count; i++)
    cols.fill(Math.max(0, 1 + bg.attributes.position.getZ(i) / 42), i * 3, i * 3 + 3)
  bg.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    color: '#fff0c0',
    opacity: 0,
  })
  const beam = new THREE.Mesh(bg, beamMat)
  beam.position.set(0, 1.6, -5.5)
  beam.scale.set(0.5, 0.4, 1)
  g.add(beam)

  const ambo = makeAmbo(shell)
  let lookKey = ''
  let baseCol = new THREE.Color(VIS.busColour)
  /** `amb` dresses the bus as an ambulance: white, striped, light bar, none of the driver's cosmetics. */
  const setLook = (look: Look = {}, amb = false) => {
    const key = amb ? `ambo|${VIS.amboColour}` : `${look.paint}|${look.bullbar}|${look.spikes}`
    if (key === lookKey) return
    lookKey = key
    if (amb) look = {}
    ambo.group.visible = amb
    decal.visible = !amb
    baseCol = new THREE.Color(
      amb ? VIS.amboColour : (cosmetic(look.paint)?.colour ?? VIS.busColour),
    )
    bullbar.visible = look.bullbar === 'bullbar'
    plough.visible = look.bullbar === 'bullbar-plough'
    spikes.visible = look.spikes === 'spikes'
    flags.visible = look.spikes === 'roof-flags'
    esky.visible = look.spikes === 'roof-esky'
  }
  setLook({})

  const tmp = new THREE.Color()
  const update = (p: {
    t: number
    speed: number
    armour: number | null
    head: number
    brake: number
    hit: number
    pitch: number
    dz: number
    siren?: number
  }) => {
    ambo.update(p.t, p.siren ?? 0)
    const { t, speed } = p
    const sp = clamp(speed / 12)
    const kick = p.hit
    g.position.y =
      Math.abs(Math.sin(t * 9)) * 0.05 * sp + Math.abs(Math.sin(t * 17)) * 0.02 * sp + kick * 0.18
    shell.rotation.z = (Math.sin(t * 1.3) * 0.012 + Math.sin(t * 7.1) * 0.004 * sp) * VIS.sway
    shell.rotation.x = p.pitch - kick * 0.05
    shell.position.z = kick * 0.35
    wheels.forEach((w) => (w.m.rotation.x -= p.dz / 0.62))
    const armour = p.armour
    const a = armour ?? 100
    const wob = armour !== null && armour <= 2
    wheels[2].g.rotation.z = wob ? Math.sin(t * 15) * 0.2 : 0
    wheels[2].g.position.x = -1.4 + (wob ? Math.sin(t * 15) * 0.07 : 0)
    const count = armour === null ? 0 : Math.ceil((a / 100) * TIERS)
    plates.forEach((m, i) => (m.visible = i < count))
    soot.forEach((m, i) => (m.visible = a < [75, 50, 25][i]))
    paint.color
      .copy(baseCol)
      .lerp(tmp.set('#5a4a3c'), (1 - a / 100) * 0.3)
      .lerp(tmp.set('#ff2a1a'), p.hit * 0.5)
    const on = p.head
    headMat.color.set('#a09880').lerp(tmp.set('#fffbe0'), 0.5 + on * 0.5)
    brakeMat.color.set('#661414').lerp(tmp.set('#ff2a20'), clamp(p.brake + on * 0.3))
    const ph = t % 0.9 < 0.45
    amberA.color.set(ph ? '#ffb020' : '#503010')
    amberB.color.set(ph ? '#503010' : '#ffb020')
    glass.emissiveIntensity = on * 0.2
    spots.forEach((s) => (s.intensity = on * 900))
    beamMat.opacity = on * 0.16
    beam.visible = on > 0.02
  }

  /** Where the hood, exhaust and body are in the bus group, for effects. */
  const hood = new THREE.Vector3(...HOOD)
  const exhaust = new THREE.Vector3(...EXHAUST)
  return { group: g, setLook, update, hood, exhaust, wheels: wheels.map((w) => w.g), shell }
}
