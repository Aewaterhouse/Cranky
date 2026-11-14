const NS = 'http://www.w3.org/2000/svg'

/** SVG element with attributes and optional text. */
export function svgEl(tag: string, attrs: Record<string, string | number> = {}, text?: string) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text) e.textContent = text
  return e
}

/** Round-number axis ticks from 0 up to just past `max`. */
/**
 * A smooth SVG path through points sorted by x: a monotone cubic (Fritsch and Carlson), so the line never bulges
 * above or below its points the way an ordinary spline does.
 */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length
  if (n < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const dx = pts.slice(1).map(([x], i) => x - pts[i][0])
  const sl = pts.slice(1).map(([, y], i) => (y - pts[i][1]) / (dx[i] || 1))
  const m = pts.map((_, i) =>
    i === 0
      ? sl[0]
      : i === n - 1
        ? sl[n - 2]
        : sl[i - 1] * sl[i] <= 0
          ? 0
          : (sl[i - 1] + sl[i]) / 2,
  )
  for (let i = 0; i < n - 1; i++) {
    if (sl[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / sl[i]
    const b = m[i + 1] / sl[i]
    const r = a * a + b * b
    if (r > 9) {
      const k = 3 / Math.sqrt(r)
      m[i] = k * a * sl[i]
      m[i + 1] = k * b * sl[i]
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h3 = dx[i] / 3
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    d += ` C${x0 + h3},${y0 + m[i] * h3} ${x1 - h3},${y1 - m[i + 1] * h3} ${x1},${y1}`
  }
  return d
}

export function niceTicks(max: number, count = 4): number[] {
  const raw = max / count || 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(6))
}

/** Fixed-size chart canvas: plot box and an SVG that stretches to its container. */
export function chartBox(W: number, H: number, pad = { l: 44, r: 12, t: 12, b: 26 }) {
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rchart', role: 'img' })
  return { svg, W, H, ...pad, pw: W - pad.l - pad.r, ph: H - pad.t - pad.b }
}
