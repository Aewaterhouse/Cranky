import { routeAt, type Route } from '../core/route'
import { h } from './dom'

/** Green on the flat and descents, then yellow, orange and red as it steepens. */
export function gradeColour(g: number) {
  return g < 2 ? '#7fd13b' : g < 5 ? '#f2d60a' : g < 8 ? '#ff9f1c' : g < 12 ? '#ff5a4e' : '#c2185b'
}

const COL_W = 3
const STEPS_KM = [0.5, 1, 2, 5, 10, 20, 50, 100]

/**
 * Canvas elevation profile, filled column by column in the colour of the gradient.
 * Without `ahead` it shows the whole route and dims what has been ridden;
 * with `ahead` it shows `behind` m back to `ahead` m forward of the rider.
 */
export function profileChart(route: Route, win?: { behind: number; ahead: number }) {
  const cv = h('canvas', { class: 'frchart' })
  const el = h('div', { class: 'frchart-box' }, cv)
  let dist = 0
  let box = { w: 0, h: 0 }
  const dpr = () => window.devicePixelRatio || 1
  const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n)

  function draw() {
    if (!box.w) return
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0)
    ctx.clearRect(0, 0, box.w, box.h)
    const d0 = win
      ? Math.max(0, Math.min(dist - win.behind, route.distance - win.behind - win.ahead))
      : 0
    const d1 = win ? d0 + win.behind + win.ahead : route.distance
    const L = win ? 8 : 46
    const T = win ? 10 : 16
    const B = box.h - (win ? 18 : 24)
    const W = box.w - L - 8
    const cols = Math.max(2, Math.floor(W / COL_W))
    const at = (c: number) =>
      routeAt(route, Math.min(route.distance, d0 + ((c + 0.5) / cols) * (d1 - d0)))
    const samples = Array.from({ length: cols }, (_, c) => at(c))
    let lo = Infinity
    let hi = -Infinity
    for (const s of samples) {
      lo = Math.min(lo, s.ele)
      hi = Math.max(hi, s.ele)
    }
    const span = Math.max(win ? 30 : 60, hi - lo)
    const mid = (hi + lo) / 2
    lo = mid - span / 2 - span * 0.04
    hi = mid + span / 2 + span * 0.1
    const y = (e: number) => B - ((e - lo) / (hi - lo)) * (B - T)
    const x = (d: number) => L + ((d - d0) / (d1 - d0)) * W

    ctx.font = '600 11px Inter, system-ui, sans-serif'
    ctx.fillStyle = css('--dim')
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    // Elevation gridlines (whole route only) and distance ticks.
    if (!win) {
      const step = [10, 20, 50, 100, 200, 500, 1000].find((s) => (hi - lo) / s <= 5) ?? 1000
      for (let e = Math.ceil(lo / step) * step; e < hi; e += step) {
        ctx.beginPath()
        ctx.moveTo(L, y(e))
        ctx.lineTo(L + W, y(e))
        ctx.stroke()
        ctx.textAlign = 'right'
        ctx.fillText(`${e} m`, L - 6, y(e) + 4)
      }
    }
    const kmStep = win
      ? 0.2
      : (STEPS_KM.find((s) => (d1 - d0) / 1000 / s <= 10) ?? STEPS_KM[STEPS_KM.length - 1])
    ctx.textAlign = 'center'
    for (let k = Math.ceil(d0 / 1000 / kmStep) * kmStep; k * 1000 <= d1; k += kmStep) {
      const px = x(k * 1000)
      ctx.fillStyle = css('--dim')
      ctx.fillText(
        win ? `${Math.round((k * 1000 - dist) / 100) / 10} km` : `${+k.toFixed(1)} km`,
        px,
        box.h - 6,
      )
      ctx.beginPath()
      ctx.moveTo(px, B)
      ctx.lineTo(px, B + 4)
      ctx.stroke()
    }
    for (let c = 0; c < cols; c++) {
      const s = samples[c]
      const px = L + c * COL_W
      ctx.globalAlpha = !win && d0 + ((c + 0.5) / cols) * (d1 - d0) < dist ? 0.32 : 0.92
      ctx.fillStyle = gradeColour(s.grade)
      ctx.fillRect(px, y(s.ele), COL_W + 0.6, B - y(s.ele))
    }
    ctx.globalAlpha = 1
    ctx.beginPath()
    samples.forEach((s, c) => ctx[c ? 'lineTo' : 'moveTo'](L + (c + 0.5) * COL_W, y(s.ele)))
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.stroke()
    // Rider marker.
    const me = routeAt(route, dist)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x(dist), T - 4)
    ctx.lineTo(x(dist), B)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x(dist), y(me.ele), win ? 7 : 6, 0, 7)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = css('--acc')
    ctx.stroke()
  }

  new ResizeObserver(() => {
    const r = el.getBoundingClientRect()
    box = { w: Math.floor(r.width), h: Math.floor(r.height) }
    cv.width = box.w * dpr()
    cv.height = box.h * dpr()
    cv.style.width = `${box.w}px`
    cv.style.height = `${box.h}px`
    draw()
  }).observe(el)

  return {
    el,
    set(d: number) {
      dist = d
      draw()
    },
  }
}
