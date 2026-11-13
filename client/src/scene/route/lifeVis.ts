import type { OddDef } from './funVis'

/** Wildlife and traffic (shapes in lifeGeo.ts, behaviour in life.ts). Speeds in m/s, times in seconds. Shown in the debug panel as `VIS.route.place.fun.life`. */
export const LIFE = {
  /** Chance a 200 m chunk has a mob or flock, a magpie, or something coming the other way. */
  chance: 0.5,
  magpieChance: 0.07,
  trafficChance: 0.12,
  tries: 4,
  endClear: 100,
  coastProbe: 70,
  slope: 0.5,
  share: { potato: 0.4, low: 0.7, medium: 1, high: 1 },
  /** Herds are laid out this many chunks ahead, at most this many of a kind at once, and re-seated this often. */
  chunksAhead: 2,
  herdsShown: 3,
  relayS: 1,
  /** Kangaroo mobs are this much bigger at dawn and dusk. */
  duskMobs: 1.6,
  /** Roos bolt when the rider is this close, hopping this fast, far and high. */
  spook: 38,
  hopMs: 7,
  hopLen: 2.6,
  hopH: 0.9,
  fleeM: 45,
  /** Cattle turn to watch within this distance. */
  watch: 45,
  /** Flocks burst when the rider is this close, then fly and climb at these speeds for this long. */
  burst: 26,
  flyMs: 7,
  riseMs: 1.3,
  flyS: 12,
  /** Share of flocks that start up in the branches, and how high. */
  perchShare: 0.35,
  perch: 5,
  /** Gulls wheel at this radius, height and speed. */
  gullR: 9,
  gullH: 9,
  gullMs: 5,
  /** A crossing starts when the rider is this far short of it and ends this far off the other side. */
  cross: 55,
  crossTo: 11,
  wombatMs: 1.3,
  lyreMs: 2.4,
  /** The magpie strikes within this of its tree: this many passes over this long, this far, low and high. */
  swoop: 25,
  swoopS: 11,
  swoopPasses: 3,
  swoopM: 8,
  swoopLow: 2.2,
  swoopHigh: 4.5,
  /** Oncoming traffic appears this far ahead in this lane (m right of centre), and is dropped this far behind. */
  trafficSee: 280,
  trafficMs: 9,
  trafficLane: 1.7,
  trafficGone: 90,
  towGap: 5.4,
  /** Routes that reach this height (m) get tourist coaches. */
  coachAbove: 1000,
  /** A herd is "nearby" for remarks within this, and "happening" for this long after it is set off. */
  noticeM: 45,
  eventS: 6,
  /** Per kind: weight, ground, metres beyond the verge, spread radius, and how many. */
  kinds: {
    roos: { w: 3, on: 'gbs', near: 12, far: 38, r: 7, min: 3, max: 6 },
    cows: { w: 3, on: 'g', near: 10, far: 35, r: 9, min: 3, max: 6 },
    sheep: { w: 3, on: 'g', near: 10, far: 35, r: 8, min: 5, max: 9 },
    cockatoos: { w: 2.5, on: 'fbpg', near: 3, far: 12, r: 3, min: 4, max: 7 },
    galahs: { w: 2, on: 'gsup', near: 3, far: 12, r: 3, min: 4, max: 7 },
    seagulls: { w: 9, on: 'agbsup', near: 6, far: 25, r: 8, min: 4, max: 7, coast: 1 },
    wombat: { w: 1, on: 'fbs', near: 1.5, far: 1.5, r: 1, min: 1, max: 1, snow: 0 },
    lyrebird: { w: 1, on: 'f', near: 1.5, far: 1.5, r: 1, min: 1, max: 1 },
    magpie: { w: 0, on: 'upbgf', near: 0, far: 0, r: 0, min: 1, max: 1 },
    ute: { w: 3, on: '', near: 0, far: 0, r: 0, min: 1, max: 1 },
    caravan: { w: 2, on: '', near: 0, far: 0, r: 0, min: 1, max: 1 },
    coach: { w: 2.5, on: '', near: 0, far: 0, r: 0, min: 1, max: 1 },
  } satisfies Record<string, OddDef & { min: number; max: number }>,
  utes: ['#d8d2bf', '#b3261e', '#2f5f8a', '#e9e6dc'],
  col: {
    roo: '#9a7b5f',
    rooBelly: '#cbb89c',
    cow: '#f1efe8',
    cowPatch: '#26262a',
    udder: '#e9a6a6',
    sheep: '#ece8dc',
    cockatoo: '#f6f5ee',
    crest: '#f2d43a',
    galah: '#ee8fa6',
    galahCrest: '#f9d3dc',
    galahWing: '#9aa0a8',
    gull: '#f4f4f0',
    gullWing: '#aab2ba',
    lyre: '#6b5340',
    lyreTail: '#3d3027',
    glass: '#3c5566',
    stripe: '#2f7fc4',
    paint: '#ffffff',
    lamp: '#ffeeaa',
    black: '#1c1c1f',
  },
}
