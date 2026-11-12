import { CFG } from '../config'
import type { Trainer } from '../types'

/** The only module that writes to the trainer. Caps, smooths and fails safe. */
export class ErgController {
  private cur = 0
  private from = 0
  private to: number | null = null
  private t0 = 0
  private mode: 'erg' | 'sim' | 'off' = 'off'
  private lastSent = -1
  private dead = false

  constructor(
    private trainer: Trainer,
    public ftp: number,
    private now: () => number = () => performance.now() / 1000,
  ) {}

  get cap() {
    return Math.round(this.ftp * CFG.erg.capPct)
  }

  /** null = ERG off (sprint or free ride): trainer goes to 0% grade sim mode. */
  setTarget(watts: number | null, multiplier = 1) {
    if (watts === null) {
      this.to = null
      return
    }
    const w = Math.min(Math.max(0, Math.round(watts * multiplier)), this.cap)
    if (this.to === null || Math.abs(w - this.to) > CFG.erg.minStepW) {
      this.from = this.mode === 'erg' ? this.cur : w
      this.to = w
      this.t0 = this.now()
    }
  }

  /** Call at about erg.writeHz. */
  async tick() {
    if (this.dead) return
    try {
      if (this.to === null) {
        if (this.mode !== 'sim') {
          this.mode = 'sim'
          this.lastSent = -1
          await this.trainer.setSim(0)
        }
        return
      }
      if (this.mode !== 'erg') {
        this.mode = 'erg'
        this.cur = this.from
        await this.trainer.requestControl()
      }
      const f = Math.min(1, (this.now() - this.t0) / CFG.erg.rampS)
      this.cur = this.from + (this.to - this.from) * f
      const w = Math.min(Math.round(this.cur), this.cap)
      if (w !== this.lastSent) {
        this.lastSent = w
        await this.trainer.setPower(w)
      }
    } catch {
      await this.failsafe()
    }
  }

  /** On error or end: 50% FTP, then release control. */
  async failsafe() {
    if (this.dead) return
    this.dead = true
    try {
      await this.trainer.setPower(Math.round(this.ftp * CFG.erg.failsafePct))
      await this.trainer.release()
    } catch {
      /* trainer gone; nothing more to do */
    }
  }
}
