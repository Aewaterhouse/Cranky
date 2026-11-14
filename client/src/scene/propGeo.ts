import { Mesher, box, cyl, cone, ico } from './util'
import * as THREE from 'three'

type V3 = [number, number, number]
const wheel = (m: Mesher, x: number, y: number, z: number, r = 0.36) => {
  m.add(cyl(r, r, 0.26, 8), '#1c1c1e', [x, y, z], [0, 0, Math.PI / 2])
  m.add(cyl(r * 0.5, r * 0.5, 0.3, 6), '#9a9a9a', [x, y, z], [0, 0, Math.PI / 2])
}

/** Wreck or abandoned vehicle. Body is white so instanceColor / material colour tints the paint. */
export function vehicle(kind: 'sedan' | 'ute' | 'van' | 'truck') {
  const m = new Mesher(0.12)
  const dark = '#222831'
  if (kind === 'van' || kind === 'truck') {
    const h = kind === 'van' ? 1.7 : 2.4
    const l = kind === 'van' ? 4.6 : 6.6
    m.add(box(2, h, l), '#fff', [0, 0.45 + h / 2, 0])
    m.add(box(2.05, 0.5, 1.1), dark, [0, 0.45 + h * 0.62, -l / 2 + 0.55])
    m.add(box(2.1, 0.25, l), '#cfcfcf', [0, 0.45 + h * 0.3, 0])
    m.add(box(2.1, 0.3, 0.3), '#333', [0, 0.5, -l / 2 - 0.1])
    for (const z of kind === 'van' ? [-1.5, 1.4] : [-2.4, 1.6, 2.7])
      for (const x of [-1, 1]) wheel(m, x, 0.42, z, 0.44)
  } else {
    const l = 4.3
    m.add(box(1.9, 0.62, l), '#fff', [0, 0.62, 0])
    if (kind === 'sedan') {
      m.add(box(1.7, 0.6, 2.1), '#fff', [0, 1.2, 0.1])
      m.add(box(1.76, 0.36, 1.86), dark, [0, 1.26, 0.1])
      m.add(box(1.5, 0.36, 2.16), dark, [0, 1.26, 0.1])
      m.add(box(1.74, 0.08, 2.1), '#fff', [0, 1.54, 0.1])
    } else {
      m.add(box(1.8, 0.7, 1.6), '#fff', [0, 1.25, -0.9])
      m.add(box(1.84, 0.38, 1.3), dark, [0, 1.3, -0.9])
      m.add(box(1.8, 0.08, 1.7), '#fff', [0, 1.62, -0.9])
      m.add(box(1.8, 0.4, 0.08), '#fff', [0, 1.1, 1.9])
      for (const x of [-0.9, 0.9]) m.add(box(0.08, 0.4, 1.9), '#fff', [x, 1.1, 1.0])
    }
    m.add(box(1.9, 0.18, 0.2), '#2a2a2a', [0, 0.45, -l / 2])
    m.add(box(1.9, 0.18, 0.2), '#2a2a2a', [0, 0.45, l / 2])
    for (const z of [-1.4, 1.4]) for (const x of [-0.95, 0.95]) wheel(m, x, 0.36, z)
  }
  const l = kind === 'van' ? 4.6 : kind === 'truck' ? 6.6 : 4.3
  for (const x of [-0.7, 0.7]) {
    m.add(box(0.3, 0.14, 0.06), '#ffeeaa', [x, 0.7, -l / 2 - 0.02])
    m.add(box(0.3, 0.14, 0.06), '#aa2222', [x, 0.7, l / 2 + 0.02])
  }
  return m.build()
}

function tree(kind: 'live' | 'pine' | 'dead' | 'bush') {
  const m = new Mesher(0.16)
  if (kind === 'live') {
    m.add(cyl(0.22, 0.38, 2.4, 6), '#6b4a30', [0, 1.2, 0])
    m.add(ico(1.7), '#3f7a3a', [0, 3.2, 0], [0, 0, 0], [1, 0.85, 1])
    m.add(ico(1.3), '#58a048', [0.5, 4.3, 0.2], [0.3, 0, 0], [1, 0.9, 1])
    m.add(ico(1.0), '#72b856', [-0.5, 4.9, -0.2])
  } else if (kind === 'pine') {
    m.add(cyl(0.2, 0.3, 1.6, 5), '#5a3e2a', [0, 0.8, 0])
    for (let i = 0; i < 4; i++)
      m.add(cone(2 - i * 0.4, 2.2, 6), i % 2 ? '#2e6a40' : '#255a36', [0, 2.2 + i * 1.3, 0])
  } else if (kind === 'dead') {
    m.add(cyl(0.12, 0.34, 4.5, 5), '#5a4d44', [0, 2.2, 0])
    for (let i = 0; i < 5; i++) {
      const s = i % 2 ? 1 : -1
      m.add(
        cyl(0.04, 0.12, 1.8 - i * 0.2, 4),
        '#4e433b',
        [s * 0.5, 2.2 + i * 0.5, 0.1 * s],
        [0, i, s * 0.9],
      )
    }
  } else {
    m.add(ico(0.8), '#4a7a38', [0, 0.45, 0], [0, 0, 0], [1.2, 0.8, 1])
    m.add(ico(0.55), '#5f9244', [0.7, 0.35, 0.3])
    m.add(ico(0.5), '#3e6a30', [-0.6, 0.3, -0.3])
  }
  return m.build()
}

function pole(spacing: number) {
  const m = new Mesher(0.1)
  m.add(cyl(0.14, 0.2, 9, 5), '#6a5238', [0, 4.5, 0])
  m.add(box(3.2, 0.18, 0.18), '#5a4630', [0, 8.5, 0])
  m.add(box(2.4, 0.14, 0.14), '#5a4630', [0, 7.5, 0], [0, 0, 0])
  for (const x of [-1.4, 0, 1.4]) {
    m.add(cyl(0.08, 0.08, 0.3, 5), '#cfcfd8', [x, 8.7, 0])
    const segs = 6
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * spacing
      const b = ((i + 1) / segs) * spacing
      const sag = (t: number) => 8.7 - 1.0 * (1 - Math.pow(2 * (t / spacing) - 1, 2))
      const len = Math.hypot(b - a, sag(b) - sag(a))
      m.add(
        box(0.04, 0.04, len),
        '#18181c',
        [x, (sag(a) + sag(b)) / 2, -(a + b) / 2],
        [Math.atan2(sag(b) - sag(a), b - a), 0, 0],
      )
    }
  }
  return m.build()
}

function pylon() {
  const m = new Mesher(0.08)
  const c = '#8d949c'
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const top: V3 = [sx * 0.9, 38, sz * 0.9]
    const bot: V3 = [sx * 4, 0, sz * 4]
    const len = Math.hypot(top[0] - bot[0], top[1], top[2] - bot[2])
    m.add(
      box(0.35, len, 0.35),
      c,
      [(top[0] + bot[0]) / 2, 19, (top[2] + bot[2]) / 2],
      [Math.atan2(top[2] - bot[2], 38) * -1, 0, Math.atan2(top[0] - bot[0], 38) * -1],
    )
  }
  for (let y = 6; y < 36; y += 7) {
    const w = 4 - y * 0.085
    m.add(box(w * 2, 0.25, 0.25), c, [0, y, w], [0, 0, 0.0])
    m.add(box(w * 2, 0.25, 0.25), c, [0, y, -w])
    m.add(box(0.25, 0.25, w * 2), c, [w, y, 0])
    m.add(box(0.25, 0.25, w * 2), c, [-w, y, 0])
  }
  for (const y of [33, 38]) m.add(box(16, 0.4, 0.4), c, [0, y, 0])
  for (const x of [-7.5, 7.5])
    for (const y of [33, 38]) m.add(cyl(0.12, 0.12, 1.4, 5), '#d8d8e0', [x, y - 0.8, 0])
  return m.build()
}

function ruin() {
  const m = new Mesher(0.14)
  const w = 7
  m.add(box(w, 4.5, 0.5), '#9a9488', [0, 2.25, 0])
  m.add(box(2, 3, 0.5), '#8a8478', [w / 2 - 1, 5.2, 0], [0, 0, 0.12])
  m.add(box(2.6, 1.3, 0.5), '#9a9488', [-w / 2 + 1.3, 5.1, 0], [0, 0, -0.08])
  for (const x of [-2, 0.3, 2.4]) m.add(box(1.1, 1.4, 0.6), '#1a1c22', [x, 2.6, 0])
  m.add(box(0.5, 3, 5), '#8d8a80', [-w / 2, 1.5, 2.5])
  m.add(box(1.2, 0.6, 1), '#a05a44', [1.5, 0.3, 2], [0.1, 0.5, 0])
  m.add(box(0.8, 0.5, 1.4), '#b86a50', [2.6, 0.25, 3.1], [0, 0.9, 0.1])
  return m.build()
}

function sign(kind: 'warn' | 'green' | 'stop' | 'roo' | 'wombat') {
  const m = new Mesher(0.05)
  m.add(cyl(0.06, 0.06, 3.2, 5), '#999', [0, 1.6, 0])
  if (kind === 'warn') {
    m.add(box(1.5, 1.5, 0.08), '#f0c820', [0, 3.5, 0.06], [0, 0, Math.PI / 4])
    m.add(box(0.2, 0.9, 0.1), '#222', [0, 3.5, 0.1])
  } else if (kind === 'roo' || kind === 'wombat') {
    m.add(box(1.5, 1.5, 0.08), '#f0c820', [0, 3.5, 0.06], [0, 0, Math.PI / 4])
    const k = '#1b1b1b'
    const parts: [number, number, number, number, number][] =
      kind === 'roo'
        ? [
            [0.5, 0.28, 0.02, 3.45, 0.7],
            [0.2, 0.14, 0.3, 3.78, 0.2],
            [0.05, 0.14, 0.27, 3.9, 0.3],
            [0.6, 0.07, -0.36, 3.15, -0.35],
            [0.4, 0.08, 0.08, 3.12, 0],
          ]
        : [
            [0.75, 0.36, -0.05, 3.42, 0],
            [0.26, 0.24, 0.38, 3.4, -0.2],
            [0.1, 0.18, -0.3, 3.18, 0],
            [0.1, 0.18, 0.2, 3.18, 0],
          ]
    for (const [w, h, x, y, r] of parts) m.add(box(w, h, 0.1), k, [x, y, 0.1], [0, 0, r])
  } else if (kind === 'green') {
    m.add(box(2.6, 1.1, 0.08), '#1f7a4a', [0, 3.3, 0.06])
    m.add(box(2.2, 0.12, 0.1), '#eee', [0, 3.4, 0.1])
    m.add(box(1.4, 0.12, 0.1), '#eee', [-0.4, 3.1, 0.1])
  } else {
    m.add(cyl(0.75, 0.75, 0.08, 8), '#c82020', [0, 3.4, 0.06], [Math.PI / 2, Math.PI / 8, 0])
    m.add(box(1, 0.2, 0.1), '#eee', [0, 3.4, 0.1])
  }
  return m.build()
}

function fence() {
  const m = new Mesher(0.14)
  for (const x of [-2, 0, 2]) m.add(box(0.14, 1.3, 0.14), '#7b6648', [x, 0.65, 0], [0, 0, x * 0.02])
  for (const y of [0.55, 1.0])
    m.add(box(4.1, 0.1, 0.06), '#8d7a5a', [0, y, 0.05], [0, 0, y > 0.8 ? 0.04 : -0.02])
  return m.build()
}

function junk() {
  const m = new Mesher(0.12)
  for (const [x, z, c] of [
    [0, 0, '#c0392b'],
    [0.9, 0.3, '#2f6fb0'],
    [0.3, 1.0, '#7a8a50'],
  ] as [number, number, string][]) {
    m.add(cyl(0.38, 0.38, 1, 8), c, [x, 0.5, z])
    m.add(cyl(0.4, 0.4, 0.08, 8), '#222', [x, 0.7, z])
  }
  for (let i = 0; i < 3; i++)
    m.add(new THREE.TorusGeometry(0.4, 0.17, 5, 8).rotateX(Math.PI / 2), '#1d1d20', [
      -1.2,
      0.17 + i * 0.34,
      0.1,
    ])
  return m.build()
}

export const makeGeos = (poleSpacing: number) => ({
  live: tree('live'),
  pine: tree('pine'),
  dead: tree('dead'),
  bush: tree('bush'),
  rock: new Mesher(0.2)
    .add(ico(1.1), '#8a8a86', [0, 0.35, 0], [0.3, 0.5, 0], [1.3, 0.8, 1])
    .add(ico(0.6), '#7a7a78', [1.1, 0.15, 0.3])
    .build(),
  pole: pole(poleSpacing),
  pylon: pylon(),
  ruin: ruin(),
  warn: sign('warn'),
  green: sign('green'),
  stop: sign('stop'),
  roo: sign('roo'),
  wombat: sign('wombat'),
  fence: fence(),
  junk: junk(),
  sedan: vehicle('sedan'),
  ute: vehicle('ute'),
  van: vehicle('van'),
})
export type Geos = ReturnType<typeof makeGeos>
