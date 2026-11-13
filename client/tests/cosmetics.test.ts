import { describe, expect, it } from 'vitest'
import { bankScrap, buy, COSMETICS, equip, TRAINER_SKIN } from '../src/core/cosmetics'
import { newProfile, type Profile } from '../src/core/curve'

describe('cosmetics', () => {
  it('catalogue has unique ids and every slot', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length)
    expect(new Set(COSMETICS.map((c) => c.slot))).toEqual(
      new Set(['paint', 'bullbar', 'spikes', 'hat', 'outfit', 'bike']),
    )
    expect(COSMETICS.find((c) => c.id === TRAINER_SKIN)?.slot).toBe('bike')
  })
  it('buys, spends scrap and equips', () => {
    const p = { ...newProfile('a'), scrap: 100 }
    const q = buy(p, 'hat-cap') as Profile
    expect(q.scrap).toBe(70)
    expect(q.owned).toEqual(['hat-cap'])
    expect(q.look.hat).toBe('hat-cap')
    expect(buy(q, 'hat-cap')).toBe('Already owned')
    expect(buy(q, 'hat-crown')).toMatch(/more scrap/)
  })
  it('equip swaps within a slot and toggles off', () => {
    let p: Profile = { ...newProfile('a'), owned: ['hat-cap', 'hat-cone'] }
    p = equip(p, 'hat-cap')
    p = equip(p, 'hat-cone')
    expect(p.look.hat).toBe('hat-cone')
    expect(equip(p, 'hat-cone').look.hat).toBeUndefined()
    expect(equip(p, 'spikes')).toBe(p)
  })
  it('banks scrap with award bonus', () => {
    expect(bankScrap(340.7, 2)).toBe(391)
  })
})
