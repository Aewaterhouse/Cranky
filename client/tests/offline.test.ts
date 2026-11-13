import { describe, expect, it } from 'vitest'
import { markOffline, offlineMarks, offlineRoutes } from '../src/core/offline'

const store = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('routes saved for offline', () => {
  it('remembers the routes marked under a build, once each', () => {
    const s = store()
    expect(offlineMarks(s, 'b1')).toEqual([])
    markOffline(s, 'b1', 'mondo')
    markOffline(s, 'b1', 'nundah-crit')
    markOffline(s, 'b1', 'mondo')
    expect(offlineMarks(s, 'b1')).toEqual(['mondo', 'nundah-crit'])
  })

  it('starts again for a new build, which may load different files', () => {
    const s = store()
    markOffline(s, 'b1', 'mondo')
    expect(offlineMarks(s, 'b2')).toEqual([])
    markOffline(s, 'b2', 'beach-road')
    expect(offlineMarks(s, 'b2')).toEqual(['beach-road'])
    expect(offlineMarks(s, 'b1')).toEqual([])
  })

  it('shrugs off rubbish in storage and a full disk', () => {
    const s = store()
    s.setItem('cranky.offlineRoutes', '{nope')
    expect(offlineMarks(s, 'b1')).toEqual([])
    const full = {
      getItem: () => null,
      setItem: () =>
        void (() => {
          throw new Error('full')
        })(),
    }
    expect(() => markOffline(full, 'b1', 'mondo')).not.toThrow()
  })

  it('claims nothing where there is no service worker (tests, the dev server)', () => {
    expect(offlineRoutes()).toEqual([])
  })
})
