import { CFG } from '../config'
import type { Profile } from './curve'

export const ZONE_NAMES = [
  'Recovery',
  'Endurance',
  'Tempo',
  'Threshold',
  'VO2 max',
  'Anaerobic',
  'Sprint',
]
export const HR_ZONE_NAMES = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'Max']
const HR_BOUNDS = [0.6, 0.7, 0.8, 0.9]

export interface PowerZone {
  z: number
  name: string
  lo: number
  /** Null for the open-ended top zone. */
  hi: number | null
}

/** Power zone upper bounds as a fraction of FTP: the rider's own, or the defaults. */
export const zoneBounds = (p: Pick<Profile, 'zoneBounds'>) =>
  p.zoneBounds?.length === CFG.zones.length ? p.zoneBounds : CFG.zones

/** Seven power zones with whole-watt ranges at `ftp`. */
export function powerZones(ftp: number, bounds: number[] = CFG.zones): PowerZone[] {
  const ups = bounds.map((b) => Math.round(b * ftp))
  return ZONE_NAMES.map((name, i) => ({
    z: i + 1,
    name,
    lo: i ? ups[i - 1] + 1 : 0,
    hi: ups[i] ?? null,
  }))
}

/** Bounds are usable when they ascend, stay between 10% and 300% of FTP and are 1% apart at least. */
export const validBounds = (b: number[]) =>
  b.length === CFG.zones.length &&
  b.every((v, i) => v >= 0.1 && v <= 3 && (!i || v >= b[i - 1] + 0.01))

export interface HrZone {
  z: number
  name: string
  lo: number
  hi: number
}

/** Five HR zones (below 60%, then 60/70/80/90% boundaries up to max). With a resting HR the bpm use heart-rate reserve. */
export function hrZones(maxHr: number, restHr?: number): HrZone[] {
  const at = (f: number) => Math.round(restHr ? restHr + f * (maxHr - restHr) : f * maxHr)
  const edges = [0, ...HR_BOUNDS, 1]
  return HR_ZONE_NAMES.map((name, i) => ({
    z: i + 1,
    name,
    lo: i ? at(edges[i]) + 1 : 0,
    hi: at(edges[i + 1]),
  }))
}

/** Watts per kilo to two decimals, or null without a weight. */
export const wkg = (w: number, kg?: number) => (kg ? Math.round((w / kg) * 100) / 100 : null)
export const wkgStr = (w: number, kg?: number) => (kg ? `${(w / kg).toFixed(2)} W/kg` : '')

/** FTP history for the chart: logged changes, plus today's FTP if it is not the last entry. */
export function ftpSeries(p: Profile, now = Date.now()) {
  const pts = (p.ftpHistory ?? []).map((x) => ({ t: Date.parse(x.date), ftp: x.ftp }))
  if (!pts.length || pts[pts.length - 1].ftp !== p.ftp) pts.push({ t: now, ftp: p.ftp })
  return pts
}
