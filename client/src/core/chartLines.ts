import { CFG } from '../config'

/** Which extra lines the solo workout chart draws, remembered on this device. */
export interface ChartLines {
  cadence: boolean
  hr: boolean
}
const key = () => `${CFG.localStorageKey}.chartLines`

export function loadLines(): ChartLines {
  try {
    return {
      cadence: true,
      hr: true,
      ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as object),
    }
  } catch {
    return { cadence: true, hr: true }
  }
}

export function toggleLine(l: ChartLines, k: keyof ChartLines) {
  l[k] = !l[k]
  try {
    localStorage.setItem(key(), JSON.stringify(l))
  } catch {
    /* storage full: it is only a preference */
  }
  return l[k]
}

/** What the chart draws: the heart-rate line only with a strap paired. */
export const chartSeries = (l: ChartLines, strap: boolean) => ({
  showCadence: l.cadence,
  showHr: l.hr && strap,
})
