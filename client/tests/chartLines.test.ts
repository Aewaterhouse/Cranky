import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CFG } from '../src/config'
import { chartSeries, loadLines, toggleLine } from '../src/core/chartLines'

describe('the workout chart lines', () => {
  let data: Map<string, string>
  beforeEach(() => {
    data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    })
  })

  it('shows cadence and heart rate by default', () => {
    expect(loadLines()).toEqual({ cadence: true, hr: true })
    expect(chartSeries(loadLines(), true)).toEqual({ showCadence: true, showHr: true })
  })

  it('hides heart rate with no strap paired, whatever the toggle says', () => {
    expect(chartSeries({ cadence: true, hr: true }, false)).toEqual({
      showCadence: true,
      showHr: false,
    })
  })

  it('remembers each toggle on this device', () => {
    const l = loadLines()
    expect(toggleLine(l, 'cadence')).toBe(false)
    expect(loadLines()).toEqual({ cadence: false, hr: true })
    toggleLine(l, 'hr')
    toggleLine(l, 'cadence')
    expect(loadLines()).toEqual({ cadence: true, hr: false })
    expect(chartSeries(loadLines(), true)).toEqual({ showCadence: true, showHr: false })
  })

  it('falls back to the defaults on a broken saved value', () => {
    data.set(`${CFG.localStorageKey}.chartLines`, '{oops')
    expect(loadLines()).toEqual({ cadence: true, hr: true })
  })

  it('uses the cadence and heart-rate colours seen elsewhere, distinct from each other', () => {
    expect(CFG.chartLines.cadColour).toBe('#4cc9f0')
    expect(CFG.chartLines.hrColour).toBe('#ff6b81')
  })
})
