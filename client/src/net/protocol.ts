// Mirrors docs/protocol.md and server/src/zombie_bus_server/protocol.py.
import type { GroupSummary } from '../ui/results'
import type { Look } from '../core/cosmetics'
import type { Grade, Plan, Tier } from '../types'

export type ClientMsg =
  | { t: 'join'; name: string; ftp: number; tier: Tier; look: Look }
  | { t: 'setup'; plan: string; minutes: number }
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'tier'; tier: Tier }
  | { t: 'data'; p: number; w: number; cad: number; s: number | null }
  | { t: 'buy'; item: ShopItem }
  | { t: 'sprint'; blk: number; dur: number; avg: number; pct: number; grade: Grade; combo: number }

export type ShopItem = 'plating' | 'repellent' | 'sync'
export interface LobbyRider {
  id: string
  name: string
  tier: Tier
  ftp: number
  connected: boolean
  look: Look
}
export interface Lobby {
  t: 'lobby'
  code: string
  host: string
  state: 'lobby' | 'running' | 'done'
  plan: Plan
  minutes: number
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
}
export type ServerMsg =
  | Lobby
  | Tick
  | { t: 'end'; summary: GroupSummary & { score: number } }
  | { t: 'error'; msg: string }
