import * as THREE from 'three'
import { cosmetic, type Look } from '../core/cosmetics'
import { BB, CRANK, makeBike } from './bike'
import { makeHat } from './hats'
import { VIS } from './params'
import type { Particles } from './particles'
import { box, clamp, ico, rand, smooth, span } from './util'

const SKINS = ['#f0c8a0', '#d9a577', '#b07a50', '#7a4e32', '#f3d2b8', '#e0b088']
const SHORTS = '#23252c'
const HOT = new THREE.Color('#ff2a1a')
const STEAM = new THREE.Color('#f4f6f8')
/** Tag colour by heart-rate zone (under 60, 70, 80, 90% of max, then over). */
const HR_COLS = ['#9aa7b8', '#5aa9e6', '#6cff7a', '#ffd24a', '#ff5a4a']
const TAG_H = 132
const THIGH = 0.46
const SHIN = 0.46
const ARM = 0.32

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
export function makeRider(colour: string, seed: number, road = false) {
  const root = new THREE.Group()
  const bike = makeBike(colour, road)
  const person = new THREE.Group()
  root.add(bike.group, person)
  const mats = {
    jersey: new THREE.MeshLambertMaterial({ color: colour, flatShading: true }),
    skin: new THREE.MeshLambertMaterial({ color: SKINS[seed % SKINS.length], flatShading: true }),
    shorts: new THREE.MeshLambertMaterial({ color: SHORTS, flatShading: true }),
    shoe: new THREE.MeshLambertMaterial({ color: '#f2f2f2', flatShading: true }),
  }
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, shadow = false) => {
    const o = new THREE.Mesh(geo, m)
    o.castShadow = shadow
    person.add(o)
    return o
  }
  const limb = (m: THREE.Material, t = 0.13, shadow = false) => mesh(box(t, t, 1), m, shadow)
  const thigh = [limb(mats.shorts, 0.17, true), limb(mats.shorts, 0.17, true)]
  const shin = [limb(mats.skin, 0.12), limb(mats.skin, 0.12)]
  const upper = [limb(mats.jersey, 0.13), limb(mats.jersey, 0.13)]
  const fore = [limb(mats.skin, 0.1), limb(mats.skin, 0.1)]
  const shoes = [mesh(box(0.11, 0.09, 0.26), mats.shoe), mesh(box(0.11, 0.09, 0.26), mats.shoe)]
  const torso = mesh(
    new THREE.CylinderGeometry(0.26, 0.2, 0.62, 6).translate(0, 0.31, 0).scale(1, 1, 0.7),
    mats.jersey,
    true,
  )
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(ico(VIS.bust, 1), mats.jersey)
    b.position.set(s * 0.13, 0.4, -0.2)
    torso.add(b)
  }
  const hips = mesh(box(0.34, 0.2, 0.26), mats.shorts)
  const head = new THREE.Group()
  const skull = new THREE.Mesh(ico(0.23, 1), mats.skin)
  skull.castShadow = true
  head.add(skull)
  const eyeM = new THREE.MeshBasicMaterial({ color: '#1a1a1a' })
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(box(0.05, 0.06, 0.03), eyeM)
    e.position.set(s * 0.09, 0.03, -0.225)
    head.add(e)
  }
  const nose = new THREE.Mesh(box(0.05, 0.06, 0.06), mats.skin)
  nose.position.set(0, -0.03, -0.255)
  head.add(nose)
  person.add(head)

  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = TAG_H
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const tag = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  )
  tag.scale.set(2.8, (2.8 * TAG_H) / 320, 1)
  tag.renderOrder = 10
  person.add(tag)
  let lastTag = ''
  /** Name pill, with a heart-rate chip above it when the rider has a strap: bpm and % of max. */
  const label = (
    name: string,
    c: number | null,
    state: string,
    hr?: number | null,
    hrp?: number | null,
  ) => {
    const col = c == null ? '#cfcfcf' : c > 0.85 ? '#6cff7a' : c > 0.6 ? '#ffd24a' : '#ff5a4a'
    const beat = hr ? `♥ ${hr}${hrp ? `  ${Math.round(hrp * 100)}%` : ''}` : ''
    const key = name + col + state + beat
    if (key === lastTag) return
    lastTag = key
    const g = canvas.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, 320, TAG_H)
    g.font = '700 34px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (beat) {
      const w = g.measureText(beat).width + 36
      g.fillStyle = 'rgba(14,12,22,0.78)'
      g.beginPath()
      g.roundRect(160 - w / 2, 4, w, 46, 18)
      g.fill()
      g.fillStyle = hrp ? HR_COLS[[0.6, 0.7, 0.8, 0.9].filter((f) => hrp >= f).length] : '#ffffff'
      g.fillText(beat, 160, 29)
    }
    g.translate(0, TAG_H - 80)
    g.fillStyle = 'rgba(14,12,22,0.78)'
    g.beginPath()
    g.roundRect(6, 12, 308, 56, 22)
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = state === 'riding' ? col : '#888'
    g.stroke()
    g.fillStyle = '#fff'
    g.fillText((state === 'fell' ? '! ' : '') + name.slice(0, 12), 160, 42)
    g.fillStyle = col
    g.beginPath()
    g.arc(30, 40, 9, 0, 7)
    g.fill()
    tex.needsUpdate = true
  }

  const skin0 = mats.skin.color.clone()
  let hot = 0
  const hp = new THREE.Vector3()
  /** Reddens the skin as effort climbs, and puffs steam off the head when the rider is cranking. */
  const heat = (hrp: number | null | undefined, dt: number, steam?: Particles, speed = 0) => {
    const e = hrp ?? 0
    hot += (smooth(VIS.heatFrom, 1, e) - hot) * clamp(dt * 2)
    mats.skin.color.copy(skin0).lerp(HOT, hot * 0.8)
    const k = clamp((e - VIS.steamFrom) / (1 - VIS.steamFrom))
    if (!steam || e < VIS.steamFrom || Math.random() > dt * (10 + k * 22)) return
    head.getWorldPosition(hp)
    hp.y += 0.3
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
  head.add(helmet)
  const setLook = (look: Look = {}) => {
    const key = `${look.hat}|${look.outfit}`
    if (key === hatKey) return
    hatKey = key
    mats.jersey.color.set(cosmetic(look.outfit)?.colour ?? colour)
    if (hat) head.remove(hat)
    hat = makeHat(look.hat)
    if (hat) head.add(hat)
    helmet.visible = !hat
  }

  const fade = (o: number) => {
    for (const m of [
      ...Object.values(mats),
      eyeM,
      helmet.material as THREE.Material,
      bike.frameMat,
    ]) {
      m.transparent = o < 1
      m.opacity = o
    }
    if (hat) hat.visible = o > 0.5
  }

  /** Poses the rider. `phase` is crank or stride angle in radians. */
  const pose = (mode: RiderMode, phase: number, side = 0) => {
    const slump = mode === 'slump'
    const run = mode === 'run'
    const hipF = run ? 0 : -0.3
    const hipY = run ? 1.0 : slump ? 0.98 : 1.05
    const lean = run ? 0.3 : slump ? 1.15 : 0.75
    const bob = run ? Math.abs(Math.sin(phase)) * 0.06 : Math.sin(phase * 2) * 0.012
    const hy = hipY + bob
    const sf = hipF + Math.sin(lean) * 0.6
    const sy = hy + Math.cos(lean) * 0.6
    pt(v, 0, hipF, hy)
    hips.position.copy(v)
    torso.position.copy(v)
    torso.rotation.x = -lean
    torso.rotation.z = run ? 0 : Math.sin(phase) * 0.06
    pt(w, 0, sf, sy)
    head.position.set(0, sy + 0.34 - (slump ? 0.1 : 0), -sf - (slump ? 0.15 : 0.1))
    head.rotation.x = slump ? -0.7 : run ? 0 : 0.05
    bike.spin(slump ? 0.5 : phase)
    for (const i of [0, 1]) {
      const s = i ? 1 : -1
      const ph = phase + i * Math.PI
      let ff: number, fy: number
      if (run) {
        ff = hipF + Math.sin(ph) * 0.45
        fy = hy - 0.96 + Math.max(0, Math.cos(ph)) * 0.32
      } else {
        ff = BB.f + Math.cos(ph) * CRANK
        fy = BB.y + Math.sin(ph) * CRANK + 0.07
      }
      if (slump) {
        ff = BB.f + Math.cos(i * Math.PI) * CRANK
        fy = BB.y + Math.sin(i * Math.PI) * CRANK + 0.07
      }
      const px = s * 0.12
      const [kf, ky] = ik(hipF, hy, ff, fy, THIGH, SHIN)
      pt(v, px, hipF, hy)
      pt(w, px * 1.2, kf, ky)
      span(thigh[i], v, w)
      pt(x, px, ff, fy)
      span(shin[i], w, x)
      shoes[i].position.set(px, fy - 0.02, -ff - 0.04)
      // arms
      const sx = s * 0.26
      let hf: number, hyy: number
      if (run) {
        hf = sf + Math.sin(ph + Math.PI) * 0.4
        hyy = sy - 0.45 + Math.max(0, Math.cos(ph + Math.PI)) * 0.25 + 0.1
      } else if (slump) {
        hf = sf + 0.05
        hyy = sy - 0.62
      } else {
        hf = 0.5
        hyy = 0.95
      }
      const [ef, ey] = ik(sf, sy - 0.05, hf, hyy, ARM, ARM)
      pt(v, sx, sf, sy - 0.05)
      pt(w, sx * 1.15, ef, ey)
      span(upper[i], v, w)
      pt(x, s * 0.19, hf, hyy)
      span(fore[i], w, x)
    }
    tag.position.set(side * 0.9, sy + 0.9 + (0.35 * (TAG_H - 80)) / 80, -sf)
  }
  return { root, person, bike, label, setLook, fade, pose, heat, tag }
}
