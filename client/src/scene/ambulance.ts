import * as THREE from 'three'
import { box, canvasTex } from './util'

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
      glow.intensity = siren * 220
    },
  }
}
