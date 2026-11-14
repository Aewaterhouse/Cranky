import CATALOGUE from '../../../content/cosmetics.json'
import { CFG } from '../config'
import type { Profile } from './curve'
import { weekOf } from './weekly'

export type Slot = 'paint' | 'bullbar' | 'spikes' | 'hat' | 'outfit' | 'bike'
export interface Cosmetic {
  id: string
  slot: Slot
  name: string
  price: number
  colour?: string
  rarity: Rarity
}
/** Rarity tiers, commonest first: they set the badge and frame of an item in the Garage. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]
/** Equipped item ids by slot, and the rider's body (see core/body.ts); what other riders see. */
/** `sash` is set by the server, never by the rider: convicted in Climate Lawsuit and not yet acquitted. */
export type Look = Partial<Record<Slot, string>> & { body?: string; sash?: boolean }

export const COSMETICS = CATALOGUE as Cosmetic[]
export const cosmetic = (id?: string) => COSMETICS.find((c) => c.id === id)
export const SLOT_NAMES: Record<Slot, string> = {
  paint: 'Bus paint',
  bullbar: 'Bull bar',
  spikes: 'Roof',
  hat: 'Hat',
  outfit: 'Outfit',
  bike: 'Bike',
}
/** The bike skin that brings your indoor trainer out on the road with you. */
export const TRAINER_SKIN = 'bike-trainer'

/** This week's deal: one rare-or-better item, stepping through them by week so everyone gets a turn. */
export function weeklyDeal(week = weekOf()): string {
  const pool = COSMETICS.filter((c) => c.rarity !== 'common').sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  return pool[(((week * 7) % pool.length) + pool.length) % pool.length].id
}

/** What an item costs this week: the deal is cheaper. */
export const priceOf = (c: Cosmetic, week = weekOf()) =>
  c.id === weeklyDeal(week) ? Math.round(c.price * (1 - CFG.garage.dealOff)) : c.price

/** Returns the updated profile, or an error message. */
export function buy(p: Profile, id: string, week = weekOf()): Profile | string {
  const c = cosmetic(id)
  if (!c) return 'Unknown item'
  if (p.owned.includes(id)) return 'Already owned'
  const price = priceOf(c, week)
  if (p.scrap < price) return `Need ${price - p.scrap} more scrap`
  return equip({ ...p, scrap: p.scrap - price, owned: [...p.owned, id] }, id)
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

/**
 * Personal scrap banked from a crew ride: a share of what the crew gathered in the ride (where it is also spent, at
 * the servo) plus a bonus per award. About 60 to 150 a ride, against a Garage of 40 to 640 an item.
 */
export const AWARD_BONUS = 25
export const BANK_SHARE = 0.1
export const bankScrap = (busScrap: number, awards: number) =>
  Math.max(0, Math.round(busScrap * BANK_SHARE)) + awards * AWARD_BONUS
/** Scrap for riding on your own (a workout or a free ride): a little a minute, nothing for a ride under 10 min. */
export const soloScrap = (secs: number) => (secs < 600 ? 0 : Math.round((secs / 60) * 1.5))
