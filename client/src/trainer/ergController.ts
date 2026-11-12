import { CFG } from '../config'
import type { Trainer } from '../types'

/** The only module that writes to the trainer. Caps, smooths and fails safe. */
export class ErgController {
  private cur = 0
  private from = 0
  private to: number | null = null
  private t0 = 0
  private mode: 'erg' | 'sim' | 'res' | 'slope' | 'off' = 'off'
  private manual: { kind: 'res' | 'slope'; v: number } | null = null
  private lastSent = -1
  private dead = false
  private fails = 0
  private away = false

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

  /** ERG off: a fixed resistance level (0-100%). The plan target is then only used for scoring. */
  setResistance(pct: number) {
    this.manual = { kind: 'res', v: Math.min(100, Math.max(0, Math.round(pct))) }
  }

  /** ERG off: simulated gradient in % (to 0.1), within `range` (the solo slope mode's by default). */
  setGrade(pct: number, range: readonly number[] = CFG.ride.grade) {
    const [lo, hi] = range
    this.manual = { kind: 'slope', v: Math.min(hi, Math.max(lo, Math.round(pct * 10) / 10)) }
  }

  /** Back to ERG: control is re-requested and the current target written again. */
  setErg() {
    this.manual = null
    this.mode = 'off'
    this.lastSent = -1
  }

  get ergOn() {
    return this.manual === null
  }

  /** While the trainer is reconnecting nothing is written. On return control is re-requested and the target re-sent. */
  setAway(away: boolean) {
    this.away = away
    if (away) return
    this.mode = 'off'
    this.lastSent = -1
    this.fails = 0
  }

  /** Call at about erg.writeHz. */
  async tick() {
    if (this.dead || this.away) return
    try {
      const m = this.manual
      if (m) {
        if (this.mode !== m.kind || this.lastSent !== m.v) {
          this.mode = m.kind
          this.lastSent = m.v
          await (m.kind === 'res' ? this.trainer.setResistance(m.v) : this.trainer.setSim(m.v))
        }
        this.fails = 0
        return
      }
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
      this.fails = 0
    } catch {
      // One rejected write is retried from scratch on the next tick; only a run of them is fatal.
      this.mode = 'off'
      this.lastSent = -1
      if (++this.fails >= CFG.erg.maxFails) await this.failsafe()
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
