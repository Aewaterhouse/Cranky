const NS = 'http://www.w3.org/2000/svg'

/** SVG element with attributes and optional text. */
export function svgEl(tag: string, attrs: Record<string, string | number> = {}, text?: string) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text) e.textContent = text
  return e
}

/** Round-number axis ticks from 0 up to just past `max`. */
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
