import { PROD_CFG } from './configProd'
import { ROAD_CFG } from './configRoad'
import type { Tier } from './types'

export const CFG = {
  tierFactor: { hard: 1, medium: 0.9, easy: 0.8 } as Record<Tier, number>,
  erg: { capPct: 1.5, rampS: 2, failsafePct: 0.5, writeHz: 4, minStepW: 1, maxFails: 5 },
  ftms: { resMax: 100, replyMs: 2000, backoffMs: [1000, 2000, 4000, 5000], silentMs: 60 },
  hr: { backoffMs: [1000, 2000, 4000, 5000], rest: 60, atFtp: 175, max: 200, lagS: 30 },
  click: { backoffMs: [1000, 2000, 4000, 5000] },
  clock: { hz: 4, snapS: 1, gain: 0.2, windowS: 4, rateMin: 0.5, rateMax: 30, staleS: 3 },
  recovery: { saveMs: 5000, maxAgeMs: 30 * 60 * 1000 },
  compliance: { band: 0.05, zeroAt: 0.2, avgWindowS: 3 },
  ftpTest: {
    rampFactor: 0.75,
    rampWindowS: 60,
    twentyFactor: 0.95,
    failBelow: 0.5,
    failS: 10,
    coverage: 0.9,
  },
  sprint: { hit: 0.75, great: 0.95, mega: 1.0, comboCap: 8 },
  sprintDur: { min: 5, max: 30 },
  net: { sendHz: 2, reconnectMs: 2000 },
  curveDurations: [1, 5, 15, 30, 60, 120, 300, 600, 1200, 3600],
  defaultCurvePct: {
    1: 4.0,
    5: 3.5,
    15: 2.5,
    30: 1.8,
    60: 1.5,
    120: 1.3,
    300: 1.15,
    600: 1.1,
    1200: 1.05,
    3600: 1.0,
  } as Record<number, number>,
  crewDurations: [5, 60, 300, 1200],
  crewColours: ['#e2b93b', '#c77dff', '#ff7a59', '#5fd38d', '#ff6fb5', '#8ab4ff'],
  bestWindowDays: 90,
  ftpSuggestThreshold: 0.03,
  trends: { ctlDays: 42, atlDays: 7, fitnessDays: 90, weeks: 12, heatWeeks: 26 },
  zones: [0.55, 0.75, 0.9, 1.05, 1.2, 1.5],
  recordHz: 1,
  /** Finished rides kept on the device while the server cannot be reached, at most. */
  rideQueueMax: 5,
  /** Rides shorter than this are never saved, so never sent to Strava (the server checks too). */
  stravaMinSecs: 30,
  localStorageKey: 'zombiebus.profile',
  sim: {
    baseWatts: 150,
    baseCadence: 90,
    noiseW: 4,
    mass: 80,
    crr: 0.005,
    cda: 0.32,
    mPerRev: 0.075,
    resWatts: 1 / 30,
  },
  cueS: 8,
  extend: { minuteS: 60, easyS: 300, easyPct: 50, graceS: 20 },
  ride: { grade: [-5, 15], gradeStart: 2, resStart: 40, resStep: 5, gradeStep: 1 },
  scene: { speedMax: 22 },
  /** Synthesised sounds (ui/audio.ts, ui/rideSound.ts). Gains are 0..1 before the volume setting. */
  sound: {
    /** Lap bell: base pitch, bell-like overtones as [multiple, gain], ring time, rings on the last lap and their gap. */
    bell: {
      hz: 1320,
      partials: [
        [1, 1],
        [2.76, 0.45],
        [5.4, 0.2],
      ],
      gain: 0.12,
      ringS: 1.1,
      lastRings: 3,
      gapS: 0.28,
    },
    /** Free-ride sounds. Speeds in m/s, pitches in Hz. */
    ride: {
      /** Loudness of each kind of sound, 0..1, before the volume setting. `master` scales the lot. */
      level: {
        master: 1,
        freehub: 0.22,
        wind: 0.28,
        tyre: 0.4,
        clunk: 0.7,
        birds: 0.12,
        cicadas: 0.09,
        highWind: 0.3,
        surf: 0.5,
        gulls: 0.1,
        traffic: 0.35,
      },
      /** Seconds for bike sounds and for the sounds of the place to fade to a new level. */
      easeS: 0.25,
      bedEaseS: 2,
      /** Freehub: pawl clicks per wheel turn, silent below `minMs`, at most `maxHz` clicks a second; each click rings at `ringHz` for `clickS`; booked `aheadS` ahead. */
      freehub: { clicks: 18, minMs: 0.8, maxHz: 45, ringHz: 3400, clickS: 0.012, aheadS: 0.35 },
      /** Wind in the ears: from `fromMs` to full at `fullMs` through the air; its pitch rises `hzPerMs` up to
       *  `maxHz`, so a fast descent is a steady rush, not a rising whistle. */
      wind: { fromMs: 3, fullMs: 16, hz: 350, hzPerMs: 45, maxHz: 850, q: 0.7 },
      tyre: { fullMs: 14, hz: 110, hzPerMs: 14, q: 0.8 },
      clunk: { hz: 150, thunkS: 0.07, settleS: 0.05 },
      /** Noise beds as [filter Hz, Q, swell Hz, swell depth]: cicadas rattle fast, surf and wind swell slowly. */
      bed: {
        cicadas: [4800, 9, 46, 0.5],
        highWind: [420, 0.5, 0.13, 0.35],
        surf: [520, 0.5, 0.1, 0.45],
        traffic: [140, 0.6, 0.07, 0.25],
      },
      /** Birdsong: phrases a second at full level, notes a phrase, seconds a note, pitch range. */
      bird: { perS: 0.35, notes: [2, 5], noteS: [0.06, 0.14], hz: [2200, 4200] },
      gull: { perS: 0.12, cries: [2, 4], cryS: 0.28, hz: [1300, 1700], fall: 0.62 },
      /** How much birdsong, cicada and traffic each land cover has (letters as in scene/route/landCover.ts). */
      cover: {
        f: { birds: 1, cicadas: 0.6, traffic: 0 },
        b: { birds: 0.8, cicadas: 1, traffic: 0 },
        s: { birds: 0.3, cicadas: 0.5, traffic: 0 },
        g: { birds: 0.5, cicadas: 0.3, traffic: 0 },
        p: { birds: 0.8, cicadas: 0.3, traffic: 0.3 },
        u: { birds: 0.2, cicadas: 0, traffic: 1 },
        a: { birds: 0.1, cicadas: 0, traffic: 0 },
      },
      /** What each sky does to them: a dawn chorus, cicadas in the heat, quiet in mist and rain. */
      mood: {
        routeDawn: { birds: 1.6, cicadas: 0 },
        route: { birds: 1, cicadas: 1 },
        routeGolden: { birds: 1, cicadas: 1.3 },
        routeDusk: { birds: 0.7, cicadas: 0.8 },
        routeMist: { birds: 0.4, cicadas: 0 },
        routeShower: { birds: 0.2, cicadas: 0 },
      },
      /** Mountain wind fades in from `highFrom` to `highFull` metres up, taking the cicadas and most birds away. */
      highFrom: 900,
      highFull: 1500,
      highBirdsCut: 0.7,
      coastCicadas: 0.5,
      /** Sand or water within this far either side counts as the coast, for a rider below `coastBelow` metres (so not a dam in the hills). */
      coastM: 150,
      coastBelow: 60,
    },
  },
  /** Virtual gears (free ride and solo slope): 24 ratios spanning Zwift's range, set on a 14T Zwift Cog. */
  gears: {
    ratios: [
      0.75, 0.87, 0.99, 1.11, 1.23, 1.38, 1.53, 1.68, 1.86, 2.04, 2.22, 2.4, 2.61, 2.82, 3.03, 3.24,
      3.49, 3.74, 3.99, 4.24, 4.54, 4.84, 5.14, 5.49,
    ],
    start: 12,
    cogTeeth: 14,
    chainring: 34,
    wheelM: 2.1,
    /** Below this cadence (rpm) the trainer just gets the road's gradient. */
    minCadence: 20,
    /** Shift strength: multiplies the gear offset. Setting range and step. */
    strength: { min: 0.5, max: 3, step: 0.1, start: 1.5 },
  },
  /** TV spectator view: the HUD is laid out `designH` px tall and zoomed to fit the screen. */
  tv: { designH: 600, minZoom: 1, maxZoom: 2.4, bigSplashGrades: ['MEGA', 'LEGEND'] },
  ...ROAD_CFG,
  ...PROD_CFG,
}
