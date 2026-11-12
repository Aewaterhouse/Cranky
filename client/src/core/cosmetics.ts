import CATALOGUE from '../../../content/cosmetics.json'
import type { Profile } from './curve'

export type Slot = 'paint' | 'bullbar' | 'spikes' | 'hat' | 'outfit'
export interface Cosmetic {
  id: string
  slot: Slot
  name: string
  price: number
  colour?: string
}
/** Equipped item ids by slot; what other riders see. */
export type Look = Partial<Record<Slot, string>>

export const COSMETICS = CATALOGUE as Cosmetic[]
export const cosmetic = (id?: string) => COSMETICS.find((c) => c.id === id)
export const SLOT_NAMES: Record<Slot, string> = {
  paint: 'Bus paint',
  bullbar: 'Bull bar',
  spikes: 'Roof',
  hat: 'Hat',
  outfit: 'Outfit',
}

/** Returns the updated profile, or an error message. */
export function buy(p: Profile, id: string): Profile | string {
  const c = cosmetic(id)
  if (!c) return 'Unknown item'
  if (p.owned.includes(id)) return 'Already owned'
  if (p.scrap < c.price) return `Need ${c.price - p.scrap} more scrap`
  return equip({ ...p, scrap: p.scrap - c.price, owned: [...p.owned, id] }, id)
}

/** Equips an owned item, or unequips it if already equipped. */
export function equip(p: Profile, id: string): Profile {
  const c = cosmetic(id)
  if (!c || !p.owned.includes(id)) return p
  const look = { ...p.look }
  if (look[c.slot] === id) delete look[c.slot]
  else look[c.slot] = id
  return { ...p, look }
}

/** Personal scrap earned from a crew ride: the bus haul plus a bonus per award. */
export const AWARD_BONUS = 25
export const bankScrap = (busScrap: number, awards: number) =>
  Math.max(0, Math.round(busScrap)) + awards * AWARD_BONUS
