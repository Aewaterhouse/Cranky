import type { Route } from '../../core/route'
import { clamp } from '../math'
import { VIS } from '../params'

const R = VIS.route
/** A spur is a stretch that comes back to within the gap of itself inside this many metres of road. */
const SPUR_M = 80
const SPUR_GAP_M = 6
/** Points either side of a cut spur that share out the lost distance. */
const SPUR_PAD = 15

/** Latitude and longitude to local metres [east, north] around an origin. */
export function project(lat: number, lon: number, lat0: number, lon0: number): [number, number] {
  return [(lon - lon0) * 111320 * Math.cos((lat0 * Math.PI) / 180), (lat - lat0) * 110540]
}

/** A point on the road. Scene axes: x east, y up, z south. `f` is forward and `r` is right, both level. */
export interface Pose {
  x: number
  y: number
  z: number
  fx: number
  fz: number
  rx: number
  rz: number
  /** Rise over run. */
  grade: number
  /** Signed curvature in 1/m, positive turning right. */
  curv: number
  /** Road tilt in radians, positive when the right edge is lower (a right-hand bend). */
  bank: number
}
export const newPose = (): Pose => ({
  x: 0,
  y: 0,
  z: 0,
  fx: 0,
  fz: -1,
  rx: 1,
  rz: 0,
  grade: 0,
  curv: 0,
  bank: 0,
})

/** Cuts out short out-and-back spurs (a routing or GPS artefact) and spreads the points evenly over the join. */
function despur(x: Float64Array, z: Float64Array, space: number) {
  const n = x.length
  const reach = Math.round(SPUR_M / space)
  for (let i = 1; i < n - 2; i++) {
    let j = Math.min(n - 1, i + reach)
    while (j > i + 1 && Math.hypot(x[j] - x[i], z[j] - z[i]) > SPUR_GAP_M) j--
    if (j <= i + 1) continue
    const a = Math.max(0, i - SPUR_PAD)
    const b = Math.min(n - 1, j + SPUR_PAD)
    const keep: number[] = []
    for (let k = a; k <= b; k++) if (k <= i || k >= j) keep.push(k)
    const qx = keep.map((k) => x[k])
    const qz = keep.map((k) => z[k])
    const len = [0]
    for (let k = 1; k < qx.length; k++)
      len.push(len[k - 1] + Math.hypot(qx[k] - qx[k - 1], qz[k] - qz[k - 1]))
    let seg = 0
    for (let k = a + 1; k < b; k++) {
      const at = ((k - a) / (b - a)) * len[len.length - 1]
      while (seg < len.length - 2 && len[seg + 1] < at) seg++
      const t = (at - len[seg]) / (len[seg + 1] - len[seg] || 1)
      x[k] = qx[seg] + (qx[seg + 1] - qx[seg]) * t
      z[k] = qz[seg] + (qz[seg + 1] - qz[seg]) * t
    }
    i = b
  }
}

/** Out-and-back legs closer than this are one road ridden both ways; shorter ones than the minimum are spurs. */
const UTURN_GAP_M = 10
const UTURN_MIN_M = 300
const UTURN_TAPER_M = 80
/** The loop at the turn is full width for this far, then narrows to the carriageway gap over the next stretch. */
const BULB_HOLD_M = 25
const BULB_FADE_M = 40

/**
 * A long out-and-back (ride out, turn round, ride home on the same road) becomes two carriageways side by side,
 * each direction on its left, with a loop at the turn. The way home takes the way out's line and heights.
 */
function splitUturns(x: Float64Array, z: Float64Array, y: Float64Array, space: number) {
  const n = x.length
  // `c` is the sum of a mirrored pair of indices, so the turn can fall on a point or between two.
  const lo = (c: number, q: number) => Math.ceil(c / 2) - 1 - q
  const hi = (c: number, q: number) => Math.floor(c / 2) + 1 + q
  const gap = (c: number, q: number) =>
    Math.hypot(x[hi(c, q)] - x[lo(c, q)], z[hi(c, q)] - z[lo(c, q)])
  const fit = (c: number) => gap(c, 0) + gap(c, 1) + gap(c, 2) + gap(c, 3)
  for (let c = 10; c < 2 * n - 12; c++) {
    if (gap(c, 1) > UTURN_GAP_M || gap(c, 3) > UTURN_GAP_M) continue
    // The true turning point is the one the two legs mirror about best.
    for (let k = c + 1; k <= c + 6 && k < 2 * n - 12; k++) if (fit(k) < fit(c)) c = k
    let m = 3
    while (lo(c, m) > 1 && hi(c, m) < n - 2 && gap(c, m + 1) < UTURN_GAP_M) m++
    if (m * space < UTURN_MIN_M) continue
    const a = lo(c, m) - 1
    const ox = x.slice(a, lo(c, 0) + 2)
    const oz = z.slice(a, lo(c, 0) + 2)
    for (let q = 0; q <= m; q++) {
      const i = lo(c, q)
      const j = hi(c, q)
      const k = i - a
      const fx = ox[k + 1] - ox[k - 1]
      const fz = oz[k + 1] - oz[k - 1]
      const s = (j - i) * space * 0.5
      const bulb = clamp(1 - (s - BULB_HOLD_M) / BULB_FADE_M)
      const w =
        ((R.uturnShift + (R.uturnBulb - R.uturnShift) * bulb) *
          clamp(((m - q) * space) / UTURN_TAPER_M)) /
        (Math.hypot(fx, fz) || 1)
      x[i] = ox[k] + fz * w
      z[i] = oz[k] - fx * w
      x[j] = ox[k] - fz * w
      z[j] = oz[k] + fx * w
      y[j] = y[i]
    }
    c = 2 * hi(c, m)
  }
}

const cr = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 *
  (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3)
const crd = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 * (c - a + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (3 * b - a - 3 * c + d) * t * t)

/** The road centreline as a smooth curve through the route's points, in local metres. */
export class RoadPath {
  readonly n: number
  readonly space: number
  readonly length: number
  readonly x: Float64Array
  readonly y: Float64Array
  readonly z: Float64Array
  readonly curv: Float32Array

  /** `origin` defaults to the route's first point; pass the terrain grid's origin when there is one. */
  constructor(route: Route, origin?: { lat0: number; lon0: number }) {
    const p = route.points
    const n = (this.n = p.length)
    this.space = p[1].d - p[0].d
    this.length = route.distance
    const x = (this.x = new Float64Array(n))
    const z = (this.z = new Float64Array(n))
    this.y = Float64Array.from(p, (q) => q.ele)
    if (p[0].lat !== undefined) {
      const o = origin ?? { lat0: p[0].lat, lon0: p[0].lon! }
      p.forEach((q, i) => {
        const [e, north] = project(q.lat!, q.lon!, o.lat0, o.lon0)
        x[i] = e
        z[i] = -north
      })
      splitUturns(x, z, this.y, this.space)
      despur(x, z, this.space)
      for (let k = 0; k < R.smoothPasses; k++)
        for (const a of [x, z]) {
          let prev = a[0]
          for (let i = 1; i < n - 1; i++) {
            const cur = a[i]
            a[i] = (prev + 2 * cur + a[i + 1]) / 4
            prev = cur
          }
        }
    } else {
      // No coordinates: a made-up line that wanders gently and keeps the real gradient.
      const [a1, l1, a2, l2] = R.meander
      for (let i = 1; i < n; i++) {
        const d = p[i].d
        const th = a1 * Math.sin(d / l1) + a2 * Math.sin(d / l2 + 1.7)
        x[i] = x[i - 1] + Math.sin(th) * this.space
        z[i] = z[i - 1] - Math.cos(th) * this.space
      }
    }
    const raw = new Float32Array(n)
    for (let i = 1; i < n - 1; i++) {
      const a = Math.atan2(x[i] - x[i - 1], z[i - 1] - z[i])
      const b = Math.atan2(x[i + 1] - x[i], z[i] - z[i + 1])
      const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a))
      raw[i] = turn / Math.max(1, Math.hypot(x[i + 1] - x[i - 1], z[i + 1] - z[i - 1]) / 2)
    }
    this.curv = raw.map((c, i) => (i && i < n - 1 ? (raw[i - 1] + 2 * c + raw[i + 1]) / 4 : c))
  }

  /** Pose at `d` metres along the route. Beyond either end the road carries straight on, level. */
  poseAt(d: number, out: Pose): Pose {
    const { x, y, z, n } = this
    const u = d / this.space
    const i = clamp(Math.floor(u), 0, n - 2)
    const t = clamp(u - i)
    const a = Math.max(0, i - 1)
    const c = i + 1
    const e = Math.min(n - 1, i + 2)
    const dx = crd(x[a], x[i], x[c], x[e], t)
    const dz = crd(z[a], z[i], z[c], z[e], t)
    const len = Math.hypot(dx, dz)
    out.fx = len ? dx / len : 0
    out.fz = len ? dz / len : -1
    out.rx = -out.fz
    out.rz = out.fx
    const over = (u - i - t) * this.space
    out.x = cr(x[a], x[i], x[c], x[e], t) + out.fx * over
    out.z = cr(z[a], z[i], z[c], z[e], t) + out.fz * over
    out.y = cr(y[a], y[i], y[c], y[e], t)
    out.grade = over || !len ? 0 : crd(y[a], y[i], y[c], y[e], t) / len
    out.curv = over ? 0 : this.curv[i] + (this.curv[c] - this.curv[i]) * t
    out.bank = clamp(out.curv * R.bankGain, -R.bankMax, R.bankMax)
    return out
  }
}
