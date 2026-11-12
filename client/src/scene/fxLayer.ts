import * as THREE from 'three'
import { VIS } from './params'
import { smooth } from './util'

const N = 64

/** Camera-space speed streaks plus a cheap CSS vignette and damage flash. */
export class FxLayer {
  lines: THREE.LineSegments
  private ang = new Float32Array(N)
  private off = new Float32Array(N)
  private len = new Float32Array(N)
  private mat = new THREE.LineBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
  })
  private vignette: HTMLDivElement
  private flash: HTMLDivElement
  private pos = new Float32Array(N * 6)

  constructor(host: HTMLElement) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.lines = new THREE.LineSegments(g, this.mat)
    this.lines.frustumCulled = false
    this.lines.renderOrder = 20
    for (let i = 0; i < N; i++) {
      this.ang[i] = Math.random() * Math.PI * 2
      this.off[i] = Math.random()
      this.len[i] = 0.15 + Math.random() * 0.5
    }
    const layer = (css: string) => {
      const d = document.createElement('div')
      d.style.cssText = `position:absolute;inset:0;pointer-events:none;${css}`
      host.appendChild(d)
      return d
    }
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    this.vignette = layer(
      'background:radial-gradient(ellipse at 50% 55%,transparent 55%,#000 130%)',
    )
    this.flash = layer(
      'background:radial-gradient(ellipse at center,rgba(255,40,20,0) 35%,rgba(255,30,10,0.8) 120%);opacity:0',
    )
  }

  update(t: number, speed: number, aspect: number, flash: number, dark: number) {
    this.vignette.style.opacity = String(VIS.vignette * (0.7 + dark * 0.5))
    this.flash.style.opacity = String(flash)
    const k = smooth(9, 22, speed) * VIS.speedLines
    this.mat.opacity = 0.32 * k
    this.lines.visible = k > 0.02
    if (!this.lines.visible) return
    for (let i = 0; i < N; i++) {
      const u = (this.off[i] + t * (0.9 + this.len[i])) % 1
      const r0 = 0.45 + u * 1.1
      const r1 = r0 + this.len[i] * (0.3 + k)
      const c = Math.cos(this.ang[i])
      const s = Math.sin(this.ang[i])
      this.pos.set([c * r0 * aspect, s * r0, 0, c * r1 * aspect, s * r1, 0], i * 6)
    }
    this.lines.geometry.attributes.position.needsUpdate = true
  }

  dispose() {
    this.vignette.remove()
    this.flash.remove()
  }
}
