import { CFG } from '../config'
import { speedIn, unitNames, type Units } from './units'

/** Power zone 1..6 for a fraction of FTP, on Zwift's boundaries. */
export function powerZone(frac: number) {
  const i = CFG.hud.zones.findIndex((z) => frac < z)
  return i < 0 ? CFG.hud.zones.length + 1 : i + 1
}

let cbGrades = false
/** Switches the gradient colours to the colour-blind-safe set (the Settings screen's colour switch). */
export const setGradePalette = (colourBlind: boolean) => (cbGrades = colourBlind)

/** Colour of the gradient band `pct` falls in, from the standard or the colour-blind-safe palette. */
export const gradeColour = (pct: number, colourBlind = cbGrades) =>
  (colourBlind ? CFG.hud.gradeBandsCb : CFG.hud.gradeBands).find((b) => pct < b.lt)!.colour

const mss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Gap to another rider as "+0:12" (ahead) or "-1:05" (behind) at `speed` m/s, or in metres when stopped.
 * `gapM` is their distance minus mine.
 */
export function gapText(gapM: number, speed: number) {
  const sign = gapM >= 0 ? '+' : '-'
  const m = Math.abs(gapM)
  return speed < CFG.hud.riders.movingMs
    ? `${sign}${Math.round(m)} m`
    : `${sign}${mss(Math.round(m / speed))}`
}

/** Anyone on the road, as the rider list needs them. */
export interface ListRider {
  id: string
  name: string
  /** Metres along the route. */
  d: number
  /** Watts per kilo, when known. */
  wkg?: number
  /** A best effort ridden again, not a rider. */
  ghost?: boolean
}
export interface RiderRow {
  id: string
  name: string
  wkg?: number
  /** Metres ahead of me (negative: behind). */
  gapM: number
  me: boolean
  ghost?: boolean
}

/**
 * Rows for the rider list: furthest ahead first, at most `rows`, picked around me so I sit as near the
 * middle as the bunch allows. Empty when I am alone or not in the list.
 */
export function riderRows(riders: ListRider[], meId: string, c = CFG.hud.riders): RiderRow[] {
  const me = riders.find((r) => r.id === meId)
  if (!me || riders.length < 2) return []
  const sorted = [...riders].sort((a, b) => b.d - a.d)
  const at = sorted.indexOf(me)
  const from = Math.max(0, Math.min(at - Math.floor(c.rows / 2), sorted.length - c.rows))
  return sorted.slice(from, from + c.rows).map((r) => ({
    id: r.id,
    name: r.name.length > c.nameChars ? `${r.name.slice(0, c.nameChars - 1)}…` : r.name,
    wkg: r.wkg,
    gapM: r.d - me.d,
    me: r === me,
    ghost: r.ghost,
  }))
}

export type Tol = 'ok' | 'warn' | 'bad'
/**
 * How far `power` is off `target`: green inside the compliance band, amber out to `tol.warn`, red beyond.
 * `pos` is where the needle sits on the bar, 0 (far under) to 1 (far over).
 */
export function tolerance(power: number, target: number, c = CFG.hud.tol) {
  const dev = (power - target) / target
  const a = Math.abs(dev)
  const state: Tol = a <= CFG.compliance.band ? 'ok' : a <= c.warn ? 'warn' : 'bad'
  return { state, dev, pos: 0.5 + Math.max(-c.span, Math.min(c.span, dev)) / c.span / 2 }
}

/** "on target", or which way to go and by how many watts. Words, so colour is not the only cue. */
export function tolText(power: number, target: number) {
  const d = Math.round(power - target)
  return tolerance(power, target).state === 'ok'
    ? 'on target'
    : `${d > 0 ? '▼ ease' : '▲ push'} ${Math.abs(d)} W`
}

/** A rest: a free block, or a target in zone 1. The "Next" chip stays up through these. */
export const isRest = (type: string, target: number | null, ftp: number) =>
  type === 'free' || (type !== 'sprint' && target != null && target < ftp * CFG.hud.zones[0])

/** The "Next" chip: "Next: 5:00 at 320 W". A sprint or free block never names a power. */
export function nextText(next: { type: string; tgt: number | null }, durS: number) {
  const m = `${Math.floor(durS / 60)}:${String(Math.round(durS % 60)).padStart(2, '0')}`
  return next.type === 'sprint'
    ? `Next: ${m} sprint, all out`
    : next.tgt == null
      ? `Next: ${m} free ride`
      : `Next: ${m} at ${next.tgt} W`
}

/** The pop-up after an effort: average power, watts off the target and the share of seconds in the band. */
export const effortSummary = (b: {
  secs: number
  avgPower: number
  avgTarget: number
  inBandSecs: number
}) => ({
  avg: b.avgPower,
  off: b.avgPower - b.avgTarget,
  inBand: b.secs ? b.inBandSecs / b.secs : 0,
})

/** Which `rows` of `n` list entries to show so entry `at` sits one from the top (the last one done stays in view). */
export function listWindow(n: number, at: number, rows = CFG.hud.intervalRows) {
  const from = Math.max(0, Math.min(at - 1, n - rows))
  return [from, Math.min(n, from + rows)] as const
}

/** Wind along the road for the stats drawer: "Head 11 km/h", "Tail 6 km/h" or "Still". */
export function windText(ms: number, units: Units = 'metric') {
  const v = Math.round(speedIn(Math.abs(ms), units))
  return v < 1 ? 'Still' : `${ms > 0 ? 'Head' : 'Tail'} ${v} ${unitNames(units).speed}`
}

/**
 * The bus's warning before a target change: the seconds left (whole, counting down from `busWarnS`) and what is
 * coming. Nothing when the target stays the same, and nothing before a sprint, which has its own countdown.
 */
export function busWarn(
  f: { tgt: number | null; next?: { type: string; in: number; tgt: number | null } },
  warnS = CFG.hud.busWarnS,
) {
  const n = f.next
  if (!n || n.type === 'sprint' || n.tgt === f.tgt || n.in > warnS || n.in <= 0) return null
  return { s: Math.ceil(n.in), text: n.tgt == null ? 'Next: free ride' : `Next: ${n.tgt} W` }
}

/** The bus's score to send: none in a block with no target, or in the first `busGraceS` seconds of a block. */
export const busScore = (f: { tgt: number | null; bel: number } | null, c: number | null) =>
  f?.tgt && f.bel >= CFG.hud.busGraceS ? c : null

/**
 * Each riding rider's share of the crew's watts, and who is carrying the most while anyone is off the bus
 * (nobody when everyone is on it).
 */
export function crewShares(riders: Record<string, { w: number; st: string }>) {
  const on = Object.entries(riders).filter(([, r]) => r.st === 'riding')
  const sum = on.reduce((a, [, r]) => a + r.w, 0)
  const share: Record<string, number> = {}
  for (const [id, r] of on) share[id] = sum > 0 ? r.w / sum : 0
  const fell = Object.values(riders).some((r) => r.st === 'fell')
  const top = on.length > 1 && sum > 0 ? on.reduce((a, b) => (b[1].w > a[1].w ? b : a))[0] : null
  return { share, carrier: fell ? top : null }
}

/** The banner while targets are raised: who is off and what it costs everyone else. */
export function loadBanner(load: number | undefined, fallen: string[]) {
  if (!load || load <= 1 || !fallen.length) return ''
  const who = fallen.length === 1 ? `${fallen[0]} is` : `${fallen.length} riders are`
  return `${who} off the bus: everyone else +${Math.round((load - 1) * 100)}% until they're hauled back`
}
