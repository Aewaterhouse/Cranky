import { CFG } from '../config'

/** Power zone 1..6 for a fraction of FTP, on Zwift's boundaries. */
export function powerZone(frac: number) {
  const i = CFG.hud.zones.findIndex((z) => frac < z)
  return i < 0 ? CFG.hud.zones.length + 1 : i + 1
}

/** Colour of the gradient band `pct` falls in. */
export const gradeColour = (pct: number) => CFG.hud.gradeBands.find((b) => pct < b.lt)!.colour

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
}
export interface RiderRow {
  id: string
  name: string
  wkg?: number
  /** Metres ahead of me (negative: behind). */
  gapM: number
  me: boolean
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
  }))
}

/** Wind along the road for the stats drawer: "Head 11 km/h", "Tail 6 km/h" or "Still". */
export function windText(ms: number) {
  const kmh = Math.round(Math.abs(ms) * 3.6)
  return kmh < 1 ? 'Still' : `${ms > 0 ? 'Head' : 'Tail'} ${kmh} km/h`
}
