/**
 * Tunables for the camera's set pieces, in metres. Shown in the debug panel as `VIS.route.fly` (the pre-ride
 * flyover) and `VIS.route.orbit` (the turn round the rider at a summit or the finish).
 */
export const FLY = {
  /** Height above the road at the start and the end of the sweep. */
  highM: 42,
  lowM: 7,
  /** Metres right of the road at the start and the end (negative is left). */
  sideM: 34,
  sideEndM: 5,
  /** The camera trails the point it is about by this much and looks this far past it. */
  backM: 30,
  lookM: 70,
  /** Never closer to the ground than this. */
  clearM: 4,
  /** A slow frame moves a set piece on by at most this many seconds. */
  maxStepS: 0.5,
}
/** Confetti and streamers at a summit or the finish. Speeds in m/s. */
export const PARTY = {
  count: 220,
  secs: 5,
  size: 0.16,
  /** Thrown up between these speeds and outwards up to `spreadMs`; then it falls no faster than `fallMs`. */
  upMs: [5, 11],
  spreadMs: 5,
  gravity: 7,
  fallMs: 2.2,
  drag: 1.2,
  sway: 1.4,
  streamerEvery: 5,
  colours: ['#f2b705', '#ff5a4e', '#7fd13b', '#3bb2d1', '#e85d9c', '#f3f0e6'],
}
export const ORBIT = {
  radiusM: 9,
  /** Extra radius half-way round, in front of the rider. */
  swellM: 2,
  heightM: 3.4,
  aimUpM: 1.1,
  /** The postcard is taken this far through the turn (0..1): three-quarters on, from the front. */
  snapAt: 0.42,
}
/** The podium at the end of a race (`VIS.route.podium`): steps, figures, champagne, confetti and the camera. */
export const PODIUM = {
  secs: 14,
  /** Metres before the line, and back off the road edge on the left. */
  lineM: 18,
  setbackM: 3,
  /** Step heights for 1st, 2nd and 3rd, the side box, and their width and depth. */
  firstH: 1.3,
  secondH: 0.85,
  thirdH: 0.55,
  sideH: 0.4,
  stepW: 1.5,
  depthM: 1.6,
  sideGapM: 1.4,
  /** The award's board on a post beside the side box: width and height of its middle. */
  signW: 1.9,
  signUpM: 2.3,
  step: '#f3f0e6',
  side: '#f2b705',
  backdrop: '#1f2a44',
  backdropText: '#f2b705',
  /** The winner's jump (m, per second), the air pedalling (rad/s) and the side rider's twirl (rad/s). */
  jumpM: 0.45,
  jumpHz: 1.6,
  spinRad: 14,
  twirlRad: 2.4,
  /** Champagne: drops, how long each flies (s), launch speed (m/s), spread and colour. */
  drops: 260,
  dropS: 1.3,
  sprayMs: 6.5,
  sprayCone: 0.35,
  dropSize: 0.09,
  fizz: '#fff1b8',
  /** Confetti every this many seconds. */
  burstS: 3.5,
  /** Camera: distance, height, aim above the ground and a swing either side of front (rad, per second). */
  camM: 11,
  camUpM: 3.2,
  aimUpM: 1.9,
  swingRad: 1.1,
  swingHz: 0.06,
}
