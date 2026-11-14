import { hash } from '../math'
import type { MoodDef } from '../params'

/** Tunables for choosing a free ride's time of day and weather. Shown in the debug panel under the route world. */
export const MOOD = {
  /** `auto` goes by the clock on the wall; any mood name pins it. */
  pick: 'auto',
  /** Local hours where dawn gives way to midday, midday to golden hour, golden hour to dusk, and dusk to dawn. */
  dawnFrom: 4.5,
  dayFrom: 8,
  goldenFrom: 15.5,
  duskFrom: 20,
  /** Mist sits above this height (m) on this share of days. */
  mistAbove: 1000,
  mistChance: 0.6,
  /** A shower may pass every `showerEveryS` of riding, with this chance, lasting `showerS`. Never in the first one. */
  showerEveryS: 600,
  showerChance: 0.3,
  showerS: 150,
  /** Rain: streaks, the box they fall through (m), their length, speed (m/s) and lean with the wind. */
  drops: 260,
  rainBox: 26,
  rainLen: 0.9,
  rainMs: 16,
  rainLean: 0.18,
  rainTint: '#cfd9e2',
}

export const ROUTE_MOODS = [
  'route',
  'routeDawn',
  'routeGolden',
  'routeDusk',
  'routeMist',
  'routeShower',
]

/** The free ride's skies besides plain midday (`route` in params.ts). */
export const ROUTE_MOOD_DEFS: Record<string, MoodDef> = {
  routeDawn: {
    sky: '#7fa8d8',
    fog: '#f3d9c4',
    light: '#ffd9b0',
    hemi: '#d8dcf0',
    ground: '#7a9a58',
    hill: '#8a8fb0',
    sunI: 1.9,
    hemiI: 0.95,
    sunElev: 10,
    sunAz: 60,
    sunSize: 0.05,
    head: 0,
    stars: 0,
    fogFar: 700,
  },
  routeGolden: {
    sky: '#5f9be0',
    fog: '#f6dfb8',
    light: '#ffcf8a',
    hemi: '#e8dcc8',
    ground: '#8aa850',
    hill: '#a08a7a',
    sunI: 2.4,
    hemiI: 1,
    sunElev: 16,
    sunAz: -60,
    sunSize: 0.05,
    head: 0,
    stars: 0,
    fogFar: 1000,
  },
  routeDusk: {
    sky: '#4f63a8',
    fog: '#f0b496',
    light: '#ffa874',
    hemi: '#c4c0e4',
    ground: '#7a8a62',
    hill: '#7a6f98',
    sunI: 1.8,
    hemiI: 1.35,
    sunElev: 5,
    sunAz: -70,
    sunSize: 0.008,
    head: 0.3,
    stars: 0.15,
    fogFar: 900,
  },
  routeMist: {
    sky: '#c8d2d8',
    fog: '#dfe5e8',
    light: '#f0f2f4',
    hemi: '#e0e6ea',
    ground: '#7a9068',
    hill: '#b8c2c8',
    sunI: 1.1,
    hemiI: 1.3,
    sunElev: 35,
    sunAz: -35,
    sunSize: 0.03,
    head: 0,
    stars: 0,
    fogFar: 170,
  },
  routeShower: {
    sky: '#7f8c99',
    fog: '#aab4bc',
    light: '#dfe6ee',
    hemi: '#c8d0d8',
    ground: '#6a8058',
    hill: '#7a8894',
    sunI: 0.9,
    hemiI: 1.2,
    sunElev: 40,
    sunAz: -35,
    sunSize: 0.02,
    head: 0,
    stars: 0,
    fogFar: 420,
  },
}

/** The time-of-day mood for a local clock hour (0..24): dawn, midday, golden hour, or dusk through the night. */
export function moodForHour(hour: number): string {
  if (hour >= MOOD.dawnFrom && hour < MOOD.dayFrom) return 'routeDawn'
  if (hour >= MOOD.dayFrom && hour < MOOD.goldenFrom) return 'route'
  return hour >= MOOD.goldenFrom && hour < MOOD.duskFrom ? 'routeGolden' : 'routeDusk'
}

/**
 * The mood for this moment of a ride: the pinned one if there is one, otherwise a passing shower when one is due,
 * mist when the rider is up high on a misty day, and failing those the time of day. `seed` is the route's and
 * `day` any number that changes daily, so a route's weather differs from day to day but not from rider to rider.
 */
export function pickMood(
  hour: number,
  y: number,
  rideS: number,
  seed: number,
  day: number,
): string {
  if (MOOD.pick !== 'auto') return MOOD.pick
  const slot = Math.floor(rideS / MOOD.showerEveryS)
  const wet = slot > 0 && hash(seed * 0.001 + day * 7.3 + slot * 3.1) < MOOD.showerChance
  if (wet && rideS - slot * MOOD.showerEveryS < MOOD.showerS) return 'routeShower'
  if (y > MOOD.mistAbove && hash(seed * 0.002 + day * 1.7) < MOOD.mistChance) return 'routeMist'
  return moodForHour(hour)
}
