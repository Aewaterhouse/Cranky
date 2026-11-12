import { describe, expect, it } from 'vitest'
import { ClockSync } from '../src/net/clockSync'

/** Feeds ticks every `tickMs` of local time from a server running at `scale`, with optional jitter. */
function run(scale: number, secs: number, jitter: (n: number) => number = () => 0, tickMs = 500) {
  const c = new ClockSync()
  let n = 0
  let worst = 0
  for (let at = 0; at <= secs * 1000; at += tickMs / 10) {
    if (at % tickMs === 0) c.tick((at / 1000) * scale, at + jitter(n++))
    const est = c.now(at)
    if (est !== null && at > 6000) worst = Math.max(worst, Math.abs(est - (at / 1000) * scale))
  }
  return { c, worst }
}

describe('ClockSync', () => {
  it('is null before the first tick', () => expect(new ClockSync().now(0)).toBeNull())

  it('tracks steady ticks closely between them', () => {
    expect(run(1, 30).worst).toBeLessThan(0.05)
  })

  it('stays within a fraction of a second under jitter', () => {
    const jit = (n: number) => [0, 60, -40, 90, -80, 20][n % 6]
    expect(run(1, 60, jit).worst).toBeLessThan(0.25)
  })

  it('stays close to a 6x server between its ticks', () => {
    expect(run(6, 40, undefined, 500).worst).toBeLessThan(1)
  })

  it('follows a time-scaled server by measuring the rate', () => {
    const c = new ClockSync()
    for (let n = 0; n < 40; n++) c.tick(n * 0.5, (n * 0.5 * 1000) / 6)
    const end = (39 * 0.5 * 1000) / 6
    const a = c.now(end + 20)!
    const b = c.now(end + 100)!
    expect((b - a) / 0.08).toBeGreaterThan(5.5)
    expect((b - a) / 0.08).toBeLessThan(6.5)
  })

  it('clamps an absurd rate', () => {
    const c = new ClockSync()
    c.tick(0, 0)
    c.tick(0.9, 600)
    c.tick(1.8, 1200)
    expect(c.now(1700)! - c.now(1200)!).toBeLessThan(0.5 * 30 + 0.01)
  })

  it('snaps when more than a second out, and only then goes backwards', () => {
    const c = new ClockSync()
    for (let n = 0; n < 10; n++) c.tick(n * 0.5, n * 500)
    expect(c.now(4600)).toBeCloseTo(4.6, 0)
    c.tick(30, 5000)
    expect(c.now(5000)).toBeCloseTo(30, 1)
    c.tick(10, 5500)
    expect(c.now(5500)).toBeCloseTo(10, 0)
  })

  it('does not run backwards on a late tick', () => {
    const c = new ClockSync()
    for (let n = 0; n < 6; n++) c.tick(n * 0.5, n * 500)
    const a = c.now(2900)!
    c.tick(2.5, 2900)
    expect(c.now(2900)!).toBeGreaterThanOrEqual(a)
  })

  it('goes quiet when ticks stop', () => {
    const c = new ClockSync()
    c.tick(5, 0)
    expect(c.now(2000)).not.toBeNull()
    expect(c.now(4000)).toBeNull()
  })
})
