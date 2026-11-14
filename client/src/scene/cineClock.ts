import { CAM } from './camVis'

export type CineKind = 'airstrike' | 'drop' | 'gunship'
export const CINE_TITLES: Record<CineKind, string> = {
  airstrike: 'AIR STRIKE',
  drop: 'SUPPLY DROP',
  gunship: 'GUNSHIP',
}
/** Seconds each shot holds before handing back. The gunship keeps its own view: only the bars and title. */
export const cineSecs = (k: CineKind) =>
  k === 'airstrike' ? CAM.strikeS : k === 'drop' ? CAM.dropS : CAM.gunshipS

/**
 * The timing of a cinematic: a cut in, `cineSecs` on the shot, then `CAM.backS` blending back to the rider's
 * view. Skipping jumps to the blend back. Nothing starts while the setting is off.
 */
export class CineClock {
  kind: CineKind | null = null
  t = 0
  private dur = 0

  /** Starts a shot unless cinematics are off; a new one replaces whatever is showing. */
  start(kind: CineKind, enabled: boolean) {
    if (!enabled) return false
    this.kind = kind
    this.t = 0
    this.dur = cineSecs(kind)
    return true
  }
  /** Showing a shot or its title (not yet blending back), so a press or C skips it. */
  get showing() {
    return this.kind !== null && this.t < this.dur
  }
  skip() {
    if (!this.showing) return false
    this.t = this.dur
    return true
  }
  /**
   * Steps the clock. `cam` is how much the shot has the camera (1 on the shot, easing to 0 on the way back;
   * always 0 for the gunship), `bars` the letterbox (0..1).
   */
  step(dt: number) {
    if (!this.kind) return { cam: 0, bars: 0, title: '' }
    this.t += dt
    const back = Math.max(0, this.t - this.dur) / CAM.backS
    if (back >= 1) {
      this.kind = null
      return { cam: 0, bars: 0, title: '' }
    }
    const k = 1 - back * back * (3 - 2 * back)
    const bars = Math.min(1, this.t / 0.25) * k
    return {
      cam: this.kind === 'gunship' ? 0 : k,
      bars,
      title: this.t < this.dur ? CINE_TITLES[this.kind] : '',
    }
  }
}
