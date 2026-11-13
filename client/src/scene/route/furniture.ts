import { VIS } from '../params'
import type { Patch } from './patch'
import type { RoadPath } from './roadPath'

const R = VIS.route
const F = R.place.furniture

/** A sign or arch beside (or over) the road at `d` metres along. `side` is -1 left, 1 right. */
export interface Furn {
  kind: 'km' | 'grade' | 'hairpin' | 'start' | 'summit' | 'finish'
  d: number
  side: -1 | 1
  text: string
}

/** Sustained ramps: stretches at or above the sign gradient for at least the sign length, with their average. */
export function ramps(path: RoadPath): { d0: number; d1: number; grade: number }[] {
  const { y, n, space } = path
  const w = Math.max(1, Math.round(F.gradeWindow / 2 / space))
  const steep = (i: number) => {
    const a = Math.max(0, i - w)
    const b = Math.min(n - 1, i + w)
    return (y[b] - y[a]) / ((b - a) * space) >= F.gradeMin
  }
  const out = []
  for (let i = 0; i < n; i++) {
    if (!steep(i)) continue
    let j = i
    while (j + 1 < n && steep(j + 1)) j++
    if ((j - i) * space >= F.gradeLength)
      out.push({ d0: i * space, d1: j * space, grade: (y[j] - y[i]) / ((j - i) * space) })
    i = j
  }
  return out
}

/** Hairpins: where the road turns through at least the hairpin angle within the window. `turn` is signed, right positive. */
export function hairpins(path: RoadPath): { d: number; turn: number }[] {
  const { curv, n, space } = path
  const w = Math.max(1, Math.round(F.hairpinWindow / 2 / space))
  const turn = new Float32Array(n)
  for (let i = 0; i < n; i++)
    for (let k = Math.max(0, i - w); k <= Math.min(n - 1, i + w); k++) turn[i] += curv[k] * space
  const out = []
  for (let i = 0; i < n; i++) {
    if (Math.abs(turn[i]) < F.hairpinTurn) continue
    // The apex is the sharpest point of this bend; the next search starts beyond it.
    let best = i
    for (let k = i; k < n && Math.abs(turn[k]) >= F.hairpinTurn; k++)
      if (Math.abs(curv[k]) > Math.abs(curv[best])) best = k
    out.push({ d: best * space, turn: turn[best] })
    i = best + 2 * w
  }
  return out
}

const metres = (m: number) => Math.round(m).toLocaleString('en-AU')

/** Every sign and arch on the route, by chunk: kilometre markers, gradient warnings, numbered hairpins, arches. */
export function planFurniture(path: RoadPath): Map<number, Furn[]> {
  const list: Furn[] = []
  const L = path.length
  for (let km = 1; km * 1000 < L - 200; km++)
    list.push({ kind: 'km', d: km * 1000, side: -1, text: `${km}\nkm` })
  for (const r of ramps(path)) {
    const len = r.d1 - r.d0
    const far = len >= 1000 ? `${(len / 1000).toFixed(1)} km` : `${Math.round(len / 50) * 50} m`
    const d = Math.max(0, r.d0 - F.gradeAhead)
    list.push({ kind: 'grade', d, side: -1, text: `${Math.round(r.grade * 100)}%\n${far}` })
  }
  // Numbered like the great climbs: counting down to the top, and only where there is a run of them.
  const pins = hairpins(path)
  if (pins.length >= F.hairpinsMin)
    pins.forEach((h, i) => {
      const at = Math.min(path.n - 1, Math.round(h.d / path.space))
      list.push({
        kind: 'hairpin',
        d: Math.max(0, h.d - F.hairpinAhead),
        side: h.turn > 0 ? -1 : 1,
        text: `${pins.length - i}\n${metres(path.y[at])} m`,
      })
    })
  let top = 0
  for (let i = 1; i < path.n; i++) if (path.y[i] > path.y[top]) top = i
  const climbs = path.y[top] - path.y[0] >= F.summitGain
  const topD = top * path.space
  const atEnd = climbs && topD > L - F.summitApart
  list.push({ kind: 'start', d: 4, side: 1, text: 'START' })
  if (climbs && !atEnd && topD > F.summitApart)
    list.push({ kind: 'summit', d: topD, side: 1, text: `SUMMIT ${metres(path.y[top])} m` })
  list.push({
    kind: atEnd ? 'summit' : 'finish',
    d: L - 4,
    side: 1,
    text: atEnd ? `SUMMIT ${metres(path.y[top])} m` : 'FINISH',
  })
  const by = new Map<number, Furn[]>()
  for (const f of list) {
    const k = Math.floor(f.d / R.chunk)
    by.set(k, [...(by.get(k) ?? []), f])
  }
  return by
}

/**
 * Rows of a patch that get a guard rail: where the ground a little way out has dropped at least `railDrop` below
 * the road edge. Short gaps are closed and short runs dropped, so rails come in sensible lengths.
 */
export function railRows(pt: Patch): Uint8Array {
  const n = pt.rows + 1
  const on = new Uint8Array(n)
  for (let j = 0; j < n; j++) {
    const c = Math.min(pt.end[j], F.railColumn)
    on[j] = c >= 2 && pt.p[pt.at(j, 0) + 1] - pt.p[pt.at(j, c) + 1] >= F.railDrop ? 1 : 0
  }
  const gap = Math.round(F.railGap / R.rowStep)
  const min = Math.round(F.railMin / R.rowStep)
  for (let j = 0; j < n; j++) {
    if (on[j]) continue
    let e = j
    while (e < n && !on[e]) e++
    if (j > 0 && e < n && e - j <= gap) on.fill(1, j, e)
    j = e
  }
  for (let j = 0; j < n; j++) {
    if (!on[j]) continue
    let e = j
    while (e < n && on[e]) e++
    // A run touching either end of the chunk may carry on next door, so it is kept whatever its length.
    if (e - j < min && j > 0 && e < n) on.fill(0, j, e)
    j = e
  }
  return on
}
