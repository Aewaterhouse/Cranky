import { CFG } from '../config'
import { inBand, RollingAvg, score } from '../core/compliance'
import { gradeSprint, type Profile } from '../core/curve'
import { EffectsBus } from '../core/effects'
import { RideRecorder } from '../core/ride'
import { ErgController } from '../trainer/ergController'
import type { Frame, Plan, SprintResult, Trainer, TrainerStatus } from '../types'

export interface Live {
  power: number
  cadence: number
  avg: number
  c: number | null
  band: boolean
}

/** Rider-side ride logic shared by every mode: ERG, compliance, sprint grading and recording. */
export class RideController {
  readonly avg = new RollingAvg()
  readonly erg: ErgController
  readonly effects = new EffectsBus()
  readonly rec: RideRecorder
  live: Live = { power: 0, cadence: 0, avg: 0, c: null, band: false }
  frame: Frame | null = null
  combo = 0
  /** While true the clock is stopped, so nothing is recorded. */
  paused = false
  trainerStatus: TrainerStatus = 'connected'
  onTrainerStatus: (s: TrainerStatus) => void = () => {}
  onSprint: (r: SprintResult) => void = () => {}
  private stopped = false
  private sprint: { i: number; dur: number; samples: number[] } | null = null
  private timers: ReturnType<typeof setInterval>[] = []

  constructor(
    public trainer: Trainer,
    public profile: Profile,
    plan: Plan,
    private now = () => performance.now() / 1000,
  ) {
    this.erg = new ErgController(trainer, profile.ftp, now)
    this.rec = new RideRecorder(plan, profile.ftp)
    trainer.onData((d) => this.data(d.power, d.cadence))
    trainer.onStatus((s) => {
      if (this.stopped) return
      this.trainerStatus = s
      this.erg.setAway(s === 'reconnecting')
      this.onTrainerStatus(s)
      if (s === 'reconnecting')
        this.live = { ...this.live, power: 0, cadence: 0, avg: 0, c: null, band: false }
    })
  }

  start() {
    this.timers.push(setInterval(() => this.erg.tick(), 1000 / CFG.erg.writeHz))
    this.timers.push(setInterval(() => this.second(), 1000 / CFG.recordHz))
  }

  private data(power: number, cadence: number) {
    if (this.trainerStatus === 'reconnecting') return
    const avg = this.avg.push(this.now(), power)
    const tgt = this.frame?.tgt ?? null
    this.live = { power, cadence, avg, c: score(avg, tgt), band: inBand(avg, tgt) }
    if (this.sprint) this.sprint.samples.push(power)
  }

  /** Feed the current frame (local clock or server tick). */
  setFrame(f: Frame | null) {
    if (this.sprint && f?.i !== this.sprint.i) this.finishSprint()
    this.frame = f
    if (!f) return
    if (f.type === 'sprint' && !this.sprint) this.sprint = { i: f.i, dur: f.dur, samples: [] }
    this.erg.ftp = this.profile.ftp
    this.erg.setTarget(f.tgt, this.effects.multiplier(this.now()))
  }

  private finishSprint() {
    const s = this.sprint!
    this.sprint = null
    const avg = Math.round(s.samples.reduce((a, b) => a + b, 0) / (s.samples.length || 1))
    const { grade, pct } = gradeSprint(avg, s.dur, this.profile)
    this.combo = ['GREAT', 'MEGA', 'LEGEND'].includes(grade)
      ? Math.min(CFG.sprint.comboCap, this.combo + 1)
      : 0
    const r: SprintResult = {
      blk: s.i,
      dur: s.dur,
      avg,
      pct: +pct.toFixed(3),
      grade,
      combo: this.combo,
    }
    this.rec.sprints.push(r)
    this.onSprint(r)
  }

  private second() {
    const f = this.frame
    if (!f || this.paused) return
    this.rec.sample(f.i, this.live.power, this.live.cadence, f.tgt, this.live.c, this.live.band)
  }

  async stop() {
    this.timers.forEach(clearInterval)
    this.stopped = true
    if (this.sprint) this.finishSprint()
    await this.erg.failsafe()
  }
}
