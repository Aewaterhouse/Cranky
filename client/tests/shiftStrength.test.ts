import { describe, expect, it, vi } from 'vitest'
import { CFG } from '../src/config'
import { migrate } from '../src/core/settings'

/** The settings as a device with this saved would load them. */
async function load(saved?: object) {
  const data = new Map<string, string>()
  if (saved) data.set('cranky.settings', JSON.stringify(saved))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  })
  vi.resetModules()
  return (await import('../src/core/settings')).settings
}

describe('shift strength default', () => {
  it('is 100%', async () => {
    expect(CFG.gears.strength.start).toBe(1)
    expect((await load()).shiftStrength).toBe(1)
  })
  it('gives a rider still on the old 150% default the new 100%', async () => {
    expect((await load({ volume: 0.4, shiftStrength: 1.5 })).shiftStrength).toBe(1)
    expect(migrate({ shiftStrength: 1.5000000001 })).toEqual({})
  })
  it('keeps a value the rider chose', async () => {
    for (const v of [0.5, 1.2, 2, 3])
      expect((await load({ shiftStrength: v })).shiftStrength).toBe(v)
  })
  it('keeps 150% chosen after the change, once the settings carry their version', async () => {
    expect((await load({ shiftStrength: 1.5, version: 2 })).shiftStrength).toBe(1.5)
  })
  it('keeps everything else as saved', () => {
    expect(migrate({ shiftStrength: 1.5, volume: 0.3, gfx: 'high' })).toEqual({
      volume: 0.3,
      gfx: 'high',
    })
  })
})
