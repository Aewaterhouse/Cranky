import * as THREE from 'three'
import type { makeBus } from './bus'
import type { Particles } from './particles'
import { clamp, rand } from './util'

const col = new THREE.Color()
const tmp = new THREE.Vector3()

/** Exhaust, engine damage smoke and fire, and tyre dust for the bus. */
export function busEmitters(
  smoke: Particles,
  sparks: Particles,
  dt: number,
  s: { speed: number; armour: number | null },
  bus: ReturnType<typeof makeBus>,
  fog: THREE.Color,
) {
  const armour = s.armour ?? 100
  const sp = clamp(s.speed / 12)
  const y = bus.group.position.y
  if (Math.random() < dt * (14 + sp * 20)) {
    tmp.copy(bus.exhaust).add(bus.group.position)
    smoke.emit({
      p: tmp,
      v: { x: rand(-0.3, 0.3), y: rand(0.5, 1.1), z: rand(1, 2.5) + s.speed * 0.2 },
      life: rand(0.8, 1.5),
      s0: 0.3,
      s1: 1.3,
      c: col.set('#8a8a90').lerp(fog, 0.3),
      a: 0.35,
      drag: 0.97,
    })
  }
  if (armour < 45 && Math.random() < dt * (10 + (45 - armour) * 0.8)) {
    const dark = armour < 20
    smoke.emit({
      p: { x: rand(-0.6, 0.6), y: 2.2 + y, z: -4.7 },
      v: { x: rand(-0.4, 0.4), y: rand(2, 3.4), z: rand(1, 3) + s.speed * 0.3 },
      life: rand(1, 2),
      s0: 0.6,
      s1: dark ? 3.2 : 2.2,
      c: col.set(dark ? '#1c1a1a' : '#66666a'),
      a: dark ? 0.7 : 0.45,
      drag: 0.97,
    })
  }
  if (armour < 14 && Math.random() < dt * 40)
    sparks.emit({
      p: { x: rand(-0.5, 0.5), y: 2.1 + y, z: -4.8 },
      v: { x: rand(-1, 1), y: rand(2, 5), z: rand(0, 3) },
      life: rand(0.3, 0.7),
      s0: 0.45,
      s1: 0.1,
      c: col.set('#ff7a20'),
      a: 1,
      g: 6,
    })
  if (sp > 0.2 && Math.random() < dt * 30 * sp)
    smoke.emit({
      p: { x: Math.random() < 0.5 ? -1.8 : 1.8, y: 0.15, z: 3.0 },
      v: { x: rand(-1, 1), y: rand(0.3, 1), z: rand(2, 5) },
      life: rand(0.5, 1),
      s0: 0.5,
      s1: 1.8,
      c: col.set('#a09078').lerp(fog, 0.4),
      a: 0.22,
      drag: 0.95,
    })
}

/** Dust kicked up by the horde's feet. */
export function hordeDust(
  smoke: Particles,
  feet: { x: number; z: number }[],
  hordeZ: number,
  fog: THREE.Color,
) {
  for (const d of feet)
    if (Math.random() < 0.22)
      smoke.emit({
        p: { x: d.x + rand(-0.3, 0.3), y: 0.2, z: hordeZ + d.z },
        v: { x: rand(-0.5, 0.5), y: rand(0.4, 1.2), z: rand(-1, 1) },
        life: rand(0.8, 1.6),
        s0: 0.8,
        s1: 3,
        c: col.set('#a08a68').lerp(fog, 0.4),
        a: 0.28,
        drag: 0.96,
      })
}

/** Sparks and a dust cloud where the roadblock pieces were. */
export function smashBurst(sparks: Particles, smoke: Particles, at: THREE.Vector3[]) {
  col.set('#ffb040')
  for (const p of at)
    for (let i = 0; i < 4; i++)
      sparks.emit({
        p,
        v: { x: rand(-9, 9), y: rand(2, 12), z: rand(-4, 14) },
        life: rand(0.5, 1.2),
        s0: rand(0.4, 0.9),
        s1: 0.1,
        c: col,
        a: 1,
        g: 14,
      })
  col.set('#5a5048')
  for (let i = 0; i < 40; i++)
    smoke.emit({
      p: { x: rand(-5, 5), y: rand(0.5, 2), z: -8 },
      v: { x: rand(-3, 3), y: rand(1, 5), z: rand(0, 6) },
      life: rand(1, 2.2),
      s0: 3,
      s1: 9,
      c: col,
      a: 0.6,
      drag: 0.97,
    })
}
