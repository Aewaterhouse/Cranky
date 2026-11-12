import * as THREE from 'three'

const VERT = `attribute float size; attribute float alpha; attribute vec3 tint;
varying float vA; varying vec3 vC; uniform float scale;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  vA = alpha; vC = tint;
  gl_Position = projectionMatrix * mv;
}`
const FRAG = `varying float vA; varying vec3 vC;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.25, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, a);
  #include <colorspace_fragment>
}`

export interface Puff {
  p: THREE.Vector3Like
  v?: THREE.Vector3Like
  life: number
  s0: number
  s1: number
  c: THREE.Color
  a?: number
  g?: number
  drag?: number
}

/** A pooled soft-sprite particle system (smoke, dust, sparks). Oldest particles are recycled. */
export class Particles {
  points: THREE.Points
  private n: number
  private pos: Float32Array
  private vel: Float32Array
  private life: Float32Array
  private max: Float32Array
  private s0: Float32Array
  private s1: Float32Array
  private a0: Float32Array
  private grav: Float32Array
  private drag: Float32Array
  private i = 0
  private mat: THREE.ShaderMaterial

  constructor(n: number, additive = false) {
    this.n = n
    this.pos = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.life = new Float32Array(n)
    this.max = new Float32Array(n).fill(1)
    this.s0 = new Float32Array(n)
    this.s1 = new Float32Array(n)
    this.a0 = new Float32Array(n)
    this.grav = new Float32Array(n)
    this.drag = new Float32Array(n)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { scale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(g, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
  }

  emit(o: Puff) {
    const i = this.i++ % this.n
    this.pos.set([o.p.x, o.p.y, o.p.z], i * 3)
    this.vel.set([o.v?.x ?? 0, o.v?.y ?? 0, o.v?.z ?? 0], i * 3)
    this.life[i] = this.max[i] = o.life
    this.s0[i] = o.s0
    this.s1[i] = o.s1
    this.a0[i] = o.a ?? 0.6
    this.grav[i] = o.g ?? 0
    this.drag[i] = o.drag ?? 1
    ;(this.points.geometry.attributes.tint as THREE.BufferAttribute).set(
      [o.c.r, o.c.g, o.c.b],
      i * 3,
    )
  }

  update(dt: number, pxScale: number) {
    this.mat.uniforms.scale.value = pxScale
    const g = this.points.geometry
    const size = g.attributes.size as THREE.BufferAttribute
    const alpha = g.attributes.alpha as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        alpha.array[i] = 0
        continue
      }
      this.life[i] -= dt
      const k = 1 - Math.max(0, this.life[i]) / this.max[i]
      const d = Math.pow(this.drag[i], dt * 60)
      this.vel[i * 3] *= d
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt
      this.vel[i * 3 + 2] *= d
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt
      size.array[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k
      alpha.array[i] = this.a0[i] * (1 - k) * Math.min(1, k * 8)
    }
    g.attributes.position.needsUpdate = true
    size.needsUpdate = true
    alpha.needsUpdate = true
    g.attributes.tint.needsUpdate = true
  }
}
