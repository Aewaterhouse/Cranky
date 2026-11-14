/** Speed Dating's own dressing on the bus road (scene/dateDress.ts). Shown in the debug panel as `VIS.date`. */
export const DATE = {
  /** Fairy lights: a pole every `span` m each side, `x` m out, wire `sag` m deep, `bulbs` a span. Read when built. */
  span: 8.4,
  x: 9.4,
  poleH: 2.7,
  sag: 0.45,
  bulbs: 8,
  bulb: 0.11,
  bulbCols: ['#ffd27a', '#ff8fb8', '#fff3d0', '#ff5a7a', '#ffe8a0'],
  /** Heart balloons tied to every `balloonEvery`th pole. */
  balloonEvery: 3,
  balloonCols: ['#ff3d6e', '#ff8fb8', '#e0245e', '#ffd0dc'],
  /** A milk bar or a drive-in comes past every `venueEvery` m, this far out. */
  venueEvery: 380,
  venueX: 15,
  neon: '#ff4fa3',
  neon2: '#7ff3ff',
  /** The date-night sky: dusk, low warm sun, the first stars. */
  mood: {
    sky: '#3a2a6e',
    fog: '#e88aa0',
    light: '#ffb48a',
    hemi: '#c890c0',
    ground: '#7a8a4a',
    hill: '#7a4a7a',
    sunI: 2.1,
    hemiI: 0.95,
    sunElev: 4,
    sunAz: 8,
    sunSize: 0.08,
    head: 0.6,
    stars: 0.5,
    fogFar: 230,
  },
}
