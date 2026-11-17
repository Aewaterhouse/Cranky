import CATALOGUE from '../../../content/cosmetics.json'
import type { Profile } from './curve'

export type Slot = 'paint' | 'bullbar' | 'spikes' | 'hat' | 'outfit' | 'bike' | 'horn'
export interface Cosmetic {
  id: string
  slot: Slot
  name: string
  colour?: string
  rarity: Rarity
}
/** Rarity tiers, commonest first: they set the badge and frame of an item in the Garage. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]
/** Equipped item ids by slot, and the rider's body (see core/body.ts); what other riders see. */
export type Look = Partial<Record<Slot, string>> & { body?: string }

export const COSMETICS = CATALOGUE as Cosmetic[]
export const cosmetic = (id?: string) => COSMETICS.find((c) => c.id === id)
export const SLOT_NAMES: Record<Slot, string> = {
  paint: 'Bus paint',
  bullbar: 'Bull bar',
  spikes: 'Roof',
  hat: 'Hat',
  outfit: 'Outfit',
  bike: 'Bike',
  horn: 'Horn',
}
/** The bike skin that brings your indoor trainer out on the road with you. */
export const TRAINER_SKIN = 'bike-trainer'

/** Equips an item (every item is free to wear), or unequips it if already equipped. */
export function equip(p: Profile, id: string): Profile {
  const c = cosmetic(id)
  if (!c) return p
  const look = { ...p.look }
  if (look[c.slot] === id) delete look[c.slot]
  else look[c.slot] = id
  return { ...p, look }
}
