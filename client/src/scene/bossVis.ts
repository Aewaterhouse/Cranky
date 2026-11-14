/** The bus world's bosses and zombie types (scene/bosses.ts, horde.ts). Shown in the debug panel as `VIS.boss`. */
export const BOSS = {
  /** The boss stands this far behind the horde front, and drops back `fall` m more as its health runs out. */
  back: -3,
  fall: 22,
  /** The chase camera swings this far round to look back at a boss, and aims `aimY` m higher per metre of boss. */
  dread: 0.8,
  aimY: 0.45,
  /** ...and per metre of boss sits this much higher and further ahead of the bus. */
  camY: 0.45,
  camAhead: 1.5,
  /** Road train: trailers come off below these shares of health, last one first. */
  trailerOff: [0.66, 0.33],
  truck: '#5d7a3a',
  rust: '#8a4a2a',
  chrome: '#c8ccd0',
  eyes: '#ff3a2a',
  /** The giant: height (m), strides a second, and how hard each footfall shakes the camera. */
  giantH: 13,
  stride: 0.55,
  stomp: 0.5,
  skin: '#7fa65a',
  shirt: '#6a3a3a',
  pants: '#2a2d3a',
  /** The bridge: deck pieces `piece` m long, and how far they have sunk at the far end (m). */
  piece: 6,
  pieces: 9,
  sink: 12,
  girder: '#b5482e',
  deck: '#6a6a70',
  river: '#3d7fa6',
  /** Zombie types: a share of the horde is re-dressed and moves differently. */
  runnerShare: 0.35,
  runnerLean: 0.5,
  runnerPace: 1.7,
  runnerKit: ['#d8f030', '#ff4fa0', '#30d0f0', '#ff7a1a'],
  bruteShare: 0.25,
  bruteScale: 1.7,
  brutePace: 0.55,
  bruteKit: '#ff8a1a',
}
