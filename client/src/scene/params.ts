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
  camHeight: 7.2,
  camDist: 11.5,
  camLook: -8,
  camSide: 0,
  viewShift: 0.14,
  fov: 54,
  fovKick: 0.35,
  fogNear: 25,
  gapScale: 0.3,
  hordeSize: 220,
  sun: 1,
  shadow: 1,
  shake: 1,
  sway: 1,
  speedLines: 1,
  vignette: 0.45,
  busColour: '#f2b705',
  moodBlend: 1.6,
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
  } as Record<string, MoodDef>,
}
export type Mood = keyof typeof VIS.moods
