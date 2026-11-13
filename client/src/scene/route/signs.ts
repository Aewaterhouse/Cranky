import * as THREE from 'three'
import { box, canvasTex, hash } from '../util'

const PX = 96
const FACE = '"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", Arial, sans-serif'
const HAND = '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif'
const plate = box(1, 1, 1)
const sheet = new THREE.PlaneGeometry(1, 1)

/** Flat signs with words on: one canvas texture per distinct sign, shared and counted so it can be freed. */
export class Signs {
  private mats = new Map<string, { mat: THREE.MeshLambertMaterial; n: number }>()

  /**
   * A `w` by `h` metre plate reading `text` (lines split on \n) in `fg` on `bg`. Readable from both faces.
   * `hand` makes it a hand-painted board: no border, wobbly brushwork. Hand it back to `release` when its chunk goes.
   */
  plate(
    text: string,
    w: number,
    h: number,
    bg: string,
    fg: string,
    hand = false,
    px = hand ? PX * 1.5 : PX,
  ): THREE.Mesh {
    const key = `${text}|${bg}|${fg}|${(w / h).toFixed(2)}|${hand}|${px}`
    let e = this.mats.get(key)
    if (!e) {
      const map = canvasTex(Math.min(512, Math.round((px * w) / h)), px, (c) =>
        draw(c, text, bg, fg, hand),
      )
      this.mats.set(key, (e = { mat: new THREE.MeshLambertMaterial({ map }), n: 0 }))
    }
    e.n++
    const m = new THREE.Mesh(plate, e.mat)
    m.scale.set(w, h, 0.07)
    m.userData.sign = key
    return m
  }

  /**
   * One line of chalk to lie on the road, `w` metres across: see-through, scuffed, one texture per distinct line.
   * Faces +z with the top of the letters on +y; the caller lays it down.
   */
  chalk(text: string, colour: string): THREE.Mesh {
    const key = `chalk|${text}|${colour}`
    let e = this.mats.get(key)
    if (!e) {
      const w = text === 'ARROW' ? 96 : Math.min(512, 30 + text.length * 34)
      const map = canvasTex(w, 64, (c) => drawChalk(c, text, colour))
      const mat = new THREE.MeshLambertMaterial({
        map,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -200,
      })
      this.mats.set(key, (e = { mat, n: 0 }))
    }
    e.n++
    const m = new THREE.Mesh(sheet, e.mat)
    m.userData.sign = key
    return m
  }

  /** Frees the textures of every sign under `o` that nothing else is showing. */
  release(o: THREE.Object3D) {
    o.traverse((m) => {
      const key = m.userData.sign as string | undefined
      const e = key && this.mats.get(key)
      if (!e || --e.n > 0) return
      e.mat.map?.dispose()
      e.mat.dispose()
      this.mats.delete(key)
    })
  }
}

function draw(c: CanvasRenderingContext2D, text: string, bg: string, fg: string, hand: boolean) {
  const { width: w, height: h } = c.canvas
  const edge = hand ? 0 : 5
  c.fillStyle = fg
  c.fillRect(0, 0, w, h)
  c.fillStyle = bg
  c.fillRect(edge, edge, w - edge * 2, h - edge * 2)
  c.fillStyle = fg
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const face = hand ? HAND : FACE
  const lines = text.split('\n')
  const size = (h - 22) / lines.length
  c.font = `bold ${size}px ${face}`
  const fits = lines.map((line) => Math.min(1, (w - 24) / c.measureText(line).width))
  // Big boards keep their lines near one size, so they read as one notice.
  const cap = h > PX ? Math.min(...fits) * 1.2 : 1
  lines.forEach((line, i) => {
    c.font = `bold ${size * Math.min(fits[i], cap) * (hand ? 0.92 : 1)}px ${face}`
    c.save()
    c.translate(w / 2, 11 + size * (i + 0.54))
    // Painted by hand: each line a little off level, by an amount that depends only on its words.
    if (hand) c.rotate((hash(line.length * 7 + line.charCodeAt(0) + i) - 0.5) * 0.09)
    c.fillText(line, 0, 0)
    c.restore()
  })
}

function drawChalk(c: CanvasRenderingContext2D, text: string, colour: string) {
  const { width: w, height: h } = c.canvas
  c.fillStyle = c.strokeStyle = colour
  c.lineCap = c.lineJoin = 'round'
  if (text === 'ARROW') {
    // Drawn in a hurry: a bent shaft and a lopsided head, pointing up the road.
    c.lineWidth = 9
    c.beginPath()
    c.moveTo(44, 60)
    c.quadraticCurveTo(56, 34, 46, 8)
    c.moveTo(22, 26)
    c.lineTo(46, 6)
    c.lineTo(74, 22)
    c.stroke()
  } else {
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `bold 50px ${HAND}`
    const fit = Math.min(1, (w - 16) / c.measureText(text).width)
    c.translate(w / 2, h / 2 + 3)
    c.rotate((hash(text.length * 3 + text.charCodeAt(0)) - 0.5) * 0.05)
    c.scale(fit, 1)
    c.fillText(text, 0, 0)
    c.setTransform(1, 0, 0, 1, 0, 0)
  }
  // Scuffed by tyres and weather.
  c.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < w * 3; i++) {
    c.globalAlpha = 0.5 * hash(i * 1.7)
    c.fillRect(hash(i) * w, hash(i + 0.5) * h, 1 + hash(i * 3.1) * 3, 1 + hash(i * 5.3) * 2)
  }
}
