/**
 * Client tunables for the free ride's production layer (Phase G): the pre-ride flyover, summit and finish
 * moments, display units, the sound mix and the performance monitor. Spread into `CFG` (config.ts).
 */
export const PROD_CFG = {
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
}
