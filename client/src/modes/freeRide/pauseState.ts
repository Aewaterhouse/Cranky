import { CFG } from '../../config'

const A = CFG.freeRide.autoPause

/**
 * Whether a solo free ride is paused: by hand, or by itself once the rider has all but stopped. A ride starts
 * auto-paused ("start pedalling") and the clock starts with the first pedal strokes. No DOM, no trainer.
 */
export class PauseState {
  manual = false
  auto = true
  /** Waiting for the first pedal stroke. */
  starting = true
  private idleFor = 0
  private activeFor = 0

  /** The pause key or button; nothing before the ride has started. */
  toggle() {
    if (this.starting) return
    this.manual = !this.manual
    if (!this.manual) this.auto = false
  }

  /** Call every tick with whether the rider is pedalling and the road speed (m/s). */
  step(stopped: boolean, speed: number, dt: number) {
    // A coasting descent is not a stop: only count idle time once the rider has nearly halted.
    this.idleFor = stopped && speed < A.haltMs ? this.idleFor + dt : 0
    this.activeFor = stopped ? 0 : this.activeFor + dt
    if (!this.manual && !this.auto && this.idleFor >= A.stopS) this.auto = true
    else if (this.auto && this.activeFor >= A.goS) this.auto = this.starting = false
  }

  /** A group ride never pauses: the server's clock runs for everyone. */
  never() {
    this.manual = this.auto = this.starting = false
  }

  get paused() {
    return this.manual || this.auto
  }
  get why(): 'manual' | 'auto' | null {
    return this.manual ? 'manual' : this.auto ? 'auto' : null
  }
}
