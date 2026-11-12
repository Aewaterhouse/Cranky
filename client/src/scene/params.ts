/** Tunable visual parameters, exposed in the debug panel (press ` or add ?debug). */
export const VIS = {
  camHeight: 11,
  camDist: 20,
  camLook: -6,
  fov: 55,
  fogNear: 30,
  fogFar: 220,
  gapScale: 0.45,
  hordeSize: 160,
  sun: 2.2,
  busColour: '#f2b705',
  roadColour: '#3a3a40',
  groundColour: '#4a5a32',
  moods: {
    drill: { sky: '#9fc8e8', fog: '#c8dce8', light: '#ffffff' },
    longhaul: { sky: '#e8935a', fog: '#d9a07a', light: '#ffd9b0' },
    surge: { sky: '#8a2a2a', fog: '#6a2a2a', light: '#ff9a8a' },
    roadblock: { sky: '#3a2a5a', fog: '#4a3a6a', light: '#c0a0ff' },
    servo: { sky: '#6ab0b0', fog: '#a0d0c8', light: '#e0fff0' },
    finish: { sky: '#f0d070', fog: '#f0e0a0', light: '#fff0c0' },
  } as Record<string, { sky: string; fog: string; light: string }>,
}
export type Mood = keyof typeof VIS.moods
