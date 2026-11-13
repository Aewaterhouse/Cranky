/** What the frame-time monitor reports. */
export interface PerfStats {
  /** Frames a second on average over the window, and the average of the slowest 1% of frames (as fps). */
  fps: number
  low1: number
  /** The slowest frame in the window, ms. */
  worstMs: number
  frames: number
  /** Chunk builds in the window: how many, their average and their slowest, ms. */
  builds: number
  buildMs: number
  buildWorstMs: number
}

/**
 * A lightweight frame-time monitor: a ring of the last `size` frame times and the chunk builds that fell among
 * them. No DOM and no three.js, and nothing is allocated per frame.
 */
export class PerfMon {
  private ms: Float32Array
  private n = 0
  private at = 0
  private builds: Float32Array
  private bn = 0
  private bat = 0
  private sorted: Float32Array

  constructor(size = 600, buildSize = 64) {
    this.ms = new Float32Array(size)
    this.sorted = new Float32Array(size)
    this.builds = new Float32Array(buildSize)
  }

  /** Call once a frame with the real time since the last one, in seconds. */
  frame(dt: number) {
    this.ms[this.at] = dt * 1000
    this.at = (this.at + 1) % this.ms.length
    this.n = Math.min(this.n + 1, this.ms.length)
  }

  /** Call when a chunk has been built, with how long it took in ms. */
  build(ms: number) {
    this.builds[this.bat] = ms
    this.bat = (this.bat + 1) % this.builds.length
    this.bn = Math.min(this.bn + 1, this.builds.length)
  }

  reset() {
    this.n = this.at = this.bn = this.bat = 0
  }

  stats(): PerfStats {
    const { n, bn } = this
    if (!n)
      return { fps: 0, low1: 0, worstMs: 0, frames: 0, builds: 0, buildMs: 0, buildWorstMs: 0 }
    const s = this.sorted.subarray(0, n)
    s.set(this.ms.subarray(0, n))
    s.sort()
    let sum = 0
    for (let i = 0; i < n; i++) sum += s[i]
    // The slowest 1% of frames (at least one), averaged.
    const k = Math.max(1, Math.round(n / 100))
    let slow = 0
    for (let i = n - k; i < n; i++) slow += s[i]
    let bsum = 0
    let bworst = 0
    for (let i = 0; i < bn; i++) {
      bsum += this.builds[i]
      bworst = Math.max(bworst, this.builds[i])
    }
    return {
      fps: 1000 / (sum / n),
      low1: 1000 / (slow / k),
      worstMs: s[n - 1],
      frames: n,
      builds: bn,
      buildMs: bn ? bsum / bn : 0,
      buildWorstMs: bworst,
    }
  }
}
