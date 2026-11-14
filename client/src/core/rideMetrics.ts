import { CFG } from '../config'
import { normalisedPower } from './ride'

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)

export interface Extra {
  /** Variability index: NP over average power. 1.00 is perfectly steady. */
  vi: number | null
  /** Efficiency factor: NP over average heart rate. */
  ef: number | null
  /** Aerobic decoupling (Pa:HR), %: how much the power per heartbeat fell from the first half to the second. */
  drift: number | null
  /** Seconds pedalled in each cadence band: `[label, secs]`. */
  cadence: [string, number][]
  /** W′ balance: the lowest it got (J) and the share of W′ that was left then. */
  wbalMin: number | null
  wbalPct: number | null
}

/**
 * W′ balance through a ride (1 Hz), with CP taken as FTP: W′ is spent above CP and comes back below it, faster
 * the emptier it is (the differential form of Skiba's model).
 */
export function wBalance(power: number[], cp: number, wPrime: number): number[] {
  let w = wPrime
  return power.map((p) => {
    w = p > cp ? w - (p - cp) : w + ((cp - p) * (wPrime - w)) / wPrime
    return Math.min(wPrime, w)
  })
}

/** The numbers beyond NP and TSS. Each is null when the ride is too short or lacks heart rate. */
export function extraMetrics(
  power: number[],
  hr: (number | null)[],
  cadence: number[],
  ftp: number,
  wPrime = CFG.metrics.wPrimeJ,
): Extra {
  const { minSecs, driftMinSecs, hrShare, cadBands } = CFG.metrics
  const long = power.length >= minSecs
  const np = long ? normalisedPower(power) : 0
  const avg = mean(power)
  const beats = hr.filter((x): x is number => !!x)
  const withHr = long && beats.length >= power.length * hrShare
  const ef = withHr && np ? np / mean(beats) : null
  let drift: number | null = null
  if (withHr && power.length >= driftMinSecs) {
    // Leave out the first tenth (the warm-up), then compare power per beat in the two halves.
    const from = Math.floor(power.length / 10)
    const mid = from + Math.floor((power.length - from) / 2)
    const ratio = (a: number, b: number) => {
      const ps = power.slice(a, b)
      const hs = hr.slice(a, b).filter((x): x is number => !!x)
      return hs.length ? mean(ps) / mean(hs) : 0
    }
    const first = ratio(from, mid)
    const second = ratio(mid, power.length)
    drift = first ? ((first - second) / first) * 100 : null
  }
  const cad = cadBands.map((lo, i): [string, number] => {
    const hi = cadBands[i + 1]
    const secs = cadence.filter((c) => c > 0 && c >= (i ? lo : 0) && (hi == null || c < hi)).length
    return [i === 0 ? `under ${hi}` : hi == null ? `${lo}+` : `${lo}–${hi}`, secs]
  })
  const wb = long && ftp ? wBalance(power, ftp, wPrime) : []
  const wbalMin = wb.length ? Math.min(...wb) : null
  return {
    vi: long && avg ? np / avg : null,
    ef,
    drift,
    cadence: cad.slice(1).some(([, s]) => s) || cad[0][1] ? cad : [],
    wbalMin,
    wbalPct: wbalMin == null ? null : Math.max(0, wbalMin / wPrime),
  }
}
