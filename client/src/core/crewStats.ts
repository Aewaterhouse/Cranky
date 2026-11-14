import type { RideStats } from '../net/protocol'

/** What an open crew card lists about a rider. Anything unknown shows "–". */
export interface CardNumbers {
  w: number
  tgt?: number | null
  cad?: number
  hr?: number | null
  hrp?: number | null
  erg?: boolean
  stats?: RideStats
  /** FTP and the weight the rider set (null: none), when the mode knows them without ride stats. */
  ftp?: number
  kg?: number | null
  /** The rider's share of the crew's work so far (0..1). */
  rideShare?: number
}

const DASH = '–'
const pct = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? DASH : `${Math.round(v * 100)}%`
const wkg = (w: number | undefined, kg: number | null | undefined) =>
  w == null || !kg ? DASH : (w / kg).toFixed(1)

/**
 * The lines on an open card: right now, then this ride. W/kg needs a weight ("–" without one); % of FTP does
 * not. `hint` asks for a weight, on my own card only.
 */
export function cardLines(r: CardNumbers, me: boolean) {
  const s = r.stats
  const ftp = r.ftp ?? s?.ftp
  const kg = r.kg !== undefined ? r.kg : s?.kg
  const now: [string, string][] = [
    ['Watts', `${Math.round(r.w)}`],
    ['Target', r.tgt ? `${r.tgt} · ${pct(r.w / r.tgt)}` : DASH],
    ['W/kg', wkg(r.w, kg)],
    ['FTP', ftp ? pct(r.w / ftp) : DASH],
    ['Cadence', r.cad == null ? DASH : `${Math.round(r.cad)}`],
    ['HR', r.hr ? `${r.hr}${r.hrp ? ` · ${pct(r.hrp)}` : ''}` : DASH],
    ['Mode', r.erg == null ? DASH : r.erg ? 'ERG' : 'Gears'],
  ]
  const ride: [string, string][] = [
    ['Avg', s ? `${Math.round(s.avg)} W` : DASH],
    ['NP', s ? `${Math.round(s.np)} W` : DASH],
    ['Avg W/kg', wkg(s?.avg, kg)],
    ['On target', pct(s?.on)],
    ['kJ', s ? `${Math.round(s.kj)}` : DASH],
    ['Falls', s ? `${s.falls}` : DASH],
    ['Share', pct(r.rideShare)],
  ]
  return { now, ride, hint: me && kg === null }
}

/** Each rider's share of all the work the crew has done this ride, from their kJ (0 for everyone at the start). */
export function rideShares(stats: Record<string, { kj: number }>) {
  const sum = Object.values(stats).reduce((a, s) => a + s.kj, 0)
  return Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, sum > 0 ? s.kj / sum : 0]))
}
