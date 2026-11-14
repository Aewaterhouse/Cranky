import type { DraftLevel } from '../core/physics'
// Mirrors docs/protocol.md and server/src/zombie_bus_server/protocol.py.
import type { GroupSummary } from '../ui/results'
import type { Look } from '../core/cosmetics'
import type { Grade, Plan, Tier } from '../types'

export type TrainerMode = 'erg' | 'gears' | 'choose'
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare'
export type Game = 'bus' | 'madness' | 'ambo'
/** VO2 Madness state: effort points, seconds over 90% of max, crown, leader, round and mystery box. */
export interface MadState {
  pts: Record<string, number>
  red: Record<string, number>
  crown: string | null
  lead: string | null
  round: number
  rounds: number
  work: boolean
  box: boolean
  /** The next interval's name once the box has opened. */
  next: string | null
  twist: string | null
}

export type ClientMsg =
  | { t: 'join'; name: string; ftp: number; tier: Tier; look: Look }
  | { t: 'watch' }
  | { t: 'setup'; plan: string; minutes: number }
  | { t: 'bots'; n: number }
  | { t: 'difficulty'; level: Difficulty }
  | { t: 'game'; game: Game }
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'tier'; tier: Tier }
  | {
      t: 'road'
      route: string
      laps: number
      style: RoadStyle
      together?: boolean
      draft?: DraftLevel
    }
  | {
      t: 'data'
      p: number
      w: number
      cad: number
      s?: number | null
      hr: number | null
      hrp?: number | null
    }
  | { t: 'buy'; item: ShopItem }
  | { t: 'erg'; on: boolean }
  | { t: 'act'; k: string; v?: string | number | boolean | null }
  | { t: 'trainers'; mode: TrainerMode }
  | { t: 'sprint'; blk: number; dur: number; avg: number; pct: number; grade: Grade; combo: number }

export type ShopItem = 'plating' | 'repellent' | 'sync'
export interface LobbyRider {
  id: string
  name: string
  tier: Tier
  ftp: number
  connected: boolean
  look: Look
  bot?: boolean
  /** ERG holds this rider's target; false means they ride on virtual gears. */
  erg?: boolean
}
export interface Lobby {
  t: 'lobby'
  /** `road` means this code is a group ride and the message is really a RoadLobby: hand over to that flow. */
  kind?: 'bus' | 'road'
  code: string
  host: string
  state: 'lobby' | 'running' | 'done'
  plan: Plan
  minutes: number
  difficulty: Difficulty
  /** The host's pick for the ride: everyone on ERG, everyone on gears, or each rider chooses. */
  trainers?: TrainerMode
  game?: Game
  mutator: { id: string; name: string; desc: string } | null
  riders: LobbyRider[]
}
export interface RiderTick {
  name: string
  tier: Tier
  tgt: number | null
  w: number
  cad: number
  s: number | null
  st: 'riding' | 'fell' | 'spectator'
  /** Heart rate in bpm, and as a fraction of the rider's max (null without a strap or a max). */
  hr?: number | null
  hrp?: number | null
  erg?: boolean
  /** The game's own target for this rider: [low, high] watts, or no target at all. Null: the plan's `tgt`. */
  band?: [number, number] | 'sprint' | 'free' | null
}
export interface BusState {
  speed: number
  dist: number
  armour: number
  gap: number
  scrap: number
  sync: boolean
  tune: boolean
  rb: number | null
  combo: number
  shop: boolean
  repel: number
  syncw: number
  nitro: number
  boost: boolean
  /** 0..1 progress of the clean-riding streak towards `next`. */
  streak: number
  next: 'drop' | 'airstrike' | 'gunship'
  gunship: boolean
  mad?: MadState | null
}
export interface Fx {
  k: string
  text?: string | null
  id?: string | null
}
export interface Tick {
  t: 'tick'
  el: number
  i: number
  bel: number
  ev: string
  riders: Record<string, RiderTick>
  bus: BusState
  fx: Fx[]
  /** Targets of riders still on the bus are multiplied by this while others have fallen off (1 when none). */
  load?: number
  /** Each rider's ride so far, at most once a second (absent on the ticks in between, and from older servers). */
  stats?: Record<string, RideStats>
  /** The crew game's own state, for games newer than VO2 Madness. */
  game?: Record<string, unknown> | null
}
/** A rider's ride so far, worked out on the server from the power it has received. */
export interface RideStats {
  ftp: number
  /** Kilograms, or null when the rider has not set a weight. */
  kg: number | null
  /** Average and normalised watts, the share of scored time on target (null before any), kJ and falls. */
  avg: number
  np: number
  on: number | null
  kj: number
  falls: number
}

/** Road rooms (group free ride): see "Road rooms" in docs/protocol.md. */
export type RoadStyle = 'social' | 'race'
export interface RoadLobbyRider {
  id: string
  name: string
  ftp: number
  kg: number
  /** The weight the rider set (null if none; `kg` falls back to a default for the physics). From 2026-11-14. */
  weightKg?: number | null
  connected: boolean
  look: Look
  bot: boolean
  /** A bot's one-line character. */
  line: string | null
}
export interface RoadLobby {
  t: 'lobby'
  kind: 'road'
  code: string
  host: string
  state: 'lobby' | 'running' | 'done'
  route: string
  laps: number
  /** Metres, all laps. */
  distance: number
  style: RoadStyle
  together: boolean
  /** The host's drafting level for the ride. */
  draft?: DraftLevel
  riders: RoadLobbyRider[]
}
export interface RoadRiderTick {
  /** Metres along the whole ride, and ground speed in m/s. */
  d: number
  v: number
  w: number
  cad: number
  hr: number | null
  /** Metres right of the centre line. */
  lane: number
  /** Drag multiplier (1 is clean air) and the keep-together scale on distance covered (1 is off). */
  draft: number
  band: number
  st: 'riding' | 'stopped' | 'away' | 'finished'
  /** The rider's time in seconds once finished. */
  fin: number | null
}
export interface RoadTick {
  t: 'tick'
  kind: 'road'
  el: number
  riders: Record<string, RoadRiderTick>
  game: Record<string, unknown> | null
  fx: Fx[]
}
export interface RoadSummary {
  kind: 'road'
  route: string
  name: string
  laps: number
  distance: number
  secs: number
  style: RoadStyle
  together: boolean
  riders: {
    id: string
    name: string
    bot: boolean
    place: number
    /** Null for a rider who did not finish. */
    time: number | null
    dist: number
    late: boolean
    avgPower: number
    wkg: number
    /** Average watts saved by drafting. */
    saved: number
  }[]
}
/** What a road room's socket sends. */
export type RoadMsg =
  RoadLobby | RoadTick | { t: 'end'; summary: RoadSummary } | { t: 'error'; msg: string }

export type ServerMsg =
  | Lobby
  | Tick
  | { t: 'end'; summary: GroupSummary & { score: number } }
  | { t: 'error'; msg: string }
