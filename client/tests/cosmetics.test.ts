import { describe, expect, it } from 'vitest'
import { COSMETICS, equip, RARITIES, TRAINER_SKIN } from '../src/core/cosmetics'
import { newProfile } from '../src/core/curve'

describe('cosmetics', () => {
  it('catalogue has unique ids and every slot', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length)
    expect(new Set(COSMETICS.map((c) => c.slot))).toEqual(
      new Set(['paint', 'bullbar', 'spikes', 'hat', 'outfit', 'bike', 'horn']),
    )
    expect(COSMETICS.find((c) => c.id === TRAINER_SKIN)?.slot).toBe('bike')
  })
  it('every item has a rarity and every tier has items', () => {
    for (const c of COSMETICS) expect(RARITIES).toContain(c.rarity)
    for (const r of RARITIES) expect(COSMETICS.some((c) => c.rarity === r)).toBe(true)
  })
  it('equips anything free, swaps within a slot and toggles off', () => {
    let p = newProfile('a')
    p = equip(p, 'hat-cap')
    p = equip(p, 'hat-cone')
    expect(p.look.hat).toBe('hat-cone')
    expect(equip(p, 'hat-cone').look.hat).toBeUndefined()
    expect(equip(p, 'no-such-item')).toBe(p)
  })
})
