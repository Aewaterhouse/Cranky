import { CFG } from '../../config'
import { bandFactor, draftFactor, type DraftLevel } from '../../core/physics'
import type {
  ClientMsg,
  RoadLobby,
  RoadLobbyRider,
  RoadRiderTick,
  RoadTick,
} from '../../net/protocol'
import type { RoadRider } from '../../scene/route/roadRiders'

const R = CFG.road
const ORD = ['', '1st', '2nd', '3rd']
export const ordinal = (n: number) => ORD[n] ?? `${n}th`

export interface LinkRider extends RoadRider {
  wkg: number
  st: RoadRiderTick['st']
  hr: number | null
  ftp?: number
  kg?: number | null
}

/**
 * A group ride as the ride loop sees it: where the server says everyone is, my own rider guessed ahead between
 * ticks with the same physics and eased back onto the server's line, and the things worth a toast. No DOM, no
 * socket and nothing that can reach the trainer: `out` only ever carries `data` messages.
 */
export class RoadLink {
  /** Server ride clock at the last tick (negative in the countdown) and when that tick arrived. */
  el = -Infinity
  private got = 0
  private sent = -Infinity
  private riders: Record<string, RoadRiderTick> = {}
  private info = new Map<string, RoadLobbyRider>()
  private close = new Map<string, boolean>()
  private notes: string[] = []
  private together = false
  private drafting: DraftLevel = 'strong'
  private flash: [string, string, number] | undefined
  /** Rings the bell for a race's last lap, sprint or prime. */
  onBell: (text: string) => void = () => {}

  constructor(
    readonly me: string,
    private out: (m: ClientMsg) => void,
    private now: () => number = () => performance.now() / 1000,
  ) {}

  /** Takes a lobby update: names, looks and weights, and who has come or gone. */
  lobby(l: RoadLobby) {
    const first = !this.info.size
    for (const r of l.riders) {
      const was = this.info.get(r.id)
      if (r.id !== this.me && !first) {
        if (!was) this.notes.push(`${r.name} joined`)
        else if (was.connected !== r.connected)
          this.notes.push(r.connected ? `${r.name} is back` : `${r.name} dropped out`)
      }
    }
    this.info = new Map(l.riders.map((r) => [r.id, r]))
    this.together = l.together
    this.drafting = l.draft ?? 'strong'
  }

  tick(m: RoadTick) {
    this.el = m.el
    this.got = this.now()
    this.riders = m.riders
    const mine = m.riders[this.me]
    for (const fx of m.fx) {
      const name = this.info.get(fx.id ?? '')?.name ?? 'Someone'
      if (fx.k === 'finish' && fx.id) {
        const place = ordinal(+(fx.text ?? 0))
        this.notes.push(fx.id === this.me ? `Finished: ${place}` : `${name} finished ${place}`)
      } else if (fx.k === 'bell') {
        this.flash = [fx.text ?? '', fx.id ? name : '', this.got + R.bannerS]
        this.onBell(fx.text ?? '')
      }
    }
    if (!mine || mine.st === 'finished' || m.el <= 0) return
    for (const [id, r] of Object.entries(m.riders)) {
      if (id === this.me || r.st === 'finished') continue
      const gap = r.d - mine.d
      const was = this.close.get(id)
      const now = Math.abs(gap) < R.nearM ? true : Math.abs(gap) > R.farM ? false : was
      if (now === undefined) continue
      this.close.set(id, now)
      if (was === undefined || was === now) continue
      const name = this.info.get(id)?.name ?? 'Someone'
      // Whoever is travelling faster did the catching or the dropping.
      const mineFaster = mine.v > r.v
      if (now) this.notes.push(mineFaster ? `You caught ${name}` : `${name} caught you`)
      else this.notes.push(gap > 0 ? `${name} has dropped you` : `You dropped ${name}`)
    }
  }

  /** Forgets the last ride's positions before a new one starts in the same room. */
  clear() {
    this.el = -Infinity
    this.riders = {}
    this.close.clear()
    this.notes = []
    this.flash = undefined
  }

  private age() {
    return Math.min(1, Math.max(0, this.now() - this.got))
  }

  /** What the server last said about me. */
  mine(): RoadRiderTick | undefined {
    return this.riders[this.me]
  }

  /** The server's ride clock now, in seconds. */
  clock() {
    return Math.max(0, this.el + this.age())
  }

  /** Seconds until the start: 0 once the ride is under way, Infinity before the first tick. */
  countdown() {
    return Math.max(0, -(this.el + this.age()))
  }

  /** The words over the view while nobody is riding: the countdown, then waiting at the finish. */
  banner(): [string, string] | undefined {
    const count = this.countdown()
    const f = this.flash
    if (f && this.now() < f[2]) return [f[0], f[1]]
    if (this.mine()?.st === 'finished') return ['Finished', 'Waiting for the others. Esc to leave.']
    if (count <= 0) return undefined
    return [isFinite(count) ? String(Math.ceil(count)) : 'Get ready', 'The ride starts together']
  }

  /** Everyone else, carried on from the last tick at their speed. */
  others(): LinkRider[] {
    const age = this.age()
    return Object.entries(this.riders)
      .filter(([id]) => id !== this.me)
      .map(([id, r]) => {
        const i = this.info.get(id)
        return {
          id,
          name: i?.name ?? id,
          d: r.d + (r.st === 'finished' ? 0 : r.v * age),
          offset: r.lane,
          speed: r.v,
          cadence: r.cad,
          look: i?.look,
          power: r.w,
          effort: i?.ftp ? r.w / i.ftp : undefined,
          cheer: r.st === 'finished',
          wkg: r.w / (i?.kg || CFG.freeRide.defaultKg),
          st: r.st,
          hr: r.hr,
          ftp: i?.ftp,
          kg: i?.weightKg,
        }
      })
  }

  /** The drag multiplier for me at `d`: the server's sum, on the positions as they are right now. */
  draft(d: number) {
    const ahead = this.others().filter((o) => o.st !== 'finished' && o.speed >= R.draft.minMs)
    return draftFactor(
      ahead.map((o) => o.d - d),
      this.drafting,
    )
  }

  /** The keep-together scale for me at `d`; 1 when the host has it off or I am not turning the pedals. */
  band(d: number, riding: boolean) {
    const pack = this.others().filter((o) => o.st === 'riding' || o.power! > 0)
    if (!this.together || !riding || !pack.length) return 1
    const ds = [...pack.map((o) => o.d), d].sort((a, b) => a - b)
    const mid =
      ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2
    return bandFactor(d - mid)
  }

  /**
   * Eases my guessed distance and physics speed towards the server's, a share of the gap per second, so the
   * rider answers the pedals at once and never visibly jumps; a big gap (a rejoin, a late join) is taken whole.
   */
  correct(d: number, v: number, dt: number): [number, number] {
    const m = this.mine()
    if (!m) return [d, v]
    if (m.st === 'finished') return [m.d, 0]
    const want = m.d + m.v * this.age()
    const k = Math.min(1, R.correct * dt)
    const err = want - d
    if (Math.abs(err) > R.snapM) return [want, m.v / m.band]
    return [d + err * k, v + (m.v / m.band - v) * k]
  }

  /** Sends my measured numbers, no more often than `sendS`. */
  report(power: number, avg: number, cadence: number, hr: number | null) {
    const t = this.now()
    if (t - this.sent < R.sendS) return
    this.sent = t
    this.out({ t: 'data', p: power, w: avg, cad: cadence, hr })
  }

  /** The toasts gathered since the last call. */
  takeNotes() {
    return this.notes.splice(0)
  }
}
