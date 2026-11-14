import { FUN } from './funVis'

/** Tunables for what stands on the route world (plants, buildings, furniture, landmarks). Shown in the debug panel as `VIS.route.place`. */
export const PLACE = {
  fun: FUN,
  /** Plant density multiplier and how far from the road plants are scattered (m), per quality level. */
  detail: { lowpower: 0.1, potato: 0.25, low: 0.5, medium: 1, high: 1.5 },
  reach: { lowpower: 35, potato: 60, low: 230, medium: 300, high: 470 },
  /** Trees and small plants per hectare beside the road, by land cover letter. */
  trees: { g: 3, f: 70, b: 40, s: 8, u: 14, p: 12, a: 0, r: 0, w: 0 },
  under: { g: 40, f: 30, b: 40, s: 120, u: 20, p: 6, a: 35, r: 30, w: 0 },
  /** Beyond the near terrain band: this share of the trees, this much bigger, and no small plants past `underReach`. */
  farThin: 0.22,
  farScale: 1.5,
  underReach: 40,
  /** Metres kept clear beyond the verge, and around streets and buildings. */
  treeClear: 3,
  underClear: 0.8,
  streetClear: 2.5,
  /** Slopes steeper than this (rise over run) carry no trees. */
  treeSlope: 0.9,
  /** Snow gums take over this far below the treeline; trees are gone this far above it. */
  snowGumBelow: 200,
  treelineFade: 150,
  /** Tea-tree replaces other trees below this height when sand or water is within `coastProbe` metres. */
  coastM: 25,
  coastProbe: 45,
  /** Tree ferns only below this height. */
  fernMax: 1100,
  plant: {
    gumTrunk: '#d8d0bd',
    gumLeaf: '#6f9150',
    gumLeaf2: '#5c8246',
    scribblyTrunk: '#efece2',
    scribblyLeaf: '#86a85a',
    snowTrunk: '#d9cdb4',
    snowStreak: '#b5604a',
    snowLeaf: '#7d9a78',
    fernTrunk: '#5a4630',
    fernFrond: '#4fa046',
    teaTrunk: '#4f4336',
    teaLeaf: '#4d7a4a',
    banksia: '#e2b93b',
    shrub: '#7a9a62',
    shrub2: '#93a86e',
    tussock: '#c9bb6a',
    boulder: '#8d8a84',
  },
  /** Houses and shops: roof pitch as a share of depth, the tallest roof, and colour schemes picked per building. */
  roofPitch: 0.32,
  roofMax: 3.4,
  /** Footprint (m2) and height (m) from which a building is a pub (tall) or a servo (wide and low). */
  pubArea: 140,
  pubHeight: 6,
  servoArea: 230,
  walls: ['#efe6d0', '#cfe0e8', '#d7e4c8', '#b5694f', '#f4f1ea', '#f0dfa0', '#d9b9a0'],
  roofs: ['#9aa3a8', '#b5553c', '#4f6b55', '#8f3d30', '#4a4c52'],
  trim: '#f6f3ea',
  glass: '#3c5566',
  door: '#7a4a2e',
  awning: '#d9482f',
  servo: '#f2b705',
  /** Close-up detail per metre of road (scaled by `density` per quality level): grass tufts out to `tuftOut` m past
   * the verge, gravel specks, chevron boards round bends sharper than 1 / `chevronCurve` m, and painted tree shadows
   * (only where there are no shadow maps). */
  verge: {
    density: { lowpower: 0, potato: 0.3, low: 0.6, medium: 1, high: 1.4 },
    tufts: 1.4,
    tuftOut: 5,
    tuftH: 0.45,
    tuft: '#8cc04a',
    tuftDry: '#d8c470',
    specks: 1.2,
    speck: '#6f665a',
    chevronCurve: 0.025,
    chevronApart: 9,
    chevronBg: '#f2c230',
    chevronFg: '#1b1b1b',
    shadowEvery: 9,
    shadowChance: 0.35,
    shadowDark: 0.72,
  },
  /** Farm dressing beside open grass: a fence `fenceOut` m past the verge with posts every `postEvery` m, and per
   * side of a chunk a chance of bales, a shed or a windmill. A side counts as farm when this share of it is grass. */
  farm: {
    grassShare: 0.8,
    fenceOut: 3,
    fenceH: 1.1,
    postEvery: 4,
    gapChance: 0.06,
    clear: 6,
    baleChance: 0.5,
    shedChance: 0.15,
    windmillChance: 0.12,
    post: '#8a6a48',
    wire: '#b8bcc0',
    straw: '#d9b95a',
    shedWall: '#c4c9cc',
    shedDark: '#3a3530',
    shedRoof: '#9aa4aa',
  },
  furniture: {
    /** Gradient signs: a stretch averaging at least `gradeMin` over `gradeWindow` for `gradeLength`, signed `gradeAhead` early. */
    gradeMin: 0.06,
    gradeLength: 300,
    gradeWindow: 100,
    gradeAhead: 40,
    /** Hairpins: at least `hairpinTurn` radians of bend inside `hairpinWindow` metres; numbered when a route has `hairpinsMin`. */
    hairpinTurn: 2.3,
    hairpinWindow: 120,
    hairpinAhead: 12,
    hairpinsMin: 3,
    /** A summit arch needs this much climb above the start, and this far from either end to stand on its own. */
    summitGain: 150,
    summitApart: 300,
    /** Guard rail where the ground at terrain column `railColumn` is `railDrop` below the road; gaps closed, short runs dropped. */
    railDrop: 2.5,
    railColumn: 3,
    railGap: 12,
    railMin: 20,
    railH: 0.75,
    /** White edge posts every `postEvery` rows on bends tighter than 1 / `postCurve` metres. */
    postCurve: 0.008,
    postEvery: 3,
    postH: 1,
    /** Signs stand this far beyond the verge. */
    signOut: 1.3,
    archH: 6.4,
    kmBg: '#1f6b43',
    gradeBg: '#f2c230',
    gradeFg: '#1b1b1b',
    hairpinBg: '#1d4f9a',
    rail: '#c9cdd1',
    railPost: '#8d949a',
    edgePost: '#f4f4f0',
    reflectLeft: '#d8322a',
    reflectRight: '#b9c6da',
    start: '#2f9e5a',
    summit: '#d8322a',
    finish: '#22252b',
  },
  landmarks: {
    /** Landmarks are pushed at least this far beyond the verge. */
    clear: 9,
    /** Routes that end in a ski village, have a hut at the top, or have bathing boxes on their beaches. */
    skiVillages: ['falls-creek', 'mount-hotham', 'ben-lomond'],
    summitHuts: ['mount-hotham'],
    bathingBoxes: ['beach-road'],
    /** The village: this many A-frame lodges, the first `villageFrom` metres before the end, one every `villageStep`. */
    lodges: 9,
    villageFrom: 120,
    villageStep: 80,
    lodgeOut: 15,
    lodgeSpread: 40,
    /** The coast is looked for every `coastStep` metres at these distances either side of the road. */
    coastStep: 150,
    coastProbe: [18, 30, 45, 60, 80],
    boxesApart: 900,
    jettiesApart: 2500,
    towerH: 85,
    jettyLen: 38,
    stone: '#9a968d',
    timber: '#9b7a52',
    steel: '#c8ccd0',
    towerRed: '#d8322a',
    towerWhite: '#f1f1ee',
    trig: '#f4f4f0',
    signBg: '#6b4a2b',
    umbrella: '#e8a13a',
    lodgeTints: ['#8a5a3c', '#3f5f7a', '#7a2f2a', '#3f6b4a', '#d9c9a8'],
    boxTints: ['#e8533f', '#3f8fd0', '#f2c230', '#3fae7a', '#e58bb0', '#f1f1ee'],
  },
}
