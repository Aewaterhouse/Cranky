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
  /** Optional cadence band [lo, hi] in rpm for this block. */
  cad?: [number, number]
  blocks?: Block[]
}
export interface Plan {
  id: string
  name: string
  desc?: string
  goal?: string
  /** Marks an FTP test: the player works out a new FTP at the end. */
  test?: 'ramp' | 'ftp20'
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
  /** Cadence band for this block, when the plan sets one. */
  cad?: [number, number]
  next?: { type: BlockType; label: string; in: number; tgt: number | null }
  event?: string
}

export type TrainerStatus = 'connected' | 'reconnecting'

export interface Trainer {
  name: string
  connect(): Promise<void>
  onData(cb: (d: { power: number; cadence: number }) => void): void
  /** Fires 'reconnecting' when the link drops and 'connected' once it is back. Listeners add up. */
  onStatus(cb: (s: TrainerStatus) => void): void
  /** Stops any reconnecting and drops the link. */
  close?(): void
  requestControl(): Promise<void>
  setPower(watts: number): Promise<void>
  setSim(gradePct: number): Promise<void>
  /** Fixed resistance level, 0-100% of the trainer's range. */
  setResistance(pct: number): Promise<void>
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
