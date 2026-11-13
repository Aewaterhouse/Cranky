/** Where a lap ride stands: the lap being ridden (from 1), how many in all, and the last and best lap times (s). */
export interface LapInfo {
  n: number
  of: number
  lastS?: number
  bestS?: number
}

/** The lap (from 1) being ridden `dist` metres into `laps` laps of `lapM` metres. */
export const lapAt = (dist: number, lapM: number, laps: number) =>
  Math.max(1, Math.min(laps, Math.floor(dist / lapM) + 1))

/** Lap times for a ride of `laps` laps of `lapM` metres: feed it distance and moving time as they grow. */
export class LapTimer {
  /** Seconds each finished lap took. */
  readonly times: number[] = []
  private startS = 0

  constructor(
    readonly lapM: number,
    readonly laps: number,
  ) {}

  /**
   * Call every tick with the distance, moving time and speed. Returns the time of a lap just finished (the line
   * is timed to where it was crossed, not to the tick), else undefined. Nothing for the last lap: that is the finish.
   */
  update(dist: number, el: number, speed = 0): number | undefined {
    const done = Math.min(this.laps - 1, Math.floor(dist / this.lapM))
    if (done <= this.times.length) return undefined
    const at = el - (speed > 0 ? Math.min(1, (dist - done * this.lapM) / speed) : 0)
    // A big jump (a dev fast-forward) shares the time evenly over the laps it skipped.
    const each = (at - this.startS) / (done - this.times.length)
    while (this.times.length < done) this.times.push(each)
    this.startS = at
    return each
  }

  info(dist: number): LapInfo {
    const t = this.times
    return {
      n: lapAt(dist, this.lapM, this.laps),
      of: this.laps,
      lastS: t[t.length - 1],
      bestS: t.length ? Math.min(...t) : undefined,
    }
  }
}

/** The toast for a finished lap, or for starting the final one. */
export function lapToast(i: LapInfo, clock: (s: number) => string): string {
  const best = i.lastS !== undefined && i.lastS === i.bestS && i.n > 2 ? ' · best yet' : ''
  const done = `Lap ${i.n - 1} done · ${clock(i.lastS ?? 0)}${best}`
  return i.n === i.of ? `Last lap · ${done}` : done
}
