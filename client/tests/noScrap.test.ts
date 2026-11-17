import { describe, expect, it } from 'vitest'
import { newProfile } from '../src/core/curve'
import { RideRecorder } from '../src/core/ride'
import { cardLine } from '../src/ui/resultsGroup'
import { rideRewards } from '../src/ui/resultsRewards'
import type { GroupSummary } from '../src/ui/resultsViews'

// A bus ride saved before scrap went: its summary and the rider's profile still carry the old keys.
const old = {
  distance: 15300,
  armour: 64,
  syncPct: 71,
  scrap: 412,
  score: 1234,
  riders: [{ id: 'me', name: 'Me', compliance: 0.9, inBandSecs: 600, sprints: [], falls: 0 }],
  awards: [{ award: 'Iron Lungs', id: 'me', name: 'Me', why: '90% compliance' }],
} as unknown as GroupSummary

describe('rides saved with scrap', () => {
  it('still make a postcard line, without the scrap', () => {
    expect(cardLine(old, 'Lunch Break Quickie')).toBe(
      'Lunch Break Quickie · 15.3 km · armour 64 · sync 71%',
    )
  })

  it('earn the ride as before and leave an old balance alone, unread', () => {
    const rec = new RideRecorder(
      { id: 'b', name: 'Bus', blocks: [{ type: 'steady' as const, dur: 1200 }] },
      200,
    )
    for (let i = 0; i < 1200; i++) rec.sample(0, 250, 90, 180, 1, true, null)
    const p = { ...newProfile('me', 'Me', 200), scrap: 90, owned: ['hat-cap'] }
    const r = rideRewards(p, rec.summary(), old)
    expect(r.p.stats.rides).toBe(1)
    expect(r.p).toMatchObject({ scrap: 90, owned: ['hat-cap'] })
    expect(JSON.stringify(r)).not.toMatch(/banked|myAwards/)
  })
})
