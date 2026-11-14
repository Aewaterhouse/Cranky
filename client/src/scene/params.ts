import { CAM } from './camVis'
import { FEEL } from './route/feelVis'
import { FLY, ORBIT, PARTY } from './route/shotVis'
import { PLACE } from './route/placeVis'
import { MOOD, ROUTE_MOOD_DEFS } from './route/routeMoods'

/** Tunable visual parameters, exposed in the debug panel (press ` or add ?debug). */
export interface MoodDef {
  /** Sky zenith colour. */
  sky: string
  /** Horizon and fog colour. */
  fog: string
  /** Key light colour. */
  light: string
  hemi: string
  ground: string
  hill: string
  sunI: number
  hemiI: number
  /** Visible sun or moon: elevation in degrees, azimuth (0 = dead ahead), size. */
  sunElev: number
  sunAz: number
  sunSize: number
  /** Headlights and night glow 0..1. */
  head: number
  stars: number
  fogFar: number
}

export const VIS = {
  /** The player's camera: orbit, zoom, views and cinematics (scene/camVis.ts). */
  cam: CAM,
  /** Automatic quality: frame-rate windows of `windowS` seconds; under `verySlowFps` drops `verySlowDrop` levels at once, `slowWindows` windows under `slowFps` drop one, `fastWindows` over `fastFps` climb one. */
  quality: {
    windowS: 2,
    slowFps: 40,
    verySlowFps: 20,
    verySlowDrop: 2,
    slowWindows: 2,
    fastFps: 57,
    fastWindows: 10,
  },
  camHeight: 7.2,
  camDist: 11.5,
  camLook: -8,
  camSide: 0,
  viewShift: 0.14,
  climbDrop: 2.4,
  climbLook: 3,
  fov: 54,
  fovKick: 0.35,
  fogNear: 25,
  gapScale: 0.3,
  hordeSize: 220,
  /** Chest sphere radius on riders and zombies. Read once when a figure is built. */
  bust: 0.17,
  /** VO2 Madness pack: z of last and first place, and the gap between lanes. */
  packBack: 1.5,
  packFront: -11,
  packLane: 2,
  /** How far the camera drops and closes in on the pack (0..1). */
  packCam: 0.3,
  /** Heart-rate effort (fraction of max) where a rider starts to redden, and where they steam. */
  heatFrom: 0.7,
  steamFrom: 0.85,
  /** Gunship orbit around the horde: height, radius and turn rate (rad/s). */
  gunshipHeight: 30,
  gunshipOrbit: 34,
  gunshipSpin: 0.35,
  sun: 1,
  shadow: 1,
  shake: 1,
  sway: 1,
  speedLines: 1,
  vignette: 0.45,
  busColour: '#f2b705',
  amboColour: '#f4f1e8',
  /** The smart trainer under every bike: body colour, size (read once when a bike is built) and 1 to show it in free ride too. */
  trainerColour: '#ff6a1a',
  trainerSize: 1,
  trainerOnRoad: 1,
  /** Servo stop: where the servo sits beside the parked bus (z), the braking distance in metres, and how fast the bus pulls away. */
  servoStop: -12,
  servoBrake: 40,
  servoPullAway: 0.6,
  /** Trainer power cables into the bus: cable colour, glow colour and the glow at full effort. */
  cableColour: '#1d1f24',
  cableGlow: '#7dff4a',
  cableGlowMax: 1.4,
  /** Rear-view mirror on the bus (1 on): width and centre as shares of the screen width, top edge as a share
   *  of its height, camera height. Top right by default, clear of the event header and its cues. */
  mirror: 1,
  mirrorW: 0.26,
  mirrorX: 0.83,
  mirrorY: 0.03,
  mirrorHeight: 3.6,
  moodBlend: 1.6,
  /** The free-ride route world (scene/route/). Lengths in metres, angles in radians. */
  route: {
    roadHalf: 3.1,
    verge: 0.7,
    /** Out-and-back stretches: each direction is moved this far to its left, with a wider loop at the turn. */
    uturnShift: 3.5,
    uturnBulb: 12,
    lineW: 0.24,
    /** Road and near-terrain rows are this far apart; a chunk is `chunk` long. */
    rowStep: 4,
    chunk: 200,
    behind: 150,
    /** Road this close as the crow flies is built too, however far along the route it is. */
    nearby: 600,
    /** The share of `nearby` used at each quality level: a slow device builds less of a loop's other side. */
    nearbyShare: { lowpower: 0.2, potato: 0.5, low: 0.75, medium: 1, high: 1 },
    /** How far ahead chunks are built, per quality level. */
    aheadLowpower: 200,
    aheadPotato: 350,
    aheadLow: 500,
    aheadMedium: 800,
    aheadHigh: 1000,
    /** Flat bench either side of the centreline, then the blend back to natural ground. */
    shoulder: 7.5,
    blend: 45,
    bankGain: 1.2,
    bankMax: 0.1,
    /** 1-2-1 passes over the centreline to hide the 1 m rounding of pack coordinates. */
    smoothPasses: 2,
    /** Routes without coordinates wander: two heading waves as [amplitude, wavelength] pairs. */
    meander: [0.9, 260, 0.5, 90],
    /** Made-up hills where there is no height data. */
    hillAmp: 70,
    hillScale: 260,
    /** Terrain columns: metres out from the centreline, near (every row) and far (every `outerEvery` rows). */
    inner: [8, 12, 18, 27, 40, 60, 90],
    outer: [130, 175, 230, 300, 380, 470, 560, 650],
    outerEvery: 10,
    /** Where a rider sits across the road when the game gives no offset (we ride on the left). */
    lane: -1.7,
    /** Ghost riders (a best effort ridden again): how solid, how far towards white, and metres right of the rider's lane. */
    ghost: { opacity: 0.4, pale: 0.55, lanes: [1.2, 2.3] },
    /** The camera-distance setting: scales `camBack` and `camHeight` (1 is standard). */
    camDist: 1,
    /** A hidden tab draws no more often than this (ms). */
    hiddenFrameMs: 1000,
    /** Smooth edges, for a world that starts at medium quality or better (read when the world is made). */
    antialias: 1,
    camBack: 9,
    camHeight: 3.7,
    camSide: 0,
    camLook: 20,
    /** 0 aims the camera at the rider, 1 at the point `camLook` up the road. */
    camAim: 0.55,
    camStiff: 4,
    camClear: 1.3,
    fov: 58,
    viewShift: 0.06,
    fogNear: 140,
    skyR: 1500,
    skyJag: 60,
    snowLine: 1650,
    /** Faces whose normal points up less than this are rock. */
    rockSlope: 0.8,
    tarmac: '#3f3f47',
    line: '#ecebe0',
    gravel: '#a39272',
    snow: '#f3f6fa',
    sea: '#3d8fc4',
    /** Ground below this height (m) is drawn as water. */
    seaLevel: 0.5,
    /** Ground colours by land cover; each drifts towards a neighbour with slow noise. */
    ground: {
      grass: '#7fb24e',
      dry: '#b9b060',
      bush: '#5c8f4a',
      forest: '#3f6f3c',
      scrub: '#8c9a5c',
      built: '#a9ad8c',
      park: '#6fc04f',
      sand: '#e6d49a',
      rock: '#8b8780',
      waterBed: '#2f6f8f',
    },
    /** Without a map: trees thin out above the treeline (lower in Tasmania), rock begins `alpineBand` higher. */
    treeline: 1500,
    treelineTas: 1200,
    alpineBand: 200,
    /** Without a map, ground this far above sea level is sand. */
    sandBand: 2,
    /** Land cover boundaries wander by this fraction of a grid cell, with noise of this wavelength (m). */
    coverJitter: 0.35,
    coverNoise: 28,
    /** Water sheet: height above the bed, tint, sun glint colour and tightness. */
    waterLift: 0.12,
    waterTint: '#ffffff',
    waterGlint: '#9fb8c8',
    waterShine: 60,
    /** Side streets: half widths, height above the ground, depth bias, colours. */
    streetHalf: 2.4,
    mainHalf: 3,
    streetLift: 0.12,
    streetBias: 2,
    street: '#b7b1a3',
    mainStreet: '#96938c',
    place: PLACE,
    feel: FEEL,
    fly: FLY,
    orbit: ORBIT,
    party: PARTY,
    mood: MOOD,
    signs: {
      post: '#8d949a',
      streetW: 2.6,
      streetH: 3.2,
      streetBg: '#1f6b43',
      streetFg: '#ffffff',
    },
  },
  moods: {
    drill: {
      sky: '#3f8fe0',
      fog: '#cfe6f2',
      light: '#fff4e0',
      hemi: '#cfe4ff',
      ground: '#86b050',
      hill: '#8aa8c4',
      sunI: 2.6,
      hemiI: 1.15,
      sunElev: 32,
      sunAz: -20,
      sunSize: 0.035,
      head: 0,
      stars: 0,
      fogFar: 260,
    },
    rampup: {
      sky: '#5d7fa8',
      fog: '#b9c9b0',
      light: '#fff1c8',
      hemi: '#a8c0a0',
      ground: '#5f7a42',
      hill: '#4d6a58',
      sunI: 2.3,
      hemiI: 0.95,
      sunElev: 22,
      sunAz: -25,
      sunSize: 0.05,
      head: 0,
      stars: 0,
      fogFar: 150,
    },
    longhaul: {
      sky: '#4a4f9a',
      fog: '#f0a468',
      light: '#ffb070',
      hemi: '#c8a0a8',
      ground: '#a58f4c',
      hill: '#8a566a',
      sunI: 2.5,
      hemiI: 0.85,
      sunElev: 7,
      sunAz: 10,
      sunSize: 0.06,
      head: 0.35,
      stars: 0,
      fogFar: 240,
    },
    surge: {
      sky: '#2a0810',
      fog: '#8c2a24',
      light: '#ff7a60',
      hemi: '#b05050',
      ground: '#5e3a30',
      hill: '#3a1214',
      sunI: 1.8,
      hemiI: 0.7,
      sunElev: 12,
      sunAz: 0,
      sunSize: 0.09,
      head: 0.7,
      stars: 0,
      fogFar: 160,
    },
    roadblock: {
      sky: '#0a0620',
      fog: '#3e2f6e',
      light: '#a090ff',
      hemi: '#5a5ab0',
      ground: '#34406a',
      hill: '#1c1440',
      sunI: 1.4,
      hemiI: 0.75,
      sunElev: 24,
      sunAz: -25,
      sunSize: 0.045,
      head: 1,
      stars: 1,
      fogFar: 190,
    },
    servo: {
      sky: '#4cb0bc',
      fog: '#c4ece0',
      light: '#fff0d8',
      hemi: '#d0fff0',
      ground: '#7cb48a',
      hill: '#6c9ea4',
      sunI: 2.2,
      hemiI: 1.1,
      sunElev: 14,
      sunAz: 15,
      sunSize: 0.05,
      head: 0,
      stars: 0,
      fogFar: 230,
    },
    finish: {
      sky: '#4a78c8',
      fog: '#ffd088',
      light: '#fff0b0',
      hemi: '#ffe0b0',
      ground: '#a8b458',
      hill: '#c8886e',
      sunI: 2.8,
      hemiI: 1,
      sunElev: 5,
      sunAz: 0,
      sunSize: 0.1,
      head: 0.15,
      stars: 0,
      fogFar: 260,
    },
    route: {
      sky: '#3f8fe0',
      fog: '#cfe4ee',
      light: '#fff4e0',
      hemi: '#cfe4ff',
      ground: '#86b050',
      hill: '#5f8a9c',
      sunI: 2.6,
      hemiI: 1.15,
      sunElev: 40,
      sunAz: -35,
      sunSize: 0.035,
      head: 0,
      stars: 0,
      fogFar: 1100,
    },
    ...ROUTE_MOOD_DEFS,
  } as Record<string, MoodDef>,
}
export type Mood = keyof typeof VIS.moods
