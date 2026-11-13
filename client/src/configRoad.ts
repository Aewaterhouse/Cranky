/**
 * Client tunables for free ride and group rides: the HUD, the ride itself, segments, the passport, weekly goals
 * and the road. Spread into `CFG` (config.ts), which is the only thing other modules import.
 */
export const ROAD_CFG = {
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
    /** The same bands in colours that stay apart with red-green colour blindness (the Okabe-Ito set), light to strong. */
    gradeBandsCb: [
      { lt: -3, colour: '#56b4e9' },
      { lt: 2, colour: '#a9a9a9' },
      { lt: 5, colour: '#f0e442' },
      { lt: 8, colour: '#e69f00' },
      { lt: 11, colour: '#d55e00' },
      { lt: 15, colour: '#cc79a7' },
      { lt: Infinity, colour: '#ffffff' },
    ],
    /** The gradient readout shows at or beyond this many % either way. */
    gradeShowPct: 2,
    /** A climb averages `minPct` or more for at least `minM`; dips below `minPct` shorter than `dipM` do not end it. */
    climb: { minPct: 3, minM: 300, dipM: 100, leadM: 150, aheadM: 900, behindM: 100 },
    /** Rider list: rows shown, name length, and the speed (m/s) below which gaps are in metres. */
    riders: { rows: 7, nameChars: 10, movingMs: 1 },
    toastS: 3,
    /** A PR or crew-best toast stays this long. */
    toastBigS: 7,
    /** Screens this short or shorter (CSS px) start without the minimap and rider list; freeHudDock.css uses the same number. */
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
    /** Auto-pause after `stopS` s all but halted (under `haltMs` m/s); riding again after `goS` s of pedalling. */
    autoPause: { stopS: 3, goS: 1.5, haltMs: 2 },
    /** Range sent to the trainer, in %. */
    grade: [-10, 20],
    sendEveryS: 1,
    sendDeltaPct: 0.2,
    /** The trainer's gradient is read this many seconds of travel up the road, at most `maxM`. */
    lead: { s: 1.5, maxM: 30 },
    /**
     * Bends: grip (m/s²) sets the speed for the radius, never below `minMs`. The brakes come on early enough to
     * slow at `brakeMs2`, never harder than `maxBrakeMs2`. The road ahead is checked every `stepM`.
     */
    corner: { latMs2: 7, minMs: 5.5, brakeMs2: 2.5, maxBrakeMs2: 4, stepM: 5 },
    /**
     * Wind setting to m/s; each sky scales it; it swells and drops by `gust` over `gustS` seconds. Where it
     * blows from changes with the route and the day.
     */
    wind: {
      ms: { off: 0, breeze: 3, blowy: 6 },
      mood: { routeDawn: 0.6, routeGolden: 0.8, routeDusk: 0.7, routeMist: 0.4, routeShower: 1.4 },
      gust: 0.15,
      gustS: 23,
    },
    spacingM: 10,
    /** Arms go up for this far past the top of a real climb, and for this far before the finish (m). */
    cheer: { summitM: 40, finishM: 40 },
    /** Lap rides: at most `max` laps or `maxM` metres; short circuits default to about `defaultM`. */
    laps: { max: 99, maxM: 300_000, defaultM: 12_000 },
    smoothM: 100,
    maxGradePct: 20,
    maxStored: 4000,
    ftpFrac: 0.75,
    /** The free-ride commentator (words in src/fun/quipLines.ts). Times in seconds. */
    quips: {
      /** Never two remarks closer than this; once-a-ride ones (summit, halfway) may follow a little sooner. */
      gapS: 60,
      milestoneGapS: 12,
      /** Above this % of FTP only a word of encouragement, and only this often. */
      hardPct: 105,
      hardGapS: 90,
      /** Remarks about nothing in particular come about this far apart. */
      ambientS: 150,
      /** Share of roadside things that get a remark when one is allowed. */
      nearChance: 0.75,
      /** Sitting still this long earns one remark. */
      stoppedS: 20,
      /** "Off we go" after this much riding. */
      startS: 8,
      /** Routes shorter than these get no "1 km to go" or "halfway". */
      togoMinM: 2500,
      halfMinM: 4000,
      /** Gradients (%) that count as steep, a climb, flat and a descent; speeds (m/s) that count as fast and slow. */
      steepPct: 9,
      climbPct: 4,
      flatPct: 1.5,
      descentPct: -4,
      fastMs: 14,
      slowMs: 2.5,
      /** Below this % of FTP the rider is having a rest; "long ride" remarks start after this long. */
      easyPct: 45,
      longS: 3600,
      /** The summit only counts when it is this far above the start (m). */
      summitGainM: 100,
    },
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
  /** Segments and ghosts (free ride Phase F). */
  segments: {
    /** Segment ids carry the start rounded to this many metres, so a small pack rebuild keeps them. */
    idRoundM: 100,
    /** The sprint: this long, nowhere steeper than `flatPct` either way; the panel shows `leadM` before it. */
    sprint: { lenM: 300, flatPct: 2, leadM: 100 },
    /** A climb takes the name of a named peak or lookout within this far of its top (m). */
    poiM: 400,
    /** Every effort keeps its distance every `traceS` seconds: the pace that live splits and ghosts replay. */
    traceS: 5,
    /** A group-ride position jump bigger than this (m) is a late join, not riding: no segment starts or ends. */
    jumpM: 40,
    /** Efforts kept waiting for the server at most. */
    queueMax: 200,
    /** A ghost turns its cranks at this cadence. */
    ghostCadence: 85,
  },
  /** Route passport (Rider tab). */
  passport: {
    /** The map: the box of longitudes and latitudes drawn, the east-west squeeze and units per degree. */
    map: { west: 112.5, east: 154.5, north: 9.5, south: 44.5, squeeze: 0.89, scale: 11 },
    /** Route dots are kept at least this far apart (map units). */
    dotGap: 15,
    /** Metres climbed in total on one route for the three climbing badges (the last is an Everest). */
    vertTiers: [2000, 4424, 8848],
    /** Finishes of one route for the two repeat badges. */
    repeatTiers: [5, 20],
    /** Brisbane routes start within `km` of the city. */
    brisbane: { at: [153.03, -27.47], km: 25 },
  },
  /** Weekly goals: scrap for finishing the featured route, and the rider's own climbing target. */
  weekly: {
    featuredScrap: 30,
    /** The target is `stretch` times the average of the last `weeks` weeks with any climbing, to the nearest `roundM`. */
    vert: { defaultM: 600, minM: 300, maxM: 6000, stretch: 1.1, roundM: 50, weeks: 4, scrap: 50 },
  },
  /**
   * Group rides. `draft` and `band` mirror DRAFT_* and BAND_* in the server's config.py (the server decides; the
   * client predicts with the same numbers, and content/tests/road-vectors.json fails if they drift).
   */
  road: {
    draft: { wheel: 0.27, fullM: 2, reachM: 10, bunchM: 20, bunchX: 0.15, cap: 0.4, minMs: 3 },
    band: { max: 0.2, deadM: 15, fullM: 150 },
    /** Power, cadence and heart rate go to the server this often (s). */
    sendS: 0.5,
    /** My own rider: this share of the gap to the server's position is closed per second; past `snapM` it jumps. */
    correct: 0.6,
    snapM: 40,
    /** A rider is "caught" or "dropped" when the gap to them crosses `nearM` inwards or `farM` outwards. */
    nearM: 8,
    farM: 60,
    /** The saving is shown on the HUD from this many watts. */
    showW: 5,
    lapsMax: 20,
    /** Places on the road (the server's ROAD_MAX_RIDERS). */
    seats: 8,
  },
}
