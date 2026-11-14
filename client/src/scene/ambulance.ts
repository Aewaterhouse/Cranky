import * as THREE from 'three'
import { VIS } from './params'
import { Mesher, VC, box, canvasTex, ico } from './util'

const basic = (c: string) => new THREE.MeshBasicMaterial({ color: c })

/** Ambulance dress for the bus shell: chequered side stripes, rear sign and a roof light bar. Hidden until shown. */
export function makeAmbo(shell: THREE.Object3D) {
  const g = new THREE.Group()
  g.visible = false
  shell.add(g)
  const stripe = new THREE.MeshBasicMaterial({
    map: canvasTex(672, 32, (c) => {
      for (let i = 0; i < 42; i++)
        for (let j = 0; j < 2; j++) {
          c.fillStyle = (i + j) % 2 ? '#d8201c' : '#ffd21f'
          c.fillRect(i * 16, j * 16, 16, 16)
        }
    }),
  })
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.4), stripe)
    m.position.set(s * 1.47, 1.5, 0.8)
    m.rotation.y = (s * Math.PI) / 2
    g.add(m)
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.53),
    new THREE.MeshBasicMaterial({
      transparent: true,
      map: canvasTex(512, 128, (c) => {
        c.fillStyle = '#c4161c'
        c.textAlign = 'center'
        c.font = '900 62px system-ui, sans-serif'
        c.fillText('AMBULANCE', 256, 64)
        c.font = '700 24px system-ui, sans-serif'
        c.fillText("HOW'S MY DRIVING? DON'T ANSWER", 256, 106)
      }),
    }),
  )
  sign.position.set(0.25, 2.05, 5.03)
  g.add(sign)
  const bar = new THREE.Mesh(box(2.0, 0.14, 0.5), basic('#26262a'))
  bar.position.set(0, 3.42, 4.8)
  g.add(bar)
  const red = basic('#ff2a20')
  const blue = basic('#2a6cff')
  for (const [x, m] of [
    [-0.55, red],
    [0.55, blue],
  ] as [number, THREE.Material][]) {
    const l = new THREE.Mesh(box(0.8, 0.24, 0.42), m)
    l.position.set(x, 3.6, 4.8)
    g.add(l)
  }
  const glow = new THREE.PointLight('#ff2a20', 0, 40, 1.5)
  glow.position.set(0, 4.4, 4.8)
  g.add(glow)
  const tmp = new THREE.Color()
  return {
    group: g,
    /** Lights idle dim; with the siren on (0..1) they alternate four times a second and light the road. */
    update(t: number, siren: number) {
      const ph = Math.floor(t * 8) % 2 === 0
      const lit = (on: boolean) => (siren > 0 ? (on ? 1 : 0.12) : 0.3)
      red.color.set('#ff2a20').multiplyScalar(lit(ph))
      blue.color.set('#2a6cff').multiplyScalar(lit(!ph))
      glow.color.copy(tmp.set(ph ? '#ff2a20' : '#2a6cff'))
      glow.intensity = siren * 110
    },
  }
}

/**
 * Roadside pieces for Kidney Stone Express: the hospital that slides up on the right as the run ends, and
 * the stretcher left on the road while the crew reverses for a patient who fell out.
 */
export function makeAmboProps() {
  const g = new THREE.Group()
  const m = new Mesher(0.06)
  m.add(box(18, 9, 12), '#eef0ee', [0, 4.5, 0])
  m.add(box(18.2, 0.8, 12.2), '#c4161c', [0, 6.4, 0])
  m.add(box(8, 0.4, 7), '#d8dcd8', [-11, 4.2, 2])
  for (const z of [-1, 5]) m.add(box(0.4, 4.2, 0.4), '#9aa0a8', [-14.6, 2.1, z])
  for (let i = 0; i < 4; i++) m.add(box(2.2, 1.6, 0.2), '#2a3d4c', [-6 + i * 4, 3, 6.05])
  m.add(box(1, 3, 0.3), '#c4161c', [0, 10.5, 0])
  m.add(box(3, 1, 0.3), '#c4161c', [0, 10.5, 0])
  const hospital = new THREE.Group()
  const body = new THREE.Mesh(m.build(), VC)
  body.castShadow = true
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.5),
    new THREE.MeshBasicMaterial({
      map: canvasTex(512, 86, (c) => {
        c.fillStyle = '#c4161c'
        c.fillRect(0, 0, 512, 86)
        c.fillStyle = '#fff'
        c.textAlign = 'center'
        c.font = '900 50px system-ui, sans-serif'
        c.fillText('EMERGENCY · QUEUE HERE', 256, 60)
      }),
    }),
  )
  sign.position.set(0, 7.6, 6.2)
  hospital.add(body, sign)
  hospital.position.x = 21
  const s = new Mesher(0.05)
  s.add(box(0.8, 0.12, 2), '#d8dcd8', [0, 0.7, 0])
  for (const [x, z] of [
    [-0.35, -0.9],
    [0.35, -0.9],
    [-0.35, 0.9],
    [0.35, 0.9],
  ])
    s.add(box(0.06, 0.7, 0.06), '#6b6f78', [x, 0.35, z])
  s.add(box(0.6, 0.3, 1.3), '#7fc4e8', [0, 0.92, 0.2])
  s.add(ico(0.2), '#e8b89a', [0, 0.95, -0.7])
  const stretcher = new THREE.Mesh(s.build(), VC)
  stretcher.position.set(-3.4, 0, 4.5)
  stretcher.rotation.y = 0.5
  g.add(hospital, stretcher)
  return {
    group: g,
    /** `dist` is metres to the hospital (null: none in sight); `fell` shows the stretcher behind the van. */
    update(a?: { dist?: number | null; fell?: boolean } | null) {
      const d = a?.dist
      hospital.visible = d != null && d < VIS.amboHospitalM
      if (d != null) hospital.position.z = -Math.max(0, d) * VIS.amboHospitalScale - 2
      stretcher.visible = !!a?.fell
    },
  }
}
