import * as THREE from 'three'

/** Tag colour by heart-rate zone (under 60, 70, 80, 90% of max, then over). */
const HR_COLS = ['#9aa7b8', '#5aa9e6', '#6cff7a', '#ffd24a', '#ff5a4a']
export const TAG_H = 132

/** A rider's floating name tag: a sprite, and `label` to redraw it when what it says changes. */
export function makeTag() {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = TAG_H
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const tag = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  )
  tag.scale.set(2.8, (2.8 * TAG_H) / 320, 1)
  tag.renderOrder = 10
  let lastTag = ''
  let guilty = false
  /** Name pill, with a heart-rate chip above it when the rider has a strap: bpm and % of max. */
  const label = (
    name: string,
    c: number | null,
    state: string,
    hr?: number | null,
    hrp?: number | null,
  ) => {
    const col = c == null ? '#cfcfcf' : c > 0.85 ? '#6cff7a' : c > 0.6 ? '#ffd24a' : '#ff5a4a'
    const beat = hr ? `♥ ${hr}${hrp ? `  ${Math.round(hrp * 100)}%` : ''}` : ''
    const key = name + col + state + beat + guilty
    if (key === lastTag) return
    lastTag = key
    const g = canvas.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, 320, TAG_H)
    g.font = '700 34px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (beat) {
      const w = g.measureText(beat).width + 36
      g.fillStyle = 'rgba(14,12,22,0.78)'
      g.beginPath()
      g.roundRect(160 - w / 2, 4, w, 46, 18)
      g.fill()
      g.fillStyle = hrp ? HR_COLS[[0.6, 0.7, 0.8, 0.9].filter((f) => hrp >= f).length] : '#ffffff'
      g.fillText(beat, 160, 29)
    }
    g.translate(0, TAG_H - 80)
    g.fillStyle = 'rgba(14,12,22,0.78)'
    g.beginPath()
    g.roundRect(6, 12, 308, 56, 22)
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = state === 'riding' ? col : '#888'
    g.stroke()
    g.fillStyle = '#fff'
    g.fillText((state === 'fell' ? '! ' : '') + name.slice(0, 12), 160, 42)
    g.fillStyle = col
    g.beginPath()
    g.arc(30, 40, 9, 0, 7)
    g.fill()
    if (guilty) {
      // Climate Lawsuit's sash: a red ribbon across the corner of the name pill.
      g.translate(262, 18)
      g.rotate(0.22)
      g.fillStyle = '#c4161c'
      g.fillRect(-52, -13, 104, 26)
      g.fillStyle = '#fff'
      g.font = '900 19px system-ui, sans-serif'
      g.fillText('GUILTY', 0, 1)
    }
    tex.needsUpdate = true
  }
  /** Brands the tag GUILTY (a rider convicted in Climate Lawsuit) on its next redraw. */
  const brand = (on: boolean) => (guilty = on)
  return { tag, label, brand }
}
