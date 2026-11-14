import * as THREE from 'three'
import {
  BODY_FIELDS,
  BODY_PRESETS,
  defaultBody,
  fullBody,
  randomBody,
  type Body,
} from './core/body'
import { COSMETICS } from './core/cosmetics'
import { makeRider, type RiderMode } from './scene/riders'

/**
 * Dev page: a grid of rider bodies to look over for broken limbs, floating hats and clipping.
 * `set=random|extreme|hair|face|presets|default`, `wear=helmet|none|hats` (hats cycles every Garage hat),
 * `pose=ride|run|slump`, `view=front|side|back|face`, `seed=n`, `still=1` (no pedalling, for screenshots),
 * `from=i&n=k` (part of a set), `cols=n`, `tags=1`.
 */
const q = new URLSearchParams(location.search)
const set = q.get('set') ?? 'random'
const wear = q.get('wear') ?? 'helmet'
const view = q.get('view') ?? 'front'
let seed = Number(q.get('seed') ?? 1)
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

const picks = (key: string) =>
  Array.from({ length: BODY_FIELDS.find((f) => f.key === key)!.max + 1 }, (_, v) => ({
    [key]: v,
  }))
const sliders = BODY_FIELDS.filter((f) => f.type === 'slider')
const all = (v: number) => Object.fromEntries(sliders.map((f) => [f.key, v]))
const SETS: Record<string, () => Partial<Body>[]> = {
  random: () => Array.from({ length: 24 }, () => randomBody(rnd)),
  default: () => 'abcdefghijklmnopqrstuvwx'.split('').map((c) => defaultBody(`rider-${c}`)),
  extreme: () => [
    ...sliders.filter((f) => f.tab === 'Body').flatMap((f) => [{ [f.key]: 0 }, { [f.key]: 100 }]),
    all(0),
    all(100),
    { ...all(100), head: 0, neck: 0 },
    { ...all(0), head: 100, calves: 100 },
    { belly: 100, build: 100, legs: 0, arms: 0 },
    { legs: 100, arms: 100, build: 0, neck: 100 },
  ],
  hair: () => [
    ...picks('hair'),
    ...picks('beard').slice(1),
    { tan: 1 },
    { tan: 1, skin: 8 },
    { skin: 15 },
    { skin: 12 },
  ],
  face: () => [
    ...picks('eyeShape'),
    { googly: 1 },
    { googly: 1, eyeSize: 100 },
    ...picks('brows').slice(1),
    ...picks('noseShape'),
    { noseSize: 100 },
    { noseSize: 100, noseShape: 3 },
    ...picks('mouth'),
    { ears: 100 },
    { eyeGap: 0, eyeSize: 100 },
    { eyeGap: 100, eyeSize: 0 },
    { beard: 4, mouth: 2 },
  ],
  presets: () => BODY_PRESETS.map((p) => p.body),
}

const from = Number(q.get('from') ?? 0)
const bodies = (SETS[set] ?? SETS.random)()
  .slice(from, from + Number(q.get('n') ?? 99))
  .map((b) => fullBody(b))
const COLS = Number(q.get('cols') ?? (view === 'face' ? 8 : 6))
const GAP = view === 'face' ? [0.66, 0.74] : [1.9, 2.7]
const HATS = COSMETICS.filter((c) => c.slot === 'hat')
const OUTFITS = COSMETICS.filter((c) => c.slot === 'outfit')

const stage = document.getElementById('stage')!
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
stage.append(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#5d6b78')
scene.add(new THREE.HemisphereLight('#fff6e0', '#3a3530', 2.2))
const sun = new THREE.DirectionalLight('#ffffff', 1.6)
sun.position.set(-4, 8, -6)
scene.add(sun)

const rows = Math.ceil(bodies.length / COLS)
const riders = bodies.map((b, i) => {
  const r = makeRider(['#e94f37', '#3d7bd9', '#44bba4', '#f2b705'][i % 4], `dev${i}`)
  r.setBody(b, wear === 'none')
  r.setLook({
    hat: wear === 'hats' ? HATS[i % HATS.length].id : undefined,
    outfit: i % 3 ? OUTFITS[i % OUTFITS.length]?.id : undefined,
  })
  r.label(`${i}`, null, 'riding')
  r.tag.visible = q.get('tags') === '1'
  const col = i % COLS
  const row = Math.floor(i / COLS)
  r.root.position.set(-(col - (COLS - 1) / 2) * GAP[0], (rows - 1 - row) * GAP[1], 0)
  // Each rider turned the same way to the camera, whatever the column.
  r.root.rotation.y = view === 'side' ? Math.PI / 2 : view === 'back' ? Math.PI : -0.5
  if (view === 'face') {
    r.bike.group.visible = false
    r.person.children[0].visible = false
    r.root.rotation.y = -0.35
    r.root.scale.setScalar(1)
  }
  scene.add(r.root)
  return r
})
Object.assign(window, { riders, scene, renderer })

const cam = new THREE.PerspectiveCamera(view === 'face' ? 9 : 14, 1, 1, 400)
const fit = () => {
  const w = stage.clientWidth
  const h = stage.clientHeight
  renderer.setSize(w, h)
  cam.aspect = w / h
  const tall = rows * GAP[1]
  const wide = COLS * GAP[0]
  const mid = view === 'face' ? 1.92 : 1.15
  const dist = Math.max(tall, wide / cam.aspect) / 2 / Math.tan((cam.fov * Math.PI) / 360) + 2
  cam.position.set(0, ((rows - 1) * GAP[1]) / 2 + mid, -dist)
  cam.lookAt(0, ((rows - 1) * GAP[1]) / 2 + mid, 0)
  cam.updateProjectionMatrix()
}
addEventListener('resize', fit)
fit()

const mode = (q.get('pose') ?? 'ride') as RiderMode
const still = q.get('still') === '1'
const loop = (t: number) => {
  riders.forEach((r, i) => {
    r.pose(mode, still ? 0.9 + i : t / 300 + i)
    if (view === 'face') r.person.position.y = 1.92 - r.head.position.y
  })
  renderer.render(scene, cam)
  Object.assign(window, { avatarsReady: true })
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
