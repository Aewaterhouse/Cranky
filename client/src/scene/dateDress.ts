import * as THREE from 'three'
import { DATE as D } from './dateVis'
import { groundH } from './ground'
import { LOOP, Scatter } from './props'
import { Mesher, VC, box, canvasTex, cone, cyl, ico } from './util'

const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true })

/** One pole and the sagging string of bulbs to the next one (towards -z), unlit so it glows at dusk. */
function lightSpan() {
  const m = new Mesher(0.05)
  m.add(box(0.12, D.poleH, 0.12), '#3a2c26', [0, D.poleH / 2, 0])
  const y = (u: number) => D.poleH - 0.15 - D.sag * 4 * u * (1 - u)
  const segs = 4
  for (let i = 0; i < segs; i++) {
    const [u0, u1] = [i / segs, (i + 1) / segs]
    const [z0, z1] = [-u0 * D.span, -u1 * D.span]
    const tilt = Math.atan2(y(u0) - y(u1), D.span / segs)
    m.add(
      box(0.03, 0.03, D.span / segs),
      '#2a2028',
      [0, (y(u0) + y(u1)) / 2, (z0 + z1) / 2],
      [-tilt, 0, 0],
    )
  }
  for (let i = 0; i < D.bulbs; i++) {
    const u = (i + 0.5) / D.bulbs
    m.add(new THREE.OctahedronGeometry(D.bulb), D.bulbCols[i % D.bulbCols.length], [
      0,
      y(u) - 0.09,
      -u * D.span,
    ])
  }
  return m.build()
}

/** Three heart balloons on strings from the top of a pole. */
function balloons() {
  const m = new Mesher(0.08)
  const tops: [number, number, number, string][] = [
    [0.35, 3.9, 0.1, D.balloonCols[0]],
    [-0.3, 3.6, -0.25, D.balloonCols[1]],
    [0.05, 4.3, -0.4, D.balloonCols[2]],
  ]
  for (const [x, y, z, c] of tops) {
    for (const s of [-1, 1]) m.add(ico(0.26), c, [x + s * 0.17, y + 0.08, z])
    m.add(cone(0.38, 0.5, 6), c, [x, y - 0.24, z], [Math.PI, 0, 0])
    const len = y - 0.5 - D.poleH
    m.add(
      box(0.015, len, 0.015),
      '#f4f0f0',
      [x / 2, D.poleH + len / 2, z / 2],
      [z * 0.3, 0, -x * 0.3],
    )
  }
  return m.build()
}

const neonText = (lines: [string, string][], w = 512, h = 256) =>
  canvasTex(w, h, (c) => {
    c.fillStyle = '#1a1024'
    c.fillRect(0, 0, w, h)
    c.textAlign = 'center'
    lines.forEach(([t, col], i) => {
      c.font = `900 ${i ? 46 : 92}px system-ui, sans-serif`
      c.shadowColor = col
      c.shadowBlur = 24
      c.fillStyle = col
      for (let k = 0; k < 2; k++) c.fillText(t, w / 2, i ? 100 + i * 64 : 104, w - 30)
      c.shadowBlur = 0
      c.fillStyle = '#fff'
      c.fillText(t, w / 2, i ? 100 + i * 64 : 104, w - 30)
    })
  })

const plane = (w: number, h: number, map: THREE.Texture, pos: [number, number, number]) => {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }))
  p.position.set(...pos)
  return p
}

/** A milk bar with striped awning, lit windows and a neon sign; its front (+z) faces the road. */
function milkBar() {
  const g = new THREE.Group()
  const m = new Mesher(0.06)
  m.add(box(11, 4.4, 7), '#f3e6c8', [0, 2.2, 0])
  m.add(box(11.4, 0.6, 7.4), '#e0567f', [0, 4.6, 0])
  for (let i = 0; i < 8; i++)
    m.add(
      box(1.375, 0.12, 2.2),
      i % 2 ? '#ffffff' : '#e0567f',
      [-4.8 + i * 1.375, 3.3, 4.4],
      [0.35, 0, 0],
    )
  m.add(box(1.4, 1.2, 0.8), '#d02a2a', [4.4, 0.6, 4.6])
  // A giant thickshake on the roof, two straws in.
  m.add(cyl(1.3, 0.9, 2.8, 8), '#ff9cc2', [4.2, 6.3, 0])
  m.add(cyl(1.35, 1.35, 0.5, 8), '#fff3f6', [4.2, 7.9, 0])
  for (const s of [-1, 1])
    m.add(
      cyl(0.1, 0.1, 2.4, 5),
      s < 0 ? '#d02a2a' : '#2f7fc4',
      [4.2 + s * 0.4, 8.9, 0],
      [0, 0, s * 0.3],
    )
  g.add(new THREE.Mesh(m.build(), VC))
  const win = new Mesher(0)
  for (const x of [-3.2, 2.6]) win.add(box(3.4, 2, 0.1), '#ffe2a0', [x, 1.6, 3.52])
  win.add(box(1.4, 2.4, 0.1), '#ffd080', [-0.4, 1.2, 3.52])
  g.add(new THREE.Mesh(win.build(), GLOW))
  g.add(
    plane(
      9,
      3.6,
      neonText([
        ['MILK BAR', D.neon],
        ['THICKSHAKES · 2 STRAWS', D.neon2],
      ]),
      [-1.4, 7, 1.5],
    ),
  )
  return g
}

/** A drive-in screen showing tonight's feature, with a heart-shaped speaker post or two. */
function driveIn() {
  const g = new THREE.Group()
  const m = new Mesher(0.06)
  m.add(box(17, 9, 0.5), '#e8e2da', [0, 8, -0.4])
  for (const x of [-6, 0, 6]) m.add(box(0.5, 4, 0.5), '#6a6470', [x, 2, -0.8])
  for (const x of [-5, -1.5, 2, 5.5]) {
    m.add(box(0.12, 1.1, 0.12), '#6a6470', [x, 0.55, 6])
    m.add(box(0.35, 0.3, 0.2), D.neon, [x, 1.2, 6])
  }
  g.add(new THREE.Mesh(m.build(), VC))
  const film = canvasTex(512, 256, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 256)
    sky.addColorStop(0, '#ff7aa8')
    sky.addColorStop(1, '#ffd27a')
    c.fillStyle = sky
    c.fillRect(0, 0, 512, 256)
    c.fillStyle = '#2a1830'
    c.beginPath()
    c.arc(220, 190, 26, 0, 7)
    c.arc(292, 190, 26, 0, 7)
    c.fill()
    c.fillRect(196, 210, 48, 46)
    c.fillRect(268, 210, 48, 46)
    c.font = '900 64px system-ui, sans-serif'
    c.textAlign = 'center'
    c.fillText('♥', 256, 160)
    c.font = '900 34px system-ui, sans-serif'
    c.fillText('28 DATES LATER', 256, 60)
  })
  g.add(plane(16, 8, film, [0, 8, -0.1]))
  g.add(
    plane(
      6,
      2.4,
      neonText([
        ['DRIVE-IN', D.neon2],
        ['TONIGHT · 2 FOR 1', D.neon],
      ]),
      [10.5, 3.2, 0],
    ),
  )
  return g
}

/**
 * Speed Dating's own dressing on the bus road: fairy lights strung along both sides, heart balloons on every few
 * poles, and a milk bar or a drive-in now and then. The zombie ruins and wrecks are hidden in Props meanwhile.
 */
export class DateDress {
  group = new THREE.Group()
  private sets: Scatter[]
  private venues = [milkBar(), driveIn()]
  private z = -150
  private which = 0

  constructor(dist: number) {
    const span = lightSpan()
    const heart = balloons()
    const n = Math.ceil(LOOP / D.span)
    this.sets = ([-1, 1] as const).flatMap((side) => [
      new Scatter({ geo: span, mat: GLOW, n, xr: [D.x, 0], side, gap: D.span, yaw: () => 0 }, dist),
      new Scatter(
        {
          geo: heart,
          n: Math.ceil(n / D.balloonEvery),
          xr: [D.x, 0],
          side,
          gap: D.span * D.balloonEvery,
          yaw: () => Math.random() * 6.3,
        },
        dist,
      ),
    ])
    for (const s of this.sets) this.group.add(s.mesh)
    this.group.add(...this.venues)
    this.place(dist)
  }

  private place(dist: number) {
    this.which = (this.which + 1) % this.venues.length
    const side = Math.random() < 0.5 ? -1 : 1
    this.venues.forEach((v, i) => {
      v.visible = i === this.which
      v.position.set(side * D.venueX, groundH(side * D.venueX, this.z - dist) - 0.3, this.z)
      v.rotation.y = -side * (Math.PI / 2 - 0.45)
    })
  }

  update(dz: number, dist: number) {
    for (const s of this.sets) s.update(dz, dist)
    this.z += dz
    if (this.z > 60) {
      this.z -= D.venueEvery
      this.place(dist)
    }
    for (const v of this.venues) v.position.z = this.z
  }
}

/** Billboard slogans for a date (the zombie ones live in landmarks.ts). */
export const DATE_SLOGANS: [string, string, string, string][] = [
  ['FREE PARKING', 'FOR LOVERS', '#e0567f', '#fff'],
  ['TINDER?', 'TRY TANDEM', '#ff8fb8', '#3a1030'],
  ['DINNER FOR 2', 'BYO DEFIB', '#3a2a6e', '#ffd27a'],
  ['CHAPEL OF LOVE', 'DRIVE-THRU 2 km', '#fff3d0', '#d02a4a'],
  ['SINGLES NIGHT', 'EVERY NIGHT', '#7ff3ff', '#2a1830'],
  ['SHAZ', 'MARRY ME (CALL ME)', '#d02a4a', '#fff'],
]
