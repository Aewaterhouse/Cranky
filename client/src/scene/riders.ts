import * as THREE from 'three'
import { cosmetic, type Look } from '../core/cosmetics'
import { BB, CRANK, makeBike } from './bike'
import { TRAINER_SKIN } from '../core/cosmetics'
import { bodyColour, bodyOf, defaultBody, type Body } from '../core/body'
import { SLOT } from './figure'
import { makeHat } from './hats'
import { buildBody, dimsOf, type Dims } from './riderBody'
import { buildHead } from './riderHead'
import type { Headwear } from './riderHair'
import { VIS } from './params'
import type { Particles } from './particles'
import { makeTag, TAG_H } from './riderTag'
import { FEEL } from './route/feelVis'
import type { RoadPose } from './route/riderPose'
import { clamp, lerp, rand, smooth, span } from './util'

const SHORTS = '#23252c'
const HOT = new THREE.Color('#ff2a1a')
const STEAM = new THREE.Color('#f4f6f8')
const WHITE = new THREE.Color('#ffffff')
const TANNED = new THREE.Color('#8a4a20')
/** How much darker the sun-side skin and how much paler the covered skin is with a cyclist's tan. */
const TAN = { dark: 0.38, pale: 0.3 }
const HEADWEAR = { up: 0.035, tilt: 0.15 }
const TORSO = 0.6
const SKULL = 0.23
const P = FEEL.rider

/** Two-bone IK in the (forward, up) plane; the joint bends counter-clockwise (knees and elbows forward/up). */
function ik(
  hf: number,
  hy: number,
  ff: number,
  fy: number,
  u: number,
  l: number,
): [number, number] {
  const dx = ff - hf
  const dy = fy - hy
  const d = clamp(Math.hypot(dx, dy), 0.05, u + l - 0.001)
  const a = Math.acos(clamp((u * u + d * d - l * l) / (2 * u * d), -1, 1))
  const base = Math.atan2(dy, dx) + a
  return [hf + Math.cos(base) * u, hy + Math.sin(base) * u]
}

const v = new THREE.Vector3()
const w = new THREE.Vector3()
const x = new THREE.Vector3()
const pt = (a: THREE.Vector3, px: number, f: number, y: number) => a.set(px, y, -f)

export type RiderMode = 'ride' | 'run' | 'slump'

/**
 * A rider figure on a bike (on a trainer unless `road`) with a canvas name tag. Local origin is the surface
 * under the bike.
 */
export function makeRider(colour: string, id: string, road = false) {
  const root = new THREE.Group()
  const bike = makeBike(colour, road)
  const person = new THREE.Group()
  root.add(bike.group, person)
  // The whole figure is two meshes sharing one material: the body (re-posed every frame) and the head.
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  const bodyMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat)
  const skull = new THREE.Mesh(new THREE.BufferGeometry(), mat)
  bodyMesh.castShadow = skull.castShadow = true
  const head = new THREE.Group()
  head.add(skull)
  person.add(bodyMesh, head)
  const { tag, label } = makeTag()
  person.add(tag)

  let body: Body = defaultBody(id)
  let d: Dims = dimsOf(body)
  let fig = buildBody(body)
  let face = buildHead(body, 'helmet')
  let wear: Headwear = 'helmet'
  let jersey = colour
  let hot = 0
  let painted = -1
  const pal = Array.from({ length: 10 }, () => new THREE.Color())
  /** Works the palette out (skin, tan, heat, outfit) and recolours both meshes. */
  const paint = () => {
    const skin = pal[SLOT.skin].set(bodyColour(body, 'skin'))
    pal[SLOT.pale].copy(skin)
    if (body.tan) {
      skin.lerp(TANNED, TAN.dark)
      pal[SLOT.pale].lerp(WHITE, TAN.pale)
    }
    skin.lerp(HOT, hot * 0.8)
    pal[SLOT.pale].lerp(HOT, hot * 0.8)
    pal[SLOT.jersey].set(jersey)
    pal[SLOT.shorts].set(SHORTS)
    pal[SLOT.shoe].set('#f2f2f2')
    pal[SLOT.hair].set(bodyColour(body, 'hairColour'))
    pal[SLOT.white].set('#f6f6f2')
    pal[SLOT.dark].set('#1a1a1a')
    pal[SLOT.iris].set(bodyColour(body, 'eyeColour'))
    pal[SLOT.red].set('#e3262a')
    fig.paint(pal)
    face.paint(pal)
    painted = hot
  }
  /** Builds the figure for the body and what is on the head. */
  const rebuild = (headOnly = false) => {
    if (!headOnly) {
      fig.geo.dispose()
      fig = buildBody(body)
      d = dimsOf(body)
    }
    face.geo.dispose()
    face = buildHead(body, wear)
    bodyMesh.geometry = fig.geo
    skull.geometry = face.geo
    head.scale.setScalar(d.head)
    root.scale.setScalar(d.height)
    paint()
  }

  const hp = new THREE.Vector3()
  /** Reddens the skin as effort climbs, and puffs steam off the head when the rider is cranking. */
  const heat = (hrp: number | null | undefined, dt: number, steam?: Particles, speed = 0) => {
    const e = hrp ?? 0
    hot += (smooth(VIS.heatFrom, 1, e) - hot) * clamp(dt * 2)
    if (Math.abs(hot - painted) > 0.01) paint()
    const k = clamp((e - VIS.steamFrom) / (1 - VIS.steamFrom))
    if (!steam || e < VIS.steamFrom || Math.random() > dt * (10 + k * 22)) return
    head.getWorldPosition(hp)
    hp.y += 0.3 * d.head * d.height
    steam.emit({
      p: hp,
      v: { x: rand(-0.4, 0.4), y: rand(1.4, 2.8), z: rand(0, 1) + speed * 0.15 },
      life: rand(0.7, 1.3),
      s0: 0.5,
      s1: 2 + k,
      c: STEAM,
      a: 0.75,
      drag: 0.96,
    })
  }

  let hatKey = ''
  let hat: THREE.Object3D | null = null
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: colour, flatShading: true }),
  )
  // Helmets and hats sit a little up and tipped back, clear of the eyebrows.
  const wearOn = new THREE.Group()
  wearOn.position.y = HEADWEAR.up
  wearOn.rotation.x = HEADWEAR.tilt
  wearOn.add(helmet)
  head.add(wearOn)
  let bare = false
  let bodyKey: string | undefined
  const setLook = (look: Look = {}) => {
    const key = `${look.hat}|${look.outfit}|${look.bike}|${look.body}`
    if (key === hatKey) return
    hatKey = key
    // The rider's own body travels in the look; without one they keep the default from their id.
    if (look.body !== bodyKey) {
      bodyKey = look.body
      body = bodyOf(id, look)
      rebuild()
    }
    jersey = cosmetic(look.outfit)?.colour ?? colour
    bike.skin(cosmetic(look.bike)?.colour, look.bike === TRAINER_SKIN)
    if (hat) wearOn.remove(hat)
    hat = makeHat(look.hat)
    if (hat) wearOn.add(hat)
    dress()
  }
  /** Hat, helmet or (in the creator) neither, and the hair that goes with it. */
  const dress = () => {
    helmet.visible = !hat && !bare
    wear = hat ? 'hat' : bare ? 'none' : 'helmet'
    rebuild(true)
  }
  /** Gives the rider this body. `noHelmet` (the creator) shows the hair when no hat is worn. */
  const setBody = (b: Body, noHelmet = bare) => {
    body = b
    bare = noHelmet
    rebuild()
    dress()
  }

  const fade = (o: number) => {
    for (const m of [mat, helmet.material as THREE.Material, bike.frameMat]) {
      m.transparent = o < 1
      m.opacity = o
    }
    if (hat) hat.visible = o > 0.5
  }

  /**
   * Poses the rider. `phase` is crank or stride angle in radians. On the road `rp` adds standing on the pedals
   * and rocking the bike, a tuck, and sitting up with both arms in the air.
   */
  const pose = (mode: RiderMode, phase: number, side = 0, rp?: RoadPose) => {
    const slump = mode === 'slump'
    const run = mode === 'run'
    const st = rp?.stand ?? 0
    const tk = rp?.tuck ?? 0
    const ch = rp?.cheer ?? 0
    const rock = Math.sin(phase) * P.rock * st
    bike.group.rotation.z = rock
    // Where a point at height `y` on the rocking bike has moved sideways to.
    const sway = (y: number) => -Math.sin(rock) * y
    const hipF = run ? 0 : -0.3 + P.standF * st
    const part = fig.parts
    const hipY = run ? 2 * d.leg + 0.08 : slump ? 0.98 : 1.05 + P.standUp * st
    const sat = lerp(lerp(P.lean, P.tuckLean, tk), P.cheerLean, ch)
    const lean = run ? 0.3 : slump ? 1.15 : sat
    const bob = run
      ? Math.abs(Math.sin(phase)) * 0.06
      : Math.sin(phase * 2) * (0.012 + P.standBob * st)
    const hy = hipY + bob
    const hx = sway(hy) * 0.5
    const sf = hipF + Math.sin(lean) * TORSO
    const sy = hy + Math.cos(lean) * TORSO
    pt(v, hx, hipF, hy)
    const torso = part.torso.o
    part.hips.o.position.copy(v)
    torso.position.copy(v)
    torso.rotation.x = -lean
    torso.rotation.z = run ? 0 : Math.sin(phase) * 0.06 - rock * 0.5
    head.position.set(hx, sy + d.headUp - (slump ? 0.1 : 0), -sf - (slump ? 0.15 : 0.1))
    span(part.neck.o, pt(v, hx, sf, sy - 0.04), head.position)
    head.rotation.x = slump ? -0.7 : run ? 0 : 0.05 + 0.4 * tk
    bike.spin(slump ? 0.5 : phase)
    for (const i of [0, 1]) {
      const s = i ? 1 : -1
      const ph = phase + i * Math.PI
      let ff: number, fy: number
      if (run) {
        ff = hipF + Math.sin(ph) * 0.45
        fy = 0.04 + Math.max(0, Math.cos(ph)) * 0.32
      } else {
        ff = BB.f + Math.cos(ph) * CRANK
        fy = BB.y + Math.sin(ph) * CRANK + 0.07
      }
      if (slump) {
        ff = BB.f + Math.cos(i * Math.PI) * CRANK
        fy = BB.y + Math.sin(i * Math.PI) * CRANK + 0.07
      }
      const px = s * d.hip
      const fx = px + sway(fy)
      const [kf, ky] = ik(hipF, hy, ff, fy, d.leg, d.leg)
      pt(v, px + hx, hipF, hy)
      pt(w, px * 1.2 + (hx + sway(fy)) / 2, kf, ky)
      span(part[`thigh${i}`].o, v, w)
      pt(x, fx, ff, fy)
      span(part[`shin${i}`].o, w, x)
      part[`shoe${i}`].o.position.set(fx, fy - 0.02, -ff - 0.04)
      // arms
      const sx = s * d.shoulder + hx
      let hf: number, hyy: number
      let handX = s * 0.19
      if (run) {
        hf = sf + Math.sin(ph + Math.PI) * 0.4
        hyy = sy - 0.45 + Math.max(0, Math.cos(ph + Math.PI)) * 0.25 + 0.1
      } else if (slump) {
        hf = sf + 0.05
        hyy = sy - 0.62
      } else {
        // On the bars, or up in the air for a celebration.
        hf = lerp(0.5, sf + 0.06, ch)
        hyy = lerp(0.95, sy + P.cheerUp, ch)
        handX = lerp(s * 0.19 + sway(0.95), s * P.cheerWide, ch)
      }
      const [ef, ey] = ik(sf, sy - 0.05, hf, hyy, d.arm, d.arm)
      pt(v, sx, sf, sy - 0.05)
      pt(w, lerp(sx * 1.15, (sx + handX) / 2, ch), ef, ey)
      span(part[`upper${i}`].o, v, w)
      pt(x, handX, hf, hyy)
      span(part[`fore${i}`].o, w, x)
      part[`hand${i}`].o.position.copy(x)
    }
    tag.position.set(
      side * 0.9,
      sy + d.headUp + SKULL * d.head + 0.33 + (0.35 * (TAG_H - 80)) / 80,
      -sf,
    )
    fig.write()
  }
  rebuild()
  return { root, person, head, bike, label, setLook, setBody, fade, pose, heat, tag }
}
