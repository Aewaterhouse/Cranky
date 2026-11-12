export type Tier = 'hard' | 'medium' | 'easy'
export const TIERS: Tier[] = ['hard', 'medium', 'easy']
export type BlockType = 'steady' | 'ramp' | 'over-under' | 'sprint' | 'free' | 'set'
/** Percent of FTP: one number (hard tier, scaled for other tiers) or explicit per tier. */
export type Pct = number | Record<Tier, number>

export interface Block {
  type: BlockType
  dur: number
  label?: string
  pct?: Pct | [Pct, Pct]
  step?: number
  rep?: number
  blocks?: Block[]
}
export interface Plan {
  id: string
  name: string
  desc?: string
  blocks: Block[]
}

/** What the rider should be doing right now; produced locally (drill) or from a server tick. */
export interface Frame {
  el: number
  i: number
  bel: number
  type: BlockType
  label: string
  dur: number
  /** Target watts, or null when ERG is off (sprint, free). */
  tgt: number | null
  next?: { type: BlockType; label: string; in: number; tgt: number | null }
  event?: string
}

export interface Trainer {
  name: string
  connect(): Promise<void>
  onData(cb: (d: { power: number; cadence: number }) => void): void
  onDisconnect(cb: () => void): void
  requestControl(): Promise<void>
  setPower(watts: number): Promise<void>
  setSim(gradePct: number): Promise<void>
  release(): Promise<void>
}

export type Grade = 'FAIL' | 'HIT' | 'GREAT' | 'MEGA' | 'LEGEND'
export interface SprintResult {
  blk: number
  dur: number
  avg: number
  pct: number
  grade: Grade
  combo: number
}
