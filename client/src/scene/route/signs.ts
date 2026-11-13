import * as THREE from 'three'
import { box, canvasTex } from '../util'

const PX = 96
const plate = box(1, 1, 1)

/** Flat signs with words on: one canvas texture per distinct sign, shared and counted so it can be freed. */
export class Signs {
  private mats = new Map<string, { mat: THREE.MeshLambertMaterial; n: number }>()

  /**
   * A `w` by `h` metre plate reading `text` (lines split on \n) in `fg` on `bg`. Readable from both faces.
   * Hand it back to `release` when its chunk goes.
   */
  plate(text: string, w: number, h: number, bg: string, fg: string): THREE.Mesh {
    const key = `${text}|${bg}|${fg}|${(w / h).toFixed(2)}`
    let e = this.mats.get(key)
    if (!e) {
      const map = canvasTex(Math.min(512, Math.round((PX * w) / h)), PX, (c) =>
        draw(c, text, bg, fg),
      )
      this.mats.set(key, (e = { mat: new THREE.MeshLambertMaterial({ map }), n: 0 }))
    }
    e.n++
    const m = new THREE.Mesh(plate, e.mat)
    m.scale.set(w, h, 0.07)
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

function draw(c: CanvasRenderingContext2D, text: string, bg: string, fg: string) {
  const { width: w, height: h } = c.canvas
  c.fillStyle = fg
  c.fillRect(0, 0, w, h)
  c.fillStyle = bg
  c.fillRect(5, 5, w - 10, h - 10)
  c.fillStyle = fg
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const lines = text.split('\n')
  const size = (h - 22) / lines.length
  lines.forEach((line, i) => {
    c.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`
    const fit = Math.min(1, (w - 24) / c.measureText(line).width)
    c.font = `bold ${size * fit}px "Arial Narrow", Arial, sans-serif`
    c.fillText(line, w / 2, 11 + size * (i + 0.54))
  })
}
