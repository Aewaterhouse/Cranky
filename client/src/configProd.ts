/**
 * Client tunables for the free ride's production layer (Phase G): the pre-ride flyover, summit and finish
 * moments, display units, the sound mix and the performance monitor. Spread into `CFG` (config.ts).
 */
export const PROD_CFG = {
  /** Display units: storage and maths stay metric. */
  units: { mphPerMs: 2.236936, mPerMile: 1609.344, ftPerM: 3.28084, lbPerKg: 2.204623 },
  /** Camera distance setting: the chase camera's distance behind and height are scaled by this. */
  camDist: { near: 0.7, standard: 1, far: 1.5 },
  /** The pre-ride flyover and its card. */
  intro: {
    /** The sweep lasts this long (s) over `spanM` of road; without a 3D world the card alone stays `cardS`. */
    secs: 7,
    spanM: 600,
    cardS: 3.5,
    /** A climb is worth flying over from this much gain (m); otherwise the steepest stretch from `steepPct`. */
    minGainM: 60,
    steepPct: 2.5,
    /** Two or more hairpins this close together (m) are a stack, and beat the summit. */
    stackM: 500,
    /** Group rides: the camera is back behind the rider with this much of the countdown left (s). */
    settleS: 3,
    /** Points in the card's mini profile. */
    profilePts: 80,
  },
  /** Summit and finish moments. */
  moments: {
    /** A top this close to the finish (m) gets no moment of its own. */
    nearFinishM: 300,
    /** The turn round the rider and how long the stats card stays (s). */
    orbitS: 5,
    cardS: 7,
    /** A solo ride shows its results this long after the line (s), so the finish can be enjoyed. */
    finishHoldS: 6,
  },
}
