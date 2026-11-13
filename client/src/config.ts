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
  },
  /** TV spectator view: the HUD is laid out `designH` px tall and zoomed to fit the screen. */
  tv: { designH: 600, minZoom: 1, maxZoom: 2.4, bigSplashGrades: ['MEGA', 'LEGEND'] },
  /** Free-ride HUD. Zone colours come from the shared palette in ui/planGraph.ts (colour-blind aware). */
  hud: {
    /** Zwift's power zone boundaries as fractions of FTP: Z1 below the first, Z6 from the last. */
    zones: [0.6, 0.76, 0.9, 1.05, 1.19],
    /** Gradient bands: the colour applies below `lt` %. */
    gradeBands: [
      { lt: -3, colour: '#4a9be8' },
      { lt: 2, colour: '#8fa893' },
      { lt: 5, colour: '#5fc34a' },
      { lt: 8, colour: '#f2d60a' },
      { lt: 11, colour: '#ff9f1c' },
      { lt: 15, colour: '#ff5a4e' },
      { lt: Infinity, colour: '#b0174f' },
    ],
    /** The gradient readout shows at or beyond this many % either way. */
    gradeShowPct: 2,
    /** A climb averages `minPct` or more for at least `minM`; dips below `minPct` shorter than `dipM` do not end it. */
    climb: { minPct: 3, minM: 300, dipM: 100, leadM: 150, aheadM: 900, behindM: 100 },
    /** Rider list: rows shown, name length, and the speed (m/s) below which gaps are in metres. */
    riders: { rows: 7, nameChars: 10, movingMs: 1 },
    toastS: 3,
    /** Screens this short or shorter (CSS px) start without the minimap and rider list; freeHud.css uses the same number. */
    phoneMaxH: 500,
    /** No ETA to the top below this speed (m/s). */
    etaMinMs: 1,
  },
  freeRide: {
    defaultKg: 75,
    bikeKg: 9,
    crr: 0.004,
    cda: 0.32,
    rho: 1.225,
    drivetrain: 0.975,
    maxMs: 22,
    maxDriveN: 600,
    difficulty: 0.5,
    /** Range sent to the trainer, in %. */
    grade: [-10, 20],
    sendEveryS: 1,
    sendDeltaPct: 0.2,
    spacingM: 10,
    smoothM: 100,
    maxGradePct: 20,
    maxStored: 4000,
    ftpFrac: 0.75,
    /** `?ghosts=N` dev riders: steady efforts spread over `ftp` (fractions of the rider's FTP), starting `gapM` apart. */
    ghosts: {
      names: [
        'Bluey',
        'Shazza',
        'Davo',
        'Macca',
        'Kylie the Unstoppable',
        'Nugget',
        'Robbo',
        'Jules',
      ],
      ftp: [0.6, 0.95],
      gapM: 15,
      cadence: 85,
    },
    library: {
      /** Length filter bounds in km: short below `short`, long from `long`. */
      lengthKm: { short: 25, long: 60 },
      /** Climb in metres needed for difficulty 2 to 5; an average gradient of `steepPct` or more adds one. */
      gainForLevel: [150, 400, 800, 1400],
      steepPct: 6,
    },
  },
}
