import { CFG } from '../config'
import type { Frame } from '../types'

/** What a workout block asks of the rider, as the power panel shows it. */
export interface Aim {
  /** The small caption over the big number: "Target", "Power · 3 s", "Sprint". */
  cap: string
  /** A chip beside it: "🔒 ERG", "ERG off". */
  chip?: string
  /** Target watts. Never set in a sprint. */
  target?: number | null
  /** The target is the big number and power sits beneath it; otherwise the other way round. */
  targetLeads?: boolean
  /** The second line in place of the other number: "All out", "Resistance 40%". */
  note?: string
  /** Sprint: how full the bar is against the rider's best, 0..1. */
  fill?: number
  /** Cadence band of the block, when the plan sets one. */
  cad?: [number, number]
}

/**
 * The solo player's power panel for this moment. In ERG the target leads; outside it (`mode` is then
 * "Resistance 40%" or the like) power leads and the plan's target is only an aim. A sprint or a free block
 * never has a target.
 */
export function soloAim(f: Frame, mode: string | null): Aim {
  if (f.type === 'sprint') return { cap: 'Sprint', chip: 'ERG off', note: 'All out', cad: f.cad }
  if (f.tgt == null) return { cap: 'Power · 3 s', chip: 'ERG off', note: 'Free ride', cad: f.cad }
  return mode === null
    ? { cap: 'Target', chip: '🔒 ERG', target: f.tgt, targetLeads: true, cad: f.cad }
    : { cap: 'Power · 3 s', chip: `aim ${f.tgt} W`, target: f.tgt, note: mode, cad: f.cad }
}

/** The bus's power panel: power leads, the target beneath. A sprint shows the rider's best so far, never a target. */
export function busAim(f: Frame | null, power: number, best: number, erg = true): Aim {
  if (!f) return { cap: 'Power · 3 s', note: 'Get ready' }
  if (f.type === 'sprint')
    return {
      cap: 'Sprint',
      chip: 'ERG off',
      note: power >= best ? 'All out · new best!' : `All out · best ${Math.round(best)} W`,
      fill: power / best / CFG.hud.sprintBarOver,
    }
  return f.tgt
    ? { cap: 'Power · 3 s', chip: erg ? '🔒 ERG' : '⚙ Gears', target: f.tgt, cad: f.cad }
    : { cap: 'Power · 3 s', chip: 'ERG off', note: 'Free ride', cad: f.cad }
}
