import * as THREE from 'three'
import { Mesher, box, canvasTex, cone, cyl, ico } from '../util'

export type Fuel = 'coal' | 'gas' | 'solar' | 'wind'

/** Terrace tops (m) from the beach up to the ridge the power stations sit on. The ridge never floods. */
export const TOPS = { beach: 1, shore: 2.4, main: 4.4, hill: 8, ridge: 14 }
const W = 96
/** The land's width, the front (seaward) edge of each terrace from the beach up, its back, and the seawall's face. */
export const LAND = { w: W, fronts: [36, 20, 8, -10, -30], back: -52, wall: 37.2 }

const sign = (w: number, h: number, lines: string[], bg: string, fg: string) =>
  new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: canvasTex(512, Math.round((512 * h) / w), (c) => {
        const H = c.canvas.height
        c.fillStyle = bg
        c.fillRect(0, 0, 512, H)
        c.fillStyle = fg
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        const px = Math.min((H / lines.length) * 0.7, 900 / Math.max(...lines.map((l) => l.length)))
        c.font = `900 ${px}px system-ui, sans-serif`
        lines.forEach((l, i) => c.fillText(l, 256, (H * (i + 0.5)) / lines.length))
      }),
    }),
  )

const house = (m: Mesher, x: number, y: number, z: number, wall: string, roof: string, s = 1) => {
  m.add(box(4 * s, 3 * s, 4 * s), wall, [x, y + 1.5 * s, z])
  m.add(cone(3.4 * s, 2 * s, 4), roof, [x, y + 4 * s, z], [0, Math.PI / 4, 0])
}

/** The town: terraces, beach, surf club, Main Street, the hill and the ridge. One merged mesh plus two signs. */
export function townLand() {
  const g = new THREE.Group()
  const m = new Mesher(0.08)
  m.add(box(W, TOPS.beach + 4, 16), '#ecd9a0', [0, TOPS.beach / 2 - 2, 28])
  m.add(box(W, TOPS.shore + 4, 12), '#8fbf5a', [0, TOPS.shore / 2 - 2, 14])
  m.add(box(W, TOPS.main + 4, 18), '#9a9a94', [0, TOPS.main / 2 - 2, -1])
  m.add(box(W, TOPS.hill + 4, 20), '#6fae4c', [0, TOPS.hill / 2 - 2, -20])
  m.add(box(W, TOPS.ridge + 4, 22), '#5c9a44', [0, TOPS.ridge / 2 - 2, -41])
  // Beach: towels, flags between which nobody swims.
  for (const [x, c] of [
    [-30, '#e94f37'],
    [-12, '#3f88c5'],
    [9, '#f6ae2d'],
    [27, '#f15bb5'],
  ] as [number, string][])
    m.add(box(1.2, 0.08, 2.2), c, [x, TOPS.beach + 0.04, 27 + (x % 5)])
  for (const x of [-5, 5]) {
    m.add(cyl(0.08, 0.08, 3, 5), '#dddddd', [x, TOPS.beach + 1.5, 33])
    m.add(box(1.2, 0.7, 0.06), '#e02020', [x + 0.6, TOPS.beach + 2.6, 33])
    m.add(box(1.2, 0.35, 0.07), '#ffd21f', [x + 0.6, TOPS.beach + 2.42, 33])
  }
  // Foreshore: surf club with its tower, Norfolk pines, a barbecue shelter.
  m.add(box(12, 3.2, 6), '#f3ead2', [0, TOPS.shore + 1.6, 13])
  m.add(box(12.6, 0.4, 6.6), '#c4161c', [0, TOPS.shore + 3.4, 13])
  m.add(box(2.4, 3, 2.4), '#f3ead2', [4, TOPS.shore + 5, 13])
  m.add(box(3, 0.3, 3), '#ffd21f', [4, TOPS.shore + 6.6, 13])
  for (const x of [-40, -28, -16, 16, 28, 40]) {
    m.add(cyl(0.3, 0.4, 5, 6), '#5b4630', [x, TOPS.shore + 2.5, 16])
    for (let i = 0; i < 4; i++)
      m.add(cone(2.6 - i * 0.55, 1.6, 7), '#2f6b3a', [x, TOPS.shore + 3 + i * 1.4, 16])
  }
  m.add(box(5, 0.3, 4), '#7a5a3c', [-22, TOPS.shore + 2.6, 12])
  for (const [dx, dz] of [
    [-2, -1.6],
    [2, -1.6],
    [-2, 1.6],
    [2, 1.6],
  ])
    m.add(box(0.25, 2.6, 0.25), '#7a5a3c', [-22 + dx, TOPS.shore + 1.3, 12 + dz])
  // Main Street: road, shops with awnings, the pub on the corner.
  m.add(box(W, 0.1, 5), '#3b3b40', [0, TOPS.main + 0.05, 3])
  for (let x = -44; x < 46; x += 6) m.add(box(2.4, 0.04, 0.3), '#e8e8e0', [x, TOPS.main + 0.12, 3])
  const shops = ['#e8b4a0', '#a9c9e8', '#f1e3a4', '#b9dfb0', '#d7b9e8', '#f0c9a0', '#c9d4d8']
  shops.forEach((c, i) => {
    const x = -39 + i * 13
    const h = 4 + (i % 3)
    m.add(box(10, h, 6), c, [x, TOPS.main + h / 2, -5])
    m.add(
      box(10.4, 0.3, 2.4),
      i % 2 ? '#c4161c' : '#1f5fa8',
      [x, TOPS.main + 2.8, -1.2],
      [0.25, 0, 0],
    )
    m.add(box(2, 2.2, 0.2), '#3a2c22', [x - 2.5, TOPS.main + 1.1, -1.95])
    m.add(box(4, 1.6, 0.2), '#2a3d4c', [x + 1.8, TOPS.main + 1.7, -1.95])
  })
  // The hill: houses, a church, gum trees.
  const walls = ['#f2efe6', '#e6d3b8', '#cfe0ea', '#f0d9d2']
  const roofs = ['#a8452f', '#5a6470', '#7a3b2a', '#3f6a55']
  for (let i = 0; i < 14; i++) {
    const x = -43 + i * 6.6
    const z = -14 - (i % 3) * 5
    if (i === 6) continue
    house(m, x, TOPS.hill, z, walls[i % 4], roofs[(i * 3) % 4], 0.85 + (i % 2) * 0.15)
  }
  m.add(box(5, 5, 8), '#f2efe6', [-3.4, TOPS.hill + 2.5, -22])
  m.add(box(2.4, 8, 2.4), '#f2efe6', [-3.4, TOPS.hill + 4, -17])
  m.add(cone(2.2, 3.4, 4), '#5a6470', [-3.4, TOPS.hill + 9.7, -17], [0, Math.PI / 4, 0])
  for (const [x, z] of [
    [-46, -26],
    [-20, -27],
    [12, -27],
    [33, -26],
    [45, -18],
  ]) {
    m.add(cyl(0.25, 0.35, 4, 5), '#b8a890', [x, TOPS.hill + 2, z])
    m.add(ico(2.2), '#6f9a5a', [x, TOPS.hill + 5, z], [0, 0, 0], [1, 0.8, 1])
  }
  const mesh = new THREE.Mesh(
    m.build(),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  )
  mesh.castShadow = mesh.receiveShadow = true
  g.add(mesh)
  const club = sign(7, 1, ['DAGGY POINT SLSC'], '#f3ead2', '#1f3f7a')
  club.position.set(-1.5, TOPS.shore + 2.4, 16.02)
  const pub = sign(8, 1.2, ['THE DROWNED RAT HOTEL'], '#2a2118', '#ffd21f')
  pub.position.set(-39, TOPS.main + 4.6, -1.98)
  g.add(club, pub)
  return g
}

/** The seawall along the beach front. Scale `wall` in y to raise it and lift `top` (the sign) to match. */
export function seawall() {
  const g = new THREE.Group()
  const m = new Mesher(0.12)
  for (let x = -46; x <= 46; x += 4) m.add(box(3.9, 1, 1.4), '#8d9196', [x, 0.5, 0])
  const wall = new THREE.Mesh(
    m.build(),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  )
  const s = sign(9, 1.6, ['SEAWALL', 'NOT DESIGNED BY A CPEng'], '#ffd21f', '#16120c')
  s.position.set(18, 2.4, 0.9)
  const post = new THREE.Mesh(box(0.2, 2.4, 0.2), new THREE.MeshBasicMaterial({ color: '#5b4630' }))
  post.position.set(18, 1.2, 0.8)
  const top = new THREE.Group()
  top.add(s, post)
  g.add(wall, top)
  return { group: g, wall, top }
}

/** A power station for one fuel, about 9 m wide, origin at ground level. `spin` holds the parts that move. */
export function station(fuel: Fuel) {
  const g = new THREE.Group()
  const m = new Mesher(0.08)
  const spin: THREE.Object3D[] = []
  const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  if (fuel === 'coal') {
    m.add(box(8, 4, 5), '#6b5a4e', [0, 2, 0])
    m.add(box(3, 2, 5.2), '#54463c', [-2, 5, 0])
    for (const x of [1, 3.2]) {
      m.add(cyl(0.7, 1, 9, 8), '#8a8078', [x, 4.5, 0])
      m.add(cyl(0.75, 0.75, 0.6, 8), '#c4161c', [x, 8.4, 0])
    }
    m.add(cone(2.4, 2, 5), '#1c1a19', [-5.5, 1, 1.5])
  } else if (fuel === 'gas') {
    m.add(box(5, 3, 5), '#b9c2c8', [-1.5, 1.5, 0])
    for (const x of [2.2, 4.2]) m.add(cyl(1, 1, 3.6, 10), '#e8e8e0', [x, 1.8, 0.5])
    m.add(cyl(0.18, 0.18, 9, 6), '#8a8f96', [-3.4, 4.5, -1.6])
    const flare = new THREE.Mesh(
      cone(0.7, 2.2, 6),
      new THREE.MeshBasicMaterial({ color: '#ff8a1a' }),
    )
    flare.position.set(-3.4, 10, -1.6)
    g.add(flare)
    spin.push(flare)
  } else if (fuel === 'solar') {
    m.add(box(3, 2.4, 3), '#e8e8e0', [-3.4, 1.2, -1.4])
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) {
        const p: [number, number, number] = [-0.6 + c * 2.6, 1.2, -1.6 + r * 2.8]
        m.add(box(0.14, 1.2, 0.14), '#8a8f96', [p[0], 0.6, p[2]])
        m.add(box(2.3, 0.1, 1.9), '#1f3f9a', p, [0.5, 0, 0])
        m.add(box(2.36, 0.04, 0.08), '#c9d4d8', [p[0], p[1] + 0.06, p[2]], [0.5, 0, 0])
      }
  } else {
    m.add(cyl(0.22, 0.42, 11, 8), '#f2f2ee', [0, 5.5, 0])
    m.add(box(0.8, 0.7, 1.6), '#f2f2ee', [0, 11.1, 0])
    m.add(box(2.4, 1.6, 2.4), '#e8e8e0', [3.4, 0.8, -1])
    const b = new Mesher(0.04)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      b.add(box(0.5, 4.6, 0.12), '#fafafa', [-Math.sin(a) * 2.3, Math.cos(a) * 2.3, 0], [0, 0, a])
    }
    const rotor = new THREE.Mesh(b.build(), lambert())
    rotor.position.set(0, 11.1, 0.9)
    g.add(rotor)
    spin.push(rotor)
  }
  const body = new THREE.Mesh(m.build(), lambert())
  body.castShadow = true
  g.add(body)
  return { group: g, spin }
}
