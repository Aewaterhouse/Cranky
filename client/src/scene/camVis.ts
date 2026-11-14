/**
 * Player camera tunables: orbit and zoom limits, auto-return, the camera views and the streak cinematics.
 * Shown in the debug panel as `VIS.cam`. Angles in degrees, lengths in metres, times in seconds.
 */
export const CAM = {
  /** Degrees of turn per pixel dragged, and the zoom step per wheel notch (a share of the distance). */
  dragDeg: 0.3,
  wheelStep: 0.12,
  /** Up-and-down limits on the camera's angle above the subject, whatever the drag. */
  pitchMin: 4,
  pitchMax: 80,
  /** Zoom limits as a share of the view's own distance, and the nearest the camera may get in metres. */
  zoomMin: 0.35,
  zoomMax: 3,
  nearBus: 9,
  nearRider: 2.2,
  /** The camera stays this high above the ground, and above the bus roof when it would be inside the bus. */
  groundClear: 0.8,
  busHalf: [1.6, 3.6, 6.2] as [number, number, number],
  /** With no camera input for `returnS` seconds the view eases back over `returnEaseS`. */
  returnS: 8,
  returnEaseS: 1.2,
  /** Two taps or clicks inside `doubleMs` snap the view back at once. */
  doubleMs: 320,
  /** Seconds to blend from one camera view to the next. */
  blendS: 0.9,
  /** Photo mode: metres of pan per arrow-key press. */
  panStep: 1.5,
  /**
   * Camera views as eye and aim points in the subject's frame: `x` to its right, `y` up, `z` behind it. The
   * bus's subject is the bus; free ride's is the rider. Chase is the game's own camera and has no entry.
   */
  bus: {
    high: { ex: 6, ey: 110, ez: 40, lx: 0, ly: 0, lz: 10 },
    rear: { ex: 3, ey: 6, ez: -20, lx: 0, ly: 2, lz: 40 },
    side: { ex: 15, ey: 3.5, ez: 3, lx: 0, ly: 2.2, lz: 3 },
  },
  route: {
    high: { ex: 3, ey: 16, ez: 24, lx: 0, ly: 0, lz: -4 },
    rear: { ex: 1.5, ey: 2.4, ez: -9, lx: 0, ly: 1.2, lz: 25 },
    side: { ex: 9, ey: 2, ez: 0, lx: 0, ly: 1.1, lz: 0 },
  },
  /** Cinematics: how long each shot holds, the blend back to the rider's view, and the letterbox. */
  strikeS: 4,
  dropS: 4.2,
  gunshipS: 3,
  backS: 0.7,
  barH: 0.1,
  /** Air strike: the chase seat behind and beside the jet, and where the camera stops to watch the blast. */
  jetSeat: [-10, 4, -30] as [number, number, number],
  blastSeat: [-26, 10, -22] as [number, number, number],
  /** Supply drop: a low seat at the roadside ahead of the bus. */
  dropSeat: [7, 1.3, -24] as [number, number, number],
}
export type CamView = 'chase' | 'high' | 'rear' | 'side'
export const CAM_VIEWS: CamView[] = ['chase', 'high', 'rear', 'side']
export const VIEW_NAMES: Record<CamView, string> = {
  chase: 'Chase',
  high: 'High',
  rear: 'Rear',
  side: 'Side',
}
export type ViewPoint = (typeof CAM.bus)['high']
