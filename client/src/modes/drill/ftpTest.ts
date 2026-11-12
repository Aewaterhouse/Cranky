import { CFG } from '../../config'
import { startOf } from '../../core/plan'
import type { Plan } from '../../types'

export interface TestSpec {
  kind: 'ramp' | 'ftp20'
  /** Block range measured: [from, to). `to` is the cool-down for the ramp test. */
  from: number
  to: number
}

/** Which blocks of a test plan are measured, or null for an ordinary plan. */
export function testSpec(plan: Plan): TestSpec | null {
  if (!plan.test) return null
  const bl = plan.blocks
  if (plan.test === 'ramp') {
    const from = bl.findIndex((b) => b.label?.startsWith('Ramp'))
    const to = bl.findIndex((b) => b.label === 'Cool-down')
    return from < 0 || to < 0 ? null : { kind: 'ramp', from, to }
  }
  const from = bl.findIndex((b) => b.label === '20 min test')
  return from < 0 ? null : { kind: 'ftp20', from, to: from + 1 }
}

/** Highest mean power over any `win` plan seconds, from samples recorded at plan times `xs`. */
export function bestAverage(power: number[], xs: number[], win: number): number | null {
  let best: number | null = null
  let sum = 0
  for (let i = 0, j = 0; j < power.length; j++) {
    sum += power[j]
    while (xs[j] - xs[i] >= win) sum -= power[i++]
    const n = j - i + 1
    if (xs[j] - xs[i] >= win * CFG.ftpTest.coverage && n >= 3) best = Math.max(best ?? 0, sum / n)
  }
  return best
}

/** The new FTP in watts from the recorded ride, or null when there is not enough data. */
export function ftpResult(plan: Plan, power: number[], xs: number[]): number | null {
  const s = testSpec(plan)
  if (!s) return null
  const t0 = startOf(plan.blocks, s.from)
  const t1 = startOf(plan.blocks, s.to)
  const at = xs.map((_, i) => i).filter((i) => xs[i] >= t0 && xs[i] < t1)
  const p = at.map((i) => power[i])
  const x = at.map((i) => xs[i])
  const c = CFG.ftpTest
  if (s.kind === 'ramp') {
    const b = bestAverage(p, x, c.rampWindowS)
    return b === null ? null : Math.round(b * c.rampFactor)
  }
  if (!p.length || x[x.length - 1] - x[0] < (t1 - t0) * c.coverage) return null
  return Math.round((p.reduce((a, b) => a + b, 0) / p.length) * c.twentyFactor)
}

/** Plan second where the ramp test's cool-down begins (what "I'm done" jumps to). */
export function coolStart(plan: Plan): number | null {
  const s = testSpec(plan)
  return s && startOf(plan.blocks, s.to)
}
