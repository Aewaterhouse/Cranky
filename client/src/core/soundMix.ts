import { CFG } from '../config'

const S = CFG.sound.ride
const clamp = (v: number) => Math.min(1, Math.max(0, v))

/** The ground the rider is passing: land cover letter (see scene/route/landCover.ts), height, sand or water nearby. */
export interface Place {
  cover: string
  y: number
  coast: boolean
}

/** How loud each ambient bed should be, 0..1 before its level in the config. */
export interface Beds {
  birds: number
  cicadas: number
  highWind: number
  surf: number
  gulls: number
  traffic: number
}

/** Freehub clicks a second: the wheel's turns times the pawls, capped so it buzzes rather than whines. 0 unless coasting. */
export const freehubHz = (speed: number, coasting: boolean) =>
  coasting && speed > S.freehub.minMs
    ? Math.min(S.freehub.maxHz, (speed / CFG.gears.wheelM) * S.freehub.clicks)
    : 0

/** Wind in the ears, 0..1: nothing at a crawl, rising with the square of the speed through the air. */
export const windGain = (speed: number, headwind = 0) =>
  clamp((speed + headwind - S.wind.fromMs) / (S.wind.fullMs - S.wind.fromMs)) ** 2

/** The wind's pitch (filter centre, Hz) climbs with the speed through the air. */
export const windHz = (speed: number, headwind = 0) =>
  S.wind.hz + Math.max(0, speed + headwind) * S.wind.hzPerMs

/** Tyre hum, 0..1: there as soon as the wheels turn, levelling off at speed. */
export const tyreGain = (speed: number) => Math.sqrt(clamp(speed / S.tyre.fullMs))

export const tyreHz = (speed: number) => S.tyre.hz + Math.max(0, speed) * S.tyre.hzPerMs

/**
 * The sounds of a place under a sky: birds and cicadas in the bush, wind up high, surf and gulls by the sea,
 * a murmur of traffic in town. Cicadas want warmth, so none at dawn, in mist, in rain or in the mountains.
 */
export function beds(p: Place, mood: string): Beds {
  const c = (S.cover as Record<string, { birds: number; cicadas: number; traffic: number }>)[
    p.cover
  ] ?? { birds: 0, cicadas: 0, traffic: 0 }
  const m = (S.mood as Record<string, { birds: number; cicadas: number }>)[mood] ?? {
    birds: 1,
    cicadas: 1,
  }
  const high = clamp((p.y - S.highFrom) / (S.highFull - S.highFrom))
  const sea = p.coast && p.y < S.coastBelow
  return {
    birds: clamp(c.birds * m.birds * (1 - S.highBirdsCut * high)),
    cicadas: clamp(c.cicadas * m.cicadas * (1 - high) * (sea ? S.coastCicadas : 1)),
    highWind: high,
    surf: sea ? 1 : 0,
    gulls: sea ? 1 : 0,
    traffic: clamp(c.traffic),
  }
}
