import { fmt, h } from './dom'
import type { Seg } from './soloSegs'

export interface ChartData {
  segs: Seg[]
  total: number
  /** Per-second power samples, plotted at `xs[i]` (plan seconds) or at index i. */
  power: number[]
  xs?: number[]
  cadence?: number[]
  hr?: (number | null)[]
  showHr?: boolean
  /** Now-cursor in plan seconds; omit for a finished ride. */
  now?: number
  showCadence?: boolean
  /** Plan seconds between samples that still counts as one continuous trace. */
  gap?: number
}

const PAD = { l: 46, r: 12, t: 10, b: 22 }
const CAD = [40, 140]
const HR = [60, 200]
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
const niceStep = (span: number, max: number, steps: number[]) =>
  steps.find((s) => span / s <= max) ?? steps[steps.length - 1]

/**
 * Canvas workout chart: zone-coloured target blocks, rider power over the top, optional cadence,
 * now-cursor, FTP line and time ticks. `zoom` (seconds each side of now) makes it a close-up strip.
 */
export function workoutChart(ftp: number, zoom = 0) {
  const canvas = h('canvas', { class: 'wchart' })
  const ctx = canvas.getContext('2d')!
  let data: ChartData | null = null
  let raf = 0
  const draw = () => {
    raf = 0
    if (!data) return
    const dpr = devicePixelRatio || 1
    const w = canvas.clientWidth
    const hh = canvas.clientHeight
    if (!w || !hh) return
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(hh * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, w, hh, data, ftp, zoom)
  }
  const redraw = () => raf || (raf = requestAnimationFrame(draw))
  new ResizeObserver(redraw).observe(canvas)
  return {
    el: canvas,
    set(d: ChartData) {
      data = d
      redraw()
    },
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  hh: number,
  d: ChartData,
  ftp: number,
  zoom: number,
) {
  const now = d.now ?? d.total
  const v0 = zoom ? now - zoom : 0
  const v1 = zoom ? now + zoom : d.total
  const [L, R, T, B] = [PAD.l, w - PAD.r, PAD.t, hh - PAD.b]
  const x = (t: number) => L + ((t - v0) / (v1 - v0)) * (R - L)
  const maxTgt = Math.max(0, ...d.segs.map((s) => Math.max(s.w0, s.w1)))
  const maxPow = d.power.length ? Math.max(...d.power) : 0
  const base = Math.max(ftp * 1.25, maxTgt * 1.12)
  const cap = d.segs.some((s) => s.kind === 'sprint') ? ftp * 2.2 : base * 1.2
  const yMax = Math.max(base, Math.min(maxPow * 1.05, cap))
  const y = (v: number) => B - (Math.min(v, yMax) / yMax) * (B - T)
  const dim = css('--dim') || '#9c998f'
  const small = '11px Inter, system-ui, sans-serif'
  ctx.clearRect(0, 0, w, hh)
  ctx.font = small
  ctx.lineWidth = 1

  // watt grid
  const gs = niceStep(yMax, 6, [25, 50, 100, 200, 250, 500])
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let v = 0; v <= yMax; v += gs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath()
    ctx.moveTo(L, Math.round(y(v)) + 0.5)
    ctx.lineTo(R, Math.round(y(v)) + 0.5)
    ctx.stroke()
    ctx.fillStyle = dim
    ctx.fillText(String(v), L - 8, y(v))
  }
  // time ticks
  const ts = niceStep(v1 - v0, (R - L) / 64, [10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600])
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let t = Math.ceil(Math.max(0, v0) / ts) * ts; t <= Math.min(v1, d.total); t += ts) {
    if (x(t) > R - 14) break
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.moveTo(Math.round(x(t)) + 0.5, T)
    ctx.lineTo(Math.round(x(t)) + 0.5, B)
    ctx.stroke()
    ctx.fillStyle = dim
    ctx.fillText(fmt(t), x(t), B + 6)
  }

  // target blocks: dimmer once ridden, brighter ahead
  const drawSegs = (alpha: number, from: number, to: number) => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(from, T - 2, to - from, B - T + 4)
    ctx.clip()
    for (const s of d.segs) {
      if (s.t1 < v0 || s.t0 > v1) continue
      const x0 = x(s.t0)
      const x1 = Math.max(x(s.t1), x0 + (s.kind === 'sprint' ? 3 : 0))
      ctx.fillStyle = s.col
      if (s.kind === 'zone') {
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.moveTo(x0, B)
        ctx.lineTo(x0, y(s.w0))
        ctx.lineTo(x1, y(s.w1))
        ctx.lineTo(x1, B)
        ctx.fill()
        ctx.globalAlpha = Math.min(1, alpha + 0.35)
        ctx.strokeStyle = s.col
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x0, y(s.w0))
        ctx.lineTo(x1, y(s.w1))
        ctx.stroke()
      } else {
        ctx.globalAlpha = s.kind === 'sprint' ? alpha : 0.1
        ctx.fillRect(x0, s.kind === 'sprint' ? T : y(ftp * 0.5), x1 - x0, B - T)
      }
    }
    ctx.restore()
  }
  const nx = d.now === undefined ? R : Math.min(R, Math.max(L, x(now)))
  drawSegs(d.now === undefined ? 0.6 : 0.3, L, nx)
  drawSegs(0.62, nx, R)

  // FTP reference
  ctx.save()
  ctx.setLineDash([6, 5])
  ctx.strokeStyle = css('--acc') || '#f2b705'
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(L, Math.round(y(ftp)) + 0.5)
  ctx.lineTo(R, Math.round(y(ftp)) + 0.5)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = css('--acc') || '#f2b705'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`FTP ${ftp} W`, R - 4, y(ftp) - 3)

  // series, split into runs wherever the ride jumped (skipped intervals)
  const runs = (vals: number[], map: (v: number) => number, smooth: number, idx?: number[]) => {
    const out: [number, number][][] = []
    let prev = -Infinity
    for (let i = 0; i < vals.length; i++) {
      const t = d.xs?.[idx ? idx[i] : i] ?? (idx ? idx[i] : i)
      if (t < v0 - 5 || t > v1 + 5) continue
      let s = 0
      let n = 0
      for (let k = Math.max(0, i - smooth + 1); k <= i; k++, n++) s += vals[k]
      if (t - prev > (d.gap ?? 3)) out.push([])
      out[out.length - 1].push([x(t), map(s / n)])
      prev = t
    }
    return out
  }
  const trace = (run: [number, number][]) => {
    ctx.beginPath()
    run.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  }
  const smooth = Math.max(1, Math.min(15, Math.round(((v1 - v0) / (R - L)) * 1.5)))
  const power = runs(d.power, y, smooth)
  const g = ctx.createLinearGradient(0, T, 0, B)
  g.addColorStop(0, 'rgba(255,255,255,0.26)')
  g.addColorStop(1, 'rgba(255,255,255,0.02)')
  for (const run of power) {
    if (run.length < 2) continue
    trace(run)
    ctx.lineTo(run[run.length - 1][0], B)
    ctx.lineTo(run[0][0], B)
    ctx.fillStyle = g
    ctx.fill()
    trace(run)
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4.5
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.stroke()
    ctx.lineWidth = 2.2
    ctx.strokeStyle = '#fff'
    ctx.shadowColor = 'rgba(255,255,255,0.7)'
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  if (d.showCadence && d.cadence) {
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#4cc9f0'
    for (const run of runs(
      d.cadence,
      (v) => B - ((v - CAD[0]) / (CAD[1] - CAD[0])) * (B - T),
      smooth * 2,
    )) {
      trace(run)
      ctx.stroke()
    }
    ctx.fillStyle = '#4cc9f0'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('cadence 40-140 rpm', L + 6, T + 4)
  }

  if (d.showHr && d.hr) {
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#ff6b81'
    const have = d.hr.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0)
    for (const run of runs(
      have.map((i) => d.hr![i]!),
      (v) => B - ((v - HR[0]) / (HR[1] - HR[0])) * (B - T),
      smooth * 2,
      have,
    )) {
      trace(run)
      ctx.stroke()
    }
    if (!zoom) {
      ctx.fillStyle = '#ff6b81'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('heart rate 60-200 bpm', L + 6, T + (d.showCadence ? 18 : 4))
    }
  }

  // now cursor
  if (d.now !== undefined && now >= v0 && now <= v1) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(nx, T)
    ctx.lineTo(nx, B)
    ctx.stroke()
    const lastRun = power[power.length - 1]
    const last = lastRun?.[lastRun.length - 1]
    if (last && Math.abs(last[0] - nx) < 40) {
      ctx.beginPath()
      ctx.arc(last[0], last[1], 4.5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
  }
}
