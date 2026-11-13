import { LIFE } from './lifeVis'

/** One kind of roadside oddity: how often, where it may stand and what its sign may say. */
export interface OddDef {
  /** Relative weight among the kinds allowed at a spot. */
  w: number
  /** Land cover letters it may stand on (see landCover.ts). */
  on: string
  /** Metres beyond the verge: nearest and furthest. */
  near: number
  far: number
  /** Footprint radius, kept clear of streets, buildings and trees. */
  r: number
  /** 1 only above the snowline, 0 anywhere, -1 (default) only below it. */
  snow?: number
  /** 1 only with sand or water close by. */
  coast?: number
  /** 1 only where the ground falls away behind it (or on sand). */
  view?: number
  text?: string[]
}

const big = (text: string): OddDef => ({
  w: 0.3,
  on: 'gbsupa',
  near: 3,
  far: 8,
  r: 5,
  text: [text],
})

/** Tunables for the jokes: oddities, funny signs, chalk and wildlife. Shown in the debug panel as `VIS.route.place.fun`. */
export const FUN = {
  /** How close (metres ahead along the road, or as the crow flies for landmarks) a thing is "nearby" for remarks. */
  nearM: 30,
  /** Routes we know run through suburbs: where their land cover is unmapped, this share of the dry low ground counts as built-up for the jokes. */
  suburbs: ['beach-road'],
  suburbShare: 0.8,
  landmarkM: 70,
  odd: {
    /** Mean metres of road per oddity, out of town and in town. */
    gap: 480,
    townGap: 240,
    /** Share of the oddities drawn at each quality level (the same ones for everyone at that level). */
    share: { lowpower: 0.2, potato: 0.4, low: 0.7, medium: 1, high: 1 },
    /** None this close to either end of the route, where the arches stand. */
    endClear: 60,
    tries: 5,
    /** Steepest ground (rise over run) an oddity will stand on, and the drop behind it that makes a view. */
    slope: 0.35,
    viewDrop: 5,
    viewProbe: 30,
    coastProbe: 70,
    /** Things turn to face a rider this many metres before reaching them. */
    faceAhead: 16,
    size: 1.25,
    /** Plants keep this far beyond an oddity's footprint. */
    plantClear: 1.5,
    /** Harness only: make every oddity this kind, wherever it stands. */
    only: '',
    /** Every route gets one big thing somewhere in this share of its length. */
    bigFrom: 0.3,
    bigSpan: 0.4,
    kinds: {
      couch: {
        w: 3,
        on: 'upgb',
        near: 1.3,
        far: 2.6,
        r: 1.6,
        text: ['FREE', 'FREE\n(MOSTLY DRY)', 'FREE TO\nGOOD HOME', 'FREE\nNO TIMEWASTERS'],
      },
      ute: { w: 2, on: 'ugbs', near: 2.5, far: 6, r: 3 },
      trolley: { w: 2.5, on: 'upbgsaf', near: 0.8, far: 3, r: 1 },
      fruitStall: {
        w: 2.5,
        on: 'gbsp',
        near: 1.6,
        far: 3,
        r: 2,
        text: [
          'EGGS $6\nHONESTY BOX',
          'LEMONS\n$2 A BAG',
          'HORSE POO\n$3 A BAG',
          'AVOS\n3 FOR $5',
          'FIREWOOD\n$15 A BOOT',
          'ZUCCHINIS\nPLEASE TAKE THEM',
        ],
      },
      letterboxes: { w: 3, on: 'gbsuf', near: 1, far: 2, r: 2.5 },
      hoist: { w: 2, on: 'ug', near: 4, far: 9, r: 2.5 },
      bins: { w: 3, on: 'u', near: 0.5, far: 1.2, r: 2.5 },
      caravan: { w: 1.5, on: 'gbsa', near: 3, far: 5.5, r: 3.5, snow: 0 },
      shelter: {
        w: 2,
        on: 'gbsufr',
        near: 1.6,
        far: 2.6,
        r: 2.2,
        snow: 0,
        text: ['NEXT BUS\nTHURSDAY', 'BUS STOP\n(OPTIMISTIC)', 'NO BUSES\nSINCE 1994'],
      },
      bathtub: { w: 2, on: 'g', near: 3, far: 9, r: 2.5 },
      tinnie: { w: 1.5, on: 'uagb', near: 2.2, far: 5, r: 3 },
      bees: { w: 1.5, on: 'gbfs', near: 3, far: 9, r: 2 },
      wombatSign: { w: 2, on: 'fbs', near: 1.2, far: 2.2, r: 1.8, snow: 0, text: ['NEXT\n5 km'] },
      snowman: { w: 4, on: 'gbsfrpu', near: 1.5, far: 5, r: 2, snow: 1 },
      skis: {
        w: 2,
        on: 'gbsfrpu',
        near: 1.2,
        far: 3,
        r: 1.5,
        snow: 1,
        text: ['SKI HIRE\nRETURNS', 'LOST:\nONE GLOVE'],
      },
      eskyChairs: { w: 4, on: 'gbsarp', near: 2, far: 3.6, r: 2, view: 1, snow: 0 },
      kombi: { w: 4, on: 'agbsup', near: 2.4, far: 5, r: 3.2, coast: 1 },
      surfboards: {
        w: 3,
        on: 'agbsup',
        near: 1.5,
        far: 3,
        r: 2,
        coast: 1,
        text: ['SURF HIRE\nBACK IN 5', 'BOARDS $20\nWAVES FREE'],
      },
      dunny: { w: 1.5, on: 'gbs', near: 12, far: 26, r: 1.5, snow: 0 },
      windmill: { w: 1.5, on: 'g', near: 12, far: 30, r: 3 },
      hay: { w: 2, on: 'g', near: 4, far: 14, r: 2.5 },
      scarecrow: { w: 1.5, on: 'g', near: 3, far: 10, r: 1.2 },
      flamingos: { w: 2, on: 'up', near: 1.6, far: 3.2, r: 1.6 },
      thongFence: {
        w: 1.5,
        on: 'bgsa',
        near: 1.3,
        far: 2.4,
        r: 3,
        text: ['THONG FENCE\nADD YOURS', 'LOST THONGS\nNO PAIRS'],
      },
      fridge: {
        w: 2,
        on: 'gbsua',
        near: 1.2,
        far: 2.4,
        r: 1.2,
        text: ['STREET\nLIBRARY', 'WORKS\n(MOSTLY)', 'BAIT\n+ ICE', 'FREE\nYOU CARRY'],
      },
      picnic: { w: 1.5, on: 'pug', near: 3, far: 7, r: 2.6 },
      roadworks: {
        w: 2,
        on: 'gbsufpar',
        near: 0.5,
        far: 1,
        r: 2.6,
        snow: 0,
        text: ['ROADWORKS\nSINCE 2019', 'WORKERS\nAT SMOKO', 'POTHOLE\nPENDING', 'SLOW\nLIKE YOU'],
      },
      bigThong: big('THE BIG THONG'),
      bigPie: big('THE BIG MEAT PIE'),
      bigEsky: big('THE BIG ESKY'),
      bigSnag: big('THE BIG SNAG'),
    } satisfies Record<string, OddDef>,
    /** Hand-painted sign boards. */
    boardBg: '#efe6cf',
    boardFg: '#8a2a1e',
    plaqueBg: '#22252b',
    plaqueFg: '#f2c230',
    col: {
      couch: '#7d5a78',
      cushion: '#a98aa0',
      ute: '#d8d2bf',
      rust: '#9a5a34',
      tyre: '#26272b',
      besser: '#9d9d98',
      glass: '#3c5566',
      steel: '#b9bec4',
      tin: '#a8b0b6',
      timber: '#9b7a52',
      oldTimber: '#7b6a58',
      white: '#f1f0ea',
      red: '#d8322a',
      yellow: '#f2c230',
      blue: '#2f7fc4',
      green: '#2f7d4a',
      binGreen: '#27432f',
      pink: '#f08aa6',
      orange: '#ee7a2a',
      teal: '#3fa6a0',
      straw: '#d9b95a',
      hivis: '#d8f03a',
      wombat: '#6a5746',
      horse: '#7a5234',
      snow: '#f6f8fb',
      pastry: '#d9a55a',
      crust: '#b9793a',
      bread: '#f1e3c0',
      snag: '#8a4a2a',
      plinth: '#b8b4aa',
      black: '#1c1c1f',
    },
  },
  /** Funny signs: one-liners on boards beside the road (words in src/fun/signLines.ts). */
  signs: {
    /** Fillers between the signs tied to the road: first one, then a gap between these two. */
    first: 250,
    gapMin: 450,
    gapMax: 900,
    /** Share of fillers that ignore the land they stand on, and share of signs on the right of the road. */
    anyShare: 0.3,
    rightShare: 0.25,
    /** No two funny signs this close, none this close to a real sign or to either end. */
    apart: 150,
    clearFurn: 35,
    endClear: 80,
    /** Before a ramp, after a hairpin's apex, after the top, into a false flat or descent, and a nudge off round numbers. */
    rampAhead: 110,
    hairpinAfter: 60,
    topAfter: 50,
    falseIn: 60,
    descentIn: 220,
    nudge: 15,
    startAt: 150,
    /** Routes shorter than this get no "1 km to go". */
    togoMin: 2500,
    /** A false flat climbs between these gradients for this long; a descent drops at least this steeply for this long. */
    falseMin: 0.01,
    falseMax: 0.03,
    falseLength: 500,
    descentMin: 0.05,
    descentLength: 400,
    window: 100,
    /** Road below this height (m) is "at sea level". */
    seaBelow: 6,
    /** Letters per line before wrapping; metres beyond the verge; kept this clear of streets and buildings. */
    wrap: 12,
    out: 2,
    pad: 1.5,
    /** Board size and the height of its centre. */
    w: 4,
    h: 2.4,
    up: 2.7,
    /** How far a board turns towards the road, and how crooked a hand-painted one hangs. */
    turn: 0.3,
    crooked: 0.07,
    /** Printed council boards: yellow warning, green information, white notice (background then words). */
    yellow: '#f2c230',
    yellowInk: '#1b1b1b',
    greenBg: '#1f6b43',
    greenInk: '#ffffff',
    white: '#f4f4f0',
    whiteInk: '#b3261e',
    /** Hand-painted boards. */
    ply: '#e9dcbc',
    paint: '#7a2a1e',
    ply2: '#3d4a3a',
    paint2: '#f4f1e4',
    stake: '#7b6a58',
  },
  /** Chalk on the road (words in src/fun/chalkLines.ts). */
  chalk: {
    /** Up a ramp: first message, last message before the top, and the gap between. */
    rampIn: 40,
    rampOut: 20,
    gapMin: 160,
    gapMax: 320,
    endClear: 30,
    /** "Nearly there" within this of the top; "steep" words at this gradient; "long" words on ramps this long. */
    topWithin: 250,
    steep: 0.09,
    long: 2000,
    kmShare: 0.12,
    steepShare: 0.6,
    longShare: 0.25,
    /** On the flat: gaps, how flat, and how far from any ramp. */
    flatGapMin: 1500,
    flatGapMax: 3000,
    flatGrade: 0.03,
    flatClear: 200,
    /** No chalk on bends tighter than 1 / this (m). */
    maxCurve: 0.02,
    /** Painted size: metres per letter across the road, letter length along it, and the widest a line may be. */
    letterW: 0.62,
    letterL: 3.2,
    maxW: 5.4,
    /** Rows of a message are this many letter lengths apart; the centre line stops this far (m) short of the chalk. */
    rowGap: 1.08,
    lineClear: 1.5,
    lift: 0.03,
    fade: 0.85,
    tints: ['#f6f6f2', '#f6f6f2', '#f7e36a', '#f4a6c0', '#a6d8f4'],
  },
  life: LIFE,
}
