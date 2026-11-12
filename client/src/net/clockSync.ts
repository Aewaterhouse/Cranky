import { CFG } from '../config'

/**
 * Local estimate of the server's session clock from its ticks. Between ticks it extrapolates at the
 * measured rate (1 normally, more on a time-scaled test server), eases small errors out so jitter does
 * not show, snaps when it is more than `snapS` out, and never runs backwards unless it snapped.
 * Latency is not measured: the estimate runs about one network delay behind the true server clock.
 */
export class ClockSync {
  private base = 0
  private t0 = 0
  private rate = 1
  private seen = false
  private out = -Infinity
  private win: [el: number, at: number][] = []

  /** Records a tick: `el` is the server's session time, `at` the local time in ms it arrived. */
  tick(el: number, at: number) {
    const c = CFG.clock
    if (!this.seen) {
      this.seen = true
      this.base = el
    } else {
      const e = el - this.estimate(at)
      if (Math.abs(e) > c.snapS) {
        this.base = el
        this.out = -Infinity
      } else this.base = this.estimate(at) + c.gain * e
    }
    this.t0 = at
    this.win.push([el, at])
    while (this.win.length > 2 && at - this.win[1][1] > c.windowS * 1000) this.win.shift()
    const [el0, at0] = this.win[0]
    if (at - at0 >= 500)
      this.rate = Math.min(c.rateMax, Math.max(c.rateMin, ((el - el0) * 1000) / (at - at0)))
  }

  private estimate(at: number) {
    return this.base + ((at - this.t0) / 1000) * this.rate
  }

  /** Estimated session time at local time `at` (ms), or null before the first tick or when ticks have stopped. */
  now(at: number): number | null {
    if (!this.seen || at - this.t0 > CFG.clock.staleS * 1000) return null
    return (this.out = Math.max(this.out, this.estimate(at)))
  }
}
