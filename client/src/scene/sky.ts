import * as THREE from 'three'
import type { Env } from './moods'
import { Mesher, box, noise2, smooth, hash } from './util'

const VERT = `varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const FRAG = `varying vec3 vDir;
uniform vec3 top, hor, sunCol, sunDir; uniform float stars, sunSize, t;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(hor, top, pow(h, 0.5));
  float sd = max(dot(d, sunDir), 0.0);
  c += sunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.35);
  vec2 p = d.xz / (d.y + 0.28) * 1.6 + vec2(t * 0.01, 0.0);
  float n = sin(p.x * 1.7 + sin(p.y * 1.3)) * sin(p.y * 1.1 + sin(p.x * 0.8 + 1.0));
  float cl = smoothstep(0.25, 0.32, n) * smoothstep(0.02, 0.22, d.y) * (1.0 - smoothstep(0.55, 0.9, d.y));
  c = mix(c, mix(hor, vec3(1.0), 0.45) * (0.55 + 0.5 * sunCol), cl * 0.42);
  c = mix(c, sunCol, smoothstep(sunSize * 1.25, sunSize, 1.0 - sd) * step(0.0, d.y + 0.05));
  vec2 g = d.xz / (d.y + 0.6) * 70.0;
  vec2 id = floor(g);
  vec2 off = (vec2(h21(id + 1.0), h21(id + 2.0)) - 0.5) * 0.6;
  float s = step(0.93, h21(id)) * smoothstep(0.16, 0.02, length(fract(g) - 0.5 - off)) * (0.6 + 0.4 * sin(t * 3.0 + h21(id + 3.0) * 20.0));
  c += vec3(s) * stars * smoothstep(0.04, 0.3, h);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`

const GRAD_FRAG = `varying float vT; uniform vec3 top, bot;
void main(){ gl_FragColor = vec4(mix(bot, top, vT), 1.0);
  #include <colorspace_fragment>
}`
const GRAD_VERT = `attribute float aT; varying float vT;
void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

export const gradMat = () =>
  new THREE.ShaderMaterial({
    vertexShader: GRAD_VERT,
    fragmentShader: GRAD_FRAG,
    uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
    fog: false,
  })

/** A jagged ridge ring around the road (angle 0 is straight ahead). */
function ridge(radius: number, base: number, amp: number, freq: number, seed: number) {
  const n = 120
  const pos: number[] = []
  const t: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = ((i / n) * 2 - 1) * 2.5
    const h =
      base + amp * (noise2(a * freq + seed, seed) * 0.8 + noise2(a * freq * 3.1, seed + 9) * 0.35)
    const x = Math.sin(a) * radius
    const z = -Math.cos(a) * radius
    pos.push(x, -10, z, x, h, z)
    t.push(0, 1)
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1))
  g.setIndex(idx)
  return g
}

function skyline() {
  const m = new Mesher(0)
  const win = new Mesher(0)
  const R = 340
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1
    const a = side * (0.1 + hash(i * 3.3) * 1.0)
    const w = 8 + hash(i + 11) * 16
    const h = 14 + hash(i + 5) * 60 * (1 - Math.abs(a) * 0.5)
    const x = Math.sin(a) * R
    const z = -Math.cos(a) * R
    m.add(box(w, h, w * 0.8), '#fff', [x, h / 2 - 2, z], [0, -a, 0])
    if (hash(i + 7) > 0.4) m.add(box(w * 0.7, 5, w * 0.6), '#fff', [x, h - 3, z], [0.15, -a, 0.2])
    for (let k = 0; k < 6; k++) {
      if (hash(i * 9 + k) < 0.55) continue
      const wx = (hash(i * 7 + k) - 0.5) * w * 0.7
      const wy = 4 + hash(i * 5 + k * 2) * (h - 10)
      win.add(
        box(1.4, 1.8, 0.2),
        '#fff',
        [x + wx * Math.cos(a), wy, z + 0.5 * w * 0.4 + wx * Math.sin(a) * 0.2],
        [0, -a, 0],
      )
    }
  }
  return [m.build(), win.build()] as const
}

/** Sky dome, sun or moon, stars, hazy ridges and a ruined city skyline. */
export class Sky {
  group = new THREE.Group()
  private dome: THREE.Mesh
  private u = {
    top: { value: new THREE.Color() },
    hor: { value: new THREE.Color() },
    sunCol: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 0.3, -1) },
    stars: { value: 0 },
    sunSize: { value: 0.03 },
    t: { value: 0 },
  }
  private ridges = [ridge(380, 8, 40, 1.6, 3), ridge(440, 30, 70, 1.1, 8)].map((g) => {
    const m = new THREE.Mesh(g, gradMat())
    m.frustumCulled = false
    this.group.add(m)
    return m
  })
  private city: THREE.Mesh
  private windows: THREE.Mesh
  private tmp = new THREE.Color()

  /** `bare` leaves just the dome and sun, for worlds that bring their own horizon. */
  constructor(private bare = false) {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(520, 24, 16),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.u,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    )
    this.dome.renderOrder = -2
    const [c, w] = skyline()
    this.city = new THREE.Mesh(c, new THREE.MeshBasicMaterial({ fog: false }))
    this.windows = new THREE.Mesh(
      w,
      new THREE.MeshBasicMaterial({ color: '#ffd88a', fog: false, transparent: true }),
    )
    this.group.add(this.dome, this.city, this.windows)
    if (bare) for (const o of [...this.ridges, this.city]) o.visible = false
  }

  update(env: Env, t: number, camPos: THREE.Vector3) {
    this.dome.position.copy(camPos)
    const u = this.u
    u.top.value.copy(env.sky)
    u.hor.value.copy(env.fog)
    u.sunCol.value.copy(env.light).lerp(this.tmp.set('#ffffff'), 0.35)
    const el = THREE.MathUtils.degToRad(env.sunElev)
    const az = THREE.MathUtils.degToRad(env.sunAz)
    u.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
    u.stars.value = env.stars
    u.sunSize.value = env.sunSize * env.sunSize * 0.5
    u.t.value = t
    this.ridges.forEach((r, i) => {
      const mat = r.material as THREE.ShaderMaterial
      const haze = i ? 0.62 : 0.32
      mat.uniforms.top.value.copy(env.hill).lerp(env.fog, haze)
      mat.uniforms.bot.value.copy(env.fog)
    })
    ;(this.city.material as THREE.MeshBasicMaterial).color
      .copy(env.hill)
      .lerp(env.fog, 0.45)
      .multiplyScalar(0.7)
    const night = smooth(0.2, 0.9, env.stars)
    this.windows.visible = !this.bare && night > 0.02
    ;(this.windows.material as THREE.MeshBasicMaterial).opacity = night * 0.8
  }
}
