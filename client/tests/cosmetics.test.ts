import { describe, expect, it } from 'vitest'
import {
  bankScrap,
  priceOf,
  weeklyDeal,
  soloScrap,
  buy,
  COSMETICS,
  equip,
  RARITIES,
  TRAINER_SKIN,
} from '../src/core/cosmetics'
import { newProfile, type Profile } from '../src/core/curve'

describe('cosmetics', () => {
  it('catalogue has unique ids and every slot', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length)
    expect(new Set(COSMETICS.map((c) => c.slot))).toEqual(
      new Set(['paint', 'bullbar', 'spikes', 'hat', 'outfit', 'bike']),
    )
    expect(COSMETICS.find((c) => c.id === TRAINER_SKIN)?.slot).toBe('bike')
  })
  it('every item has a rarity, rarer never cheaper, and every tier has items', () => {
    for (const c of COSMETICS) expect(RARITIES).toContain(c.rarity)
    const top = (r: string) =>
      Math.max(...COSMETICS.filter((c) => c.rarity === r).map((c) => c.price))
    const low = (r: string) =>
      Math.min(...COSMETICS.filter((c) => c.rarity === r).map((c) => c.price))
    for (let i = 1; i < RARITIES.length; i++)
      expect(low(RARITIES[i])).toBeGreaterThan(top(RARITIES[i - 1]))
  })
  it('buys, spends scrap and equips', () => {
    const p = { ...newProfile('a'), scrap: 100 }
    const q = buy(p, 'hat-cap') as Profile
    expect(q.scrap).toBe(100 - COSMETICS.find((c) => c.id === 'hat-cap')!.price)
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
  it('banks a share of the crew scrap, with an award bonus', () => {
    expect(bankScrap(340.7, 2)).toBe(34 + 50)
    expect(bankScrap(1187, 0)).toBe(119)
  })
  it('pays a solo ride by the minute, nothing under ten minutes', () => {
    expect(soloScrap(9 * 60)).toBe(0)
    expect(soloScrap(45 * 60)).toBe(68)
  })
})

describe('deal of the week', () => {
  it('takes a share off one rare-or-better item that changes week to week', () => {
    const deals = new Set(Array.from({ length: 8 }, (_, w) => weeklyDeal(w)))
    expect(deals.size).toBeGreaterThan(4)
    const deal = COSMETICS.find((c) => c.id === weeklyDeal(3))!
    expect(deal.rarity).not.toBe('common')
    expect(priceOf(deal, 3)).toBeLessThan(deal.price)
    const p = { ...newProfile('a'), scrap: priceOf(deal, 3) }
    expect((buy(p, deal.id, 3) as Profile).scrap).toBe(0)
    expect(buy(p, deal.id, 4)).toMatch(/more scrap/)
  })
})
